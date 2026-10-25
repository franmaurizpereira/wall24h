import { createHash, randomBytes } from 'node:crypto';
import { query } from '../db.js';

export const SESSION_COOKIE = 'session';
export const SESSION_TTL_DAYS = 7;
export const SESSION_TTL_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60;

export function createSessionToken() {
  return randomBytes(32).toString('hex');
}

export function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId, client = null) {
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const run = client ? (text, params) => client.query(text, params) : query;

  const { rows } = await run(
    `INSERT INTO sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + interval '7 days')
     RETURNING expires_at`,
    [tokenHash, userId],
  );

  return { token, expiresAt: rows[0].expires_at };
}

export async function findSessionUser(token) {
  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  const { rows } = await query(
    `SELECT u.id, u.username
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [tokenHash],
  );

  return rows[0] ?? null;
}

export async function deleteSession(token) {
  if (!token) return;

  await query('DELETE FROM sessions WHERE token_hash = $1', [hashSessionToken(token)]);
}
