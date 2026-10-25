import { createHash, randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import pg from 'pg';
import type { QueryResultRow } from 'pg';

function uniqueUser(prefix: string) {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12);
  return {
    username: `${prefix}_${suffix}`,
    email: `${prefix}_${suffix}@example.com`,
    password: 'password123',
  };
}

async function dbQuery<T extends QueryResultRow>(
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

test('registro crea usuario, cookie HttpOnly y sesión hasheada', async ({ request }) => {
  const user = uniqueUser('alice');
  const register = await request.post('/api/auth/register', { data: user });

  expect(register.status()).toBe(201);
  const body = (await register.json()) as { id: number; username: string };
  expect(body.username).toBe(user.username);
  expect(typeof body.id).toBe('number');

  const setCookie = register.headers()['set-cookie'] ?? '';
  expect(setCookie).toContain('session=');
  expect(setCookie.toLowerCase()).toContain('httponly');
  expect(setCookie.toLowerCase()).toContain('samesite=lax');
  expect(setCookie.toLowerCase()).toContain('path=/');
  expect(setCookie.toLowerCase()).toContain('max-age=604800');

  const token = setCookie.match(/session=([^;]+)/)?.[1] ?? '';
  expect(token).not.toBe('');
  expect(token).toMatch(/^[0-9a-f]{64}$/);

  const rows = await dbQuery<{ password_hash: string; token_hash: string }>(
    `SELECT u.password_hash, s.token_hash
     FROM users u
     JOIN sessions s ON s.user_id = u.id
     WHERE u.id = $1
     ORDER BY s.created_at DESC
     LIMIT 1`,
    [body.id],
  );

  expect(rows[0]?.password_hash).toMatch(/^\$argon2id\$/);
  expect(rows[0]?.token_hash).toMatch(/^[0-9a-f]{64}$/);
  expect(rows[0]?.token_hash).toBe(createHash('sha256').update(token).digest('hex'));
  expect(rows[0]?.token_hash).not.toBe(token);

  const me = await request.get('/api/auth/me');
  expect(me.status()).toBe(200);
  expect(await me.json()).toMatchObject({ id: body.id, username: user.username });

  const logout = await request.post('/api/auth/logout');
  expect(logout.status()).toBe(200);

  const afterLogout = await request.get('/api/auth/me');
  expect(afterLogout.status()).toBe(401);

  const sessions = await dbQuery<{ count: number }>(
    'SELECT count(*)::int AS count FROM sessions WHERE user_id = $1',
    [body.id],
  );
  expect(sessions[0]?.count).toBe(0);
});

test('registro rechaza usuario y email duplicados', async ({ request }) => {
  const user = uniqueUser('duplicate');
  const first = await request.post('/api/auth/register', { data: user });
  expect(first.status()).toBe(201);

  const duplicateUsername = await request.post('/api/auth/register', {
    data: {
      username: user.username,
      email: `other_${user.username}@example.com`,
      password: user.password,
    },
  });
  expect(duplicateUsername.status()).toBe(409);
  expect((await duplicateUsername.json()).code).toBe('already_exists');

  const other = uniqueUser('other');
  const duplicateEmail = await request.post('/api/auth/register', {
    data: {
      username: other.username,
      email: user.email,
      password: user.password,
    },
  });
  expect(duplicateEmail.status()).toBe(409);
  expect((await duplicateEmail.json()).code).toBe('already_exists');
});

test('login acepta credenciales correctas y rechaza incorrectas', async ({ request }) => {
  const user = uniqueUser('login');
  const register = await request.post('/api/auth/register', { data: user });
  expect(register.status()).toBe(201);

  await request.post('/api/auth/logout');

  const badLogin = await request.post('/api/auth/login', {
    data: { username: user.username, password: 'incorrecta' },
  });
  expect(badLogin.status()).toBe(401);
  expect((await badLogin.json()).code).toBe('bad_credentials');

  const goodLogin = await request.post('/api/auth/login', {
    data: { username: user.username, password: user.password },
  });
  expect(goodLogin.status()).toBe(200);

  const me = await request.get('/api/auth/me');
  expect(me.status()).toBe(200);
  expect(await me.json()).toMatchObject({ username: user.username });

  const logout = await request.post('/api/auth/logout');
  expect(logout.status()).toBe(200);
});

test('registro valida username, email y password', async ({ request }) => {
  const user = uniqueUser('valid');

  const shortPassword = await request.post('/api/auth/register', {
    data: { ...user, password: 'corta' },
  });
  expect(shortPassword.status()).toBe(422);
  expect((await shortPassword.json()).code).toBe('invalid_input');

  const invalidEmail = await request.post('/api/auth/register', {
    data: { ...user, email: 'no-es-email' },
  });
  expect(invalidEmail.status()).toBe(422);

  const shortUsername = await request.post('/api/auth/register', {
    data: { ...user, username: 'ab' },
  });
  expect(shortUsername.status()).toBe(422);
});

test('una sesión expirada deja de autenticar', async ({ request }) => {
  const user = uniqueUser('expiry');
  const register = await request.post('/api/auth/register', { data: user });
  expect(register.status()).toBe(201);

  const body = (await register.json()) as { id: number };
  await dbQuery(
    `UPDATE sessions
     SET created_at = now() - interval '8 days',
         expires_at = now() - interval '1 day'
     WHERE user_id = $1`,
    [body.id],
  );

  const me = await request.get('/api/auth/me');
  expect(me.status()).toBe(401);
});

test('login aplica rate limit', async ({ request }) => {
  const statuses: number[] = [];

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const response = await request.post('/api/auth/login', {
      data: { username: 'no_such_user', password: 'password-incorrecta' },
    });
    statuses.push(response.status());
  }

  expect(statuses).toContain(429);
});
