import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import pg from 'pg';
import type { QueryResultRow } from 'pg';

type WallItem = {
  id: number;
  content: string;
  author: string;
  created_at: string;
  expires_at: string;
  comments_count: number;
  is_top: boolean;
};

type WallResponse = {
  server_time: string;
  items: WallItem[];
};

type MessageComment = {
  id: number;
  content: string;
  author: string;
  created_at: string;
};

type MessageDetail = {
  id: number;
  content: string;
  author: string;
  created_at: string;
  expires_at: string;
  comments_count: number;
  comments: MessageComment[];
};

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

function unique(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
}

async function createUser(prefix: string): Promise<{ id: string; username: string }> {
  const username = unique(prefix);
  const rows = await dbQuery<{ id: string }>(
    `INSERT INTO users (username, email, password_hash)
     VALUES ($1, $2, 'fixture')
     RETURNING id`,
    [username, `${username}@example.com`],
  );

  return { id: rows[0].id, username };
}

async function createMessage(userId: string, content: string, hoursAgo = 0): Promise<string> {
  const rows = await dbQuery<{ id: string }>(
    `INSERT INTO messages (user_id, content, created_at)
     VALUES ($1, $2, now() - ($3::text || ' hours')::interval)
     RETURNING id`,
    [userId, content, hoursAgo],
  );

  return rows[0].id;
}

async function createComment(messageId: string, userId: string, content: string): Promise<void> {
  await dbExec(
    `INSERT INTO comments (message_id, user_id, content)
     VALUES ($1, $2, $3)`,
    [messageId, userId, content],
  );
}

test.beforeEach(async () => {
  await dbExec('TRUNCATE TABLE messages CASCADE');
});

test('muro vacío devuelve server_time y lista vacía', async ({ request }) => {
  const response = await request.get('/api/wall');
  expect(response.status()).toBe(200);

  const body = (await response.json()) as WallResponse;
  expect(body.items).toEqual([]);
  expect(typeof body.server_time).toBe('string');
  expect(Number.isNaN(Date.parse(body.server_time))).toBe(false);
});

test('ordena por comentarios y marca el héroe', async ({ request }) => {
  const [alice, bob, carol] = await Promise.all([
    createUser('alice'),
    createUser('bob'),
    createUser('carol'),
  ]);

  const topId = await createMessage(alice.id, 'Top message', 0);
  const secondId = await createMessage(bob.id, 'Second message', 1);
  await createMessage(carol.id, 'Third message', 2);

  await createComment(topId, bob.id, 'Bob on top');
  await createComment(topId, carol.id, 'Carol on top');
  await createComment(secondId, alice.id, 'Alice on second');

  const response = await request.get('/api/wall');
  expect(response.status()).toBe(200);

  const body = (await response.json()) as WallResponse;
  expect(body.items).toHaveLength(3);
  expect(body.items[0]).toMatchObject({
    content: 'Top message',
    author: alice.username,
    comments_count: 2,
    is_top: true,
  });
  expect(body.items[1]).toMatchObject({
    content: 'Second message',
    author: bob.username,
    comments_count: 1,
    is_top: false,
  });
  expect(body.items[2]).toMatchObject({
    content: 'Third message',
    author: carol.username,
    comments_count: 0,
    is_top: false,
  });

  for (const item of body.items) {
    expect(item).not.toHaveProperty('email');
    expect(item).not.toHaveProperty('password_hash');
    expect(item).not.toHaveProperty('content_hash');
  }
});

test('sin comentarios no hay héroe y ordena por fecha', async ({ request }) => {
  const [alice, bob] = await Promise.all([createUser('alice'), createUser('bob')]);

  await createMessage(alice.id, 'Older no comments', 2);
  await createMessage(bob.id, 'Newer no comments', 1);

  const response = await request.get('/api/wall');
  expect(response.status()).toBe(200);

  const body = (await response.json()) as WallResponse;
  expect(body.items).toHaveLength(2);
  expect(body.items[0]).toMatchObject({
    content: 'Newer no comments',
    comments_count: 0,
    is_top: false,
  });
  expect(body.items[1]).toMatchObject({
    content: 'Older no comments',
    comments_count: 0,
    is_top: false,
  });
});

test('empate de comentarios: gana el más reciente', async ({ request }) => {
  const [alice, bob, carol] = await Promise.all([
    createUser('alice'),
    createUser('bob'),
    createUser('carol'),
  ]);

  const olderId = await createMessage(alice.id, 'Tie older', 2);
  const newerId = await createMessage(bob.id, 'Tie newer', 1);

  await createComment(olderId, carol.id, 'Carol on older');
  await createComment(newerId, carol.id, 'Carol on newer');

  const response = await request.get('/api/wall');
  expect(response.status()).toBe(200);

  const body = (await response.json()) as WallResponse;
  expect(body.items).toHaveLength(2);
  expect(body.items[0]).toMatchObject({
    content: 'Tie newer',
    comments_count: 1,
    is_top: true,
  });
  expect(body.items[1]).toMatchObject({
    content: 'Tie older',
    comments_count: 1,
    is_top: false,
  });
});

test('excluye vencidos y el detalle devuelve comentarios', async ({ request }) => {
  const [alice, bob, carol] = await Promise.all([
    createUser('alice'),
    createUser('bob'),
    createUser('carol'),
  ]);

  const activeId = await createMessage(alice.id, 'Active message', 0);
  const expiredId = await createMessage(bob.id, 'Expired message', 25);
  await createComment(activeId, carol.id, 'Comment on active');

  const wall = await request.get('/api/wall');
  expect(wall.status()).toBe(200);

  const wallBody = (await wall.json()) as WallResponse;
  expect(wallBody.items).toHaveLength(1);
  expect(wallBody.items[0]).toMatchObject({
    id: Number(activeId),
    content: 'Active message',
    comments_count: 1,
    is_top: true,
  });

  const detail = await request.get(`/api/messages/${activeId}`);
  expect(detail.status()).toBe(200);

  const message = (await detail.json()) as MessageDetail;
  expect(message).toMatchObject({
    id: Number(activeId),
    content: 'Active message',
    author: alice.username,
    comments_count: 1,
  });
  expect(message.comments).toHaveLength(1);
  expect(message.comments[0]).toMatchObject({
    content: 'Comment on active',
    author: carol.username,
  });
  expect(message).not.toHaveProperty('email');
  expect(message).not.toHaveProperty('password_hash');
  expect(message.comments[0]).not.toHaveProperty('email');

  const expired = await request.get(`/api/messages/${expiredId}`);
  expect(expired.status()).toBe(410);
  expect((await expired.json()).code).toBe('message_gone');

  const missing = await request.get('/api/messages/999999999');
  expect(missing.status()).toBe(410);

  const invalid = await request.get('/api/messages/abc');
  expect(invalid.status()).toBe(410);
});
