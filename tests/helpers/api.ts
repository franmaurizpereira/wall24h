import { randomUUID } from 'node:crypto';
import { expect, request as playwrightRequest } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import pg from 'pg';
import type { QueryResultRow } from 'pg';

export const baseURL = process.env.TEST_BASE_URL ?? 'http://localhost:8081';

export async function dbExec(text: string, params: Array<string | number> = []): Promise<void> {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  try {
    await pool.query(text, params);
  } finally {
    await pool.end();
  }
}

export async function dbQuery<T extends QueryResultRow>(
  text: string,
  params: Array<string | number> = [],
): Promise<T[]> {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  try {
    const result = await pool.query<T>(text, params);
    return result.rows;
  } finally {
    await pool.end();
  }
}

export function uniqueUser(prefix: string) {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12);
  return {
    username: `${prefix}_${suffix}`,
    email: `${prefix}_${suffix}@example.com`,
    password: 'password123',
  };
}

/**
 * Crea un usuario directamente en la base de datos para fixtures de UI.
 * No crea sesión: la lectura del muro es pública.
 */
export async function createUserDirect(prefix: string): Promise<{
  id: number;
  username: string;
  email: string;
}> {
  const credentials = uniqueUser(prefix);
  const rows = await dbQuery<{ id: string; username: string; email: string }>(
    `INSERT INTO users (username, email, password_hash)
     VALUES ($1, $2, 'fixture-not-a-real-hash')
     RETURNING id, username, email`,
    [credentials.username, credentials.email],
  );

  return { ...rows[0], id: Number(rows[0].id) };
}

export async function createSessionContext(prefix: string): Promise<{
  context: APIRequestContext;
  user: { id: number; username: string; email: string; password: string };
}> {
  const context = await playwrightRequest.newContext({ baseURL });
  const credentials = uniqueUser(prefix);

  try {
    const response = await context.post('/api/auth/register', { data: credentials });
    expect(response.status()).toBe(201);
    const body = (await response.json()) as { id: number; username: string };
    return {
      context,
      user: { ...credentials, id: body.id, username: body.username },
    };
  } catch (error) {
    await context.dispose();
    throw error;
  }
}

export async function createMessageForUser(
  userId: number,
  content: string,
  hoursAgo = 0,
): Promise<number> {
  const rows = await dbQuery<{ id: string }>(
    `INSERT INTO messages (user_id, content, created_at)
     VALUES ($1, $2, now() - ($3::text || ' hours')::interval)
     RETURNING id`,
    [userId, content, hoursAgo],
  );

  return Number(rows[0].id);
}

export async function truncateMessages(): Promise<void> {
  await dbExec('TRUNCATE TABLE messages CASCADE');
}
