import { randomUUID } from 'node:crypto';
import { expect, request as playwrightRequest, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import pg from 'pg';
import type { QueryResultRow } from 'pg';

const baseURL = process.env.TEST_BASE_URL ?? 'http://localhost:8081';

async function dbExec(text: string, params: Array<string | number> = []): Promise<void> {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  try {
    await pool.query(text, params);
  } finally {
    await pool.end();
  }
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

function uniqueUser(prefix: string) {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12);
  return {
    username: `${prefix}_${suffix}`,
    email: `${prefix}_${suffix}@example.com`,
    password: 'password123',
  };
}

async function createSessionContext(prefix: string): Promise<{
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

async function truncateMessages() {
  await dbExec('TRUNCATE TABLE messages CASCADE');
}

test.beforeEach(async () => {
  await truncateMessages();
});

test('publica un mensaje y fija expires_at a 24h', async () => {
  const { context, user } = await createSessionContext('publish');
  try {
    const response = await context.post('/api/messages', {
      data: { text: '  Hola muro  ' },
    });

    expect(response.status()).toBe(201);
    const body = (await response.json()) as {
      id: number;
      created_at: string;
      expires_at: string;
    };

    expect(typeof body.id).toBe('number');
    expect(Date.parse(body.expires_at) - Date.parse(body.created_at)).toBe(24 * 60 * 60 * 1000);

    const rows = await dbQuery<{ content: string; user_id: string }>(
      'SELECT content, user_id FROM messages WHERE id = $1',
      [body.id],
    );

    expect(rows[0]?.content).toBe('Hola muro');
    expect(Number(rows[0]?.user_id)).toBe(user.id);
  } finally {
    await context.dispose();
  }
});

test('rechaza texto vacío, solo espacios o más de 500 caracteres', async () => {
  const { context } = await createSessionContext('validate');
  try {
    for (const text of ['', '   ', 'a'.repeat(501)]) {
      const response = await context.post('/api/messages', { data: { text } });
      expect(response.status()).toBe(422);
      expect((await response.json()).code).toBe('invalid_input');
    }

    const missing = await context.post('/api/messages', { data: {} });
    expect(missing.status()).toBe(422);
  } finally {
    await context.dispose();
  }
});

test('rechaza contenido moderado', async () => {
  const { context } = await createSessionContext('moderate');
  try {
    const response = await context.post('/api/messages', {
      data: { text: 'contenido_prohibido' },
    });

    expect(response.status()).toBe(422);
    expect((await response.json()).code).toBe('content_not_allowed');
  } finally {
    await context.dispose();
  }
});

test('un usuario no puede tener dos mensajes activos', async () => {
  const { context } = await createSessionContext('active');
  try {
    const first = await context.post('/api/messages', {
      data: { text: 'Primer mensaje' },
    });
    expect(first.status()).toBe(201);

    const second = await context.post('/api/messages', {
      data: { text: 'Segundo mensaje' },
    });
    expect(second.status()).toBe(409);
    expect((await second.json()).code).toBe('already_has_active_message');
  } finally {
    await context.dispose();
  }
});

test('rechaza contenido duplicado activo entre usuarios', async () => {
  const first = await createSessionContext('dupa');
  const second = await createSessionContext('dupb');

  try {
    const firstResponse = await first.context.post('/api/messages', {
      data: { text: '  Contenido Duplicado  ' },
    });
    expect(firstResponse.status()).toBe(201);

    const duplicate = await second.context.post('/api/messages', {
      data: { text: 'contenido duplicado' },
    });
    expect(duplicate.status()).toBe(409);
    expect((await duplicate.json()).code).toBe('duplicate_message');
  } finally {
    await first.context.dispose();
    await second.context.dispose();
  }
});

test('rechaza publicar sin sesión', async () => {
  const context = await playwrightRequest.newContext({ baseURL });
  try {
    const response = await context.post('/api/messages', {
      data: { text: 'Sin sesión' },
    });
    expect(response.status()).toBe(401);
    expect((await response.json()).code).toBe('not_authenticated');
  } finally {
    await context.dispose();
  }
});

test('concurrencia: solo un mensaje activo por usuario', async () => {
  const { context } = await createSessionContext('race');
  try {
    const [first, second] = await Promise.all([
      context.post('/api/messages', { data: { text: 'Carrera uno' } }),
      context.post('/api/messages', { data: { text: 'Carrera dos' } }),
    ]);

    const statuses = [first.status(), second.status()].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);

    const conflict = first.status() === 409 ? first : second;
    expect((await conflict.json()).code).toBe('already_has_active_message');
  } finally {
    await context.dispose();
  }
});

test('concurrencia: solo un contenido duplicado entre usuarios', async () => {
  const first = await createSessionContext('racedupa');
  const second = await createSessionContext('racedupb');

  try {
    const text = 'Contenido concurrente duplicado';
    const [firstResponse, secondResponse] = await Promise.all([
      first.context.post('/api/messages', { data: { text } }),
      second.context.post('/api/messages', { data: { text } }),
    ]);

    const statuses = [firstResponse.status(), secondResponse.status()].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);

    const conflict = firstResponse.status() === 409 ? firstResponse : secondResponse;
    expect((await conflict.json()).code).toBe('duplicate_message');
  } finally {
    await first.context.dispose();
    await second.context.dispose();
  }
});
