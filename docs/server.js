import Fastify from 'fastify'
import cookiePlugin from '@fastify/cookie'
import { z, ZodError } from 'zod'
import { argon2 } from '@node-rs/argon2'
import { randomBytes } from 'node:crypto'
import { query } from './db.js'

const app = Fastify({ logger: true })
await app.register(cookiePlugin)

const SESSION_TTL = 7 * 864e5
const sessions = new Map() // token -> { userId, exp }  (swap por Postgres si hay >1 réplica)

// ---------- Errores ----------
class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code }
}
const httpError = (status, code, message = code) => new ApiError(status, code, message)

function mapDbError(e) {
  if (e.code === '23505') {
    return e.constraint === 'uq_messages_active_per_user'
      ? httpError(409, 'already_has_active_message', 'Ya tienes un mensaje activo en el muro')
      : httpError(409, 'duplicate_message', 'Ese mensaje ya está en el muro')
  }
  if (e.code === 'P0001')
    return httpError(403, 'cannot_comment_on_own_message', 'No puedes comentar tu propio mensaje')
  throw e
}

app.setErrorHandler((err, req, reply) => {
  if (err instanceof ZodError)
    return reply.code(422).send({ code: 'invalid_input', issues: err.issues })
  const status = err.status || 500
  if (status >= 500) req.log.error(err)
  return reply.code(status).send({ code: err.code || 'internal_error', message: err.message })
})

// ---------- Regla 3b: moderación ----------
const BANNED = ['palabra_ejemplo_1', 'palabra_ejemplo_2'] // TODO: servicio real (p.ej. OpenAI Moderation)
async function moderate(text) {
  const t = text.toLowerCase()
  if (BANNED.some(w => t.includes(w))) throw httpError(422, 'content_not_allowed')
}

// ---------- Auth (sesión en cookie httpOnly) ----------
async function requireUser(req) {
  const token = req.cookies?.session
  const s = token && sessions.get(token)
  if (!s || s.exp < Date.now()) throw httpError(401, 'not_authenticated')
  req.userId = s.userId
}
function newSession(req, reply, userId) {
  const token = randomBytes(32).toString('hex')
  sessions.set(token, { userId, exp: Date.now() + SESSION_TTL })
  reply.setCookie('session', token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: SESSION_TTL / 1000 })
}

const registerSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-z0-9_]+$/i),
  email: z.string().email(),
  password: z.string().min(8).max(128),
})

app.post('/api/auth/register', async (req, reply) => {
  const { username, email, password } = registerSchema.parse(req.body)
  const hash = await argon2.hash(password)
  let id
  try {
    id = (await query(
      `INSERT INTO users (username, email, password_hash) VALUES ($1,$2,$3) RETURNING id`,
      [username, email, hash])).rows[0].id
  } catch (e) {
    if (e.code === '23505') throw httpError(409, 'already_exists', 'Usuario o email ya registrado')
    throw e
  }
  newSession(req, reply, id)
  return reply.code(201).send({ id })
})

app.post('/api/auth/login', async (req, reply) => {
  const { username, password } = z.object({ username: z.string(), password: z.string() }).parse(req.body)
  const { rows } = await query(
    `SELECT id, password_hash FROM users WHERE username = $1`, [username])
  if (!rows.length || !(await argon2.verify(rows[0].password_hash, password)))
    throw httpError(401, 'bad_credentials')
  newSession(req, reply, rows[0].id)
  return { ok: true }
})

app.post('/api/auth/logout', async (req, reply) => {
  sessions.delete(req.cookies?.session)
  return reply.clearCookie('session', { path: '/' }).send({ ok: true })
})

// ---------- Muro ----------
app.get('/api/wall', async () => {
  const { rows } = await query(`
    SELECT m.id, m.content, m.created_at, m.expires_at, m.comments_count,
           u.username AS author
    FROM messages m
    JOIN users u ON u.id = m.user_id
    WHERE m.expires_at > now()
    ORDER BY m.comments_count DESC, m.created_at DESC`)
  return rows
})

app.get('/api/messages/:id', async (req, reply) => {
  const { rows } = await query(`
    SELECT m.id, m.content, m.created_at, m.expires_at, m.comments_count,
           u.username AS author,
           (SELECT json_agg(json_build_object('id', c.id, 'content', c.content,
                                               'author', uu.username, 'created_at', c.created_at)
                         ORDER BY c.created_at)
            FROM comments c JOIN users uu ON uu.id = c.user_id
            WHERE c.message_id = m.id) AS comments
    FROM messages m JOIN users u ON u.id = m.user_id
    WHERE m.id = $1 AND m.expires_at > now()`,
    [Number(req.params.id)])
  if (!rows.length) throw httpError(410, 'message_gone', 'Este mensaje ya expiró')
  return rows[0]
})

// ---------- Crear mensaje (reglas 2 y 3) ----------
const messageSchema = z.object({ text: z.string().min(1).max(500) })

app.post('/api/messages', { preHandler: requireUser }, async (req, reply) => {
  const { text } = messageSchema.parse(req.body)
  await moderate(text)
  try {
    const { rows } = await query(
      `INSERT INTO messages (user_id, content) VALUES ($1,$2)
       RETURNING id, created_at, expires_at`,
      [req.userId, text])
    return reply.code(201).send(rows[0])
    // las reglas 2 y 3a las impone la BD → mapDbError → 409
  } catch (e) { throw mapDbError(e) }
})

// ---------- Comentar (reglas 1 y 3b) ----------
const commentSchema = z.object({ text: z.string().min(1).max(300) })

app.post('/api/messages/:id/comments', { preHandler: requireUser }, async (req, reply) => {
  const { text } = commentSchema.parse(req.body)
  const { rows } = await query(
    `SELECT id, user_id, expires_at FROM messages WHERE id = $1`, [Number(req.params.id)])
  if (!rows.length || rows[0].expires_at < new Date())
    throw httpError(410, 'message_gone', 'Este mensaje ya expiró')
  if (rows[0].user_id === req.userId)
    throw httpError(403, 'cannot_comment_on_own_message', 'No puedes comentar tu propio mensaje')
  await moderate(text)
  try {
    const out = (await query(
      `INSERT INTO comments (message_id, user_id, content) VALUES ($1,$2,$3)
       RETURNING id, created_at`,
      [rows[0].id, req.userId, text])).rows[0]
    return reply.code(201).send(out)
    // el trigger de BD respalda la regla 1 → P0001 → 403
  } catch (e) { throw mapDbError(e) }
})

// ---------- Reportes (regla 3b, moderación humana) ----------
app.post('/api/messages/:id/report', { preHandler: requireUser }, async (req, reply) => {
  const { reason } = z.object({ reason: z.string().min(5).max(500) }).parse(req.body)
  await query(`INSERT INTO reports (message_id, reporter_id, reason) VALUES ($1,$2,$3)`,
              [Number(req.params.id), req.userId, reason])
  return reply.code(201).send({ ok: true })
})

await app.listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' })
