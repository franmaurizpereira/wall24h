import { Algorithm, hash, verify } from '@node-rs/argon2';
import { z } from 'zod';
import { query, withTransaction } from '../db.js';
import { isAdminUsername, requireUser } from '../lib/auth.js';
import { httpError, mapDbError } from '../lib/errors.js';
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSession,
  deleteSession,
} from '../lib/sessions.js';

const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9_]+$/i, 'El usuario solo admite letras, números y guión bajo'),
  email: z.email(),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  username: z.string().trim().min(1).max(32),
  password: z.string().min(1).max(128),
});

function setSessionCookie(reply, token) {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

function clearSessionCookie(reply) {
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}

export default async function authRoutes(app) {
  app.post(
    '/register',
    { config: { rateLimit: { max: 50, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { username, email, password } = registerSchema.parse(request.body);
      const passwordHash = await hash(password, ARGON2_OPTIONS);

      let user;
      let session;
      try {
        const result = await withTransaction(async (client) => {
          const { rows } = await client.query(
            `INSERT INTO users (username, email, password_hash)
             VALUES ($1, $2, $3)
             RETURNING id, username`,
            [username, email, passwordHash],
          );
          const createdSession = await createSession(rows[0].id, client);
          return { user: rows[0], session: createdSession };
        });
        user = result.user;
        session = result.session;
      } catch (error) {
        throw mapDbError(error);
      }

      setSessionCookie(reply, session.token);
      return reply.code(201).send({
        id: Number(user.id),
        username: user.username,
        is_admin: isAdminUsername(user.username),
      });
    },
  );

  app.post(
    '/login',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { username, password } = loginSchema.parse(request.body);
      const { rows } = await query(
        `SELECT id, username, password_hash
         FROM users
         WHERE username = $1`,
        [username],
      );

      const user = rows[0];
      let valid = false;
      if (user) {
        try {
          valid = await verify(user.password_hash, password);
        } catch {
          valid = false;
        }
      }

      if (!valid) {
        throw httpError(401, 'bad_credentials', 'Usuario o contraseña incorrectos');
      }

      const session = await createSession(user.id);
      setSessionCookie(reply, session.token);
      return { ok: true };
    },
  );

  app.post('/logout', async (request, reply) => {
    await deleteSession(request.cookies[SESSION_COOKIE]);
    clearSessionCookie(reply);
    return { ok: true };
  });

  app.get('/me', { preHandler: requireUser }, async (request) => {
    return {
      id: Number(request.user.id),
      username: request.user.username,
      is_admin: isAdminUsername(request.user.username),
    };
  });
}
