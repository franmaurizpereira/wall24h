import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });

async function createUser(prefix: string): Promise<{ id: string }> {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 8);
  const username = `${prefix}_${suffix}`;
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (username, email, password_hash)
     VALUES ($1, $2, 'fixture')
     RETURNING id`,
    [username, `${username}@example.com`],
  );

  return { id: rows[0].id };
}

async function createMessage(
  userId: string,
  content: string,
  hoursAgo = 0,
): Promise<number> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO messages (user_id, content, created_at)
     VALUES ($1, $2, now() - ($3::text || ' hours')::interval)
     RETURNING id`,
    [userId, content, hoursAgo],
  );

  return Number(rows[0].id);
}

async function createMessageExpiringIn(
  userId: string,
  content: string,
  seconds: number,
): Promise<number> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO messages (user_id, content, created_at)
     VALUES ($1, $2, now() - interval '24 hours' + ($3::text || ' seconds')::interval)
     RETURNING id`,
    [userId, content, seconds],
  );

  return Number(rows[0].id);
}

function tokenHash(): string {
  return `${randomUUID().replace(/-/g, '')}${randomUUID().replace(/-/g, '')}`;
}

test.beforeEach(async () => {
  await pool.query('TRUNCATE TABLE messages CASCADE');
});

test.afterAll(async () => {
  await pool.end();
});

test('el muro y el detalle ocultan mensajes vencidos antes de la purga', async ({
  request,
}) => {
  const activeAuthor = await createUser('activeauthor');
  const expiredAuthor = await createUser('expiredauthor');

  const activeId = await createMessage(activeAuthor.id, 'Active before purge', 0);
  const expiredId = await createMessage(expiredAuthor.id, 'Expired before purge', 25);

  const wall = await request.get('/api/wall');
  expect(wall.status()).toBe(200);
  const wallBody = (await wall.json()) as {
    items: Array<{ id: number; content: string }>;
  };

  expect(wallBody.items).toHaveLength(1);
  expect(wallBody.items[0]).toMatchObject({
    id: activeId,
    content: 'Active before purge',
  });

  const activeDetail = await request.get(`/api/messages/${activeId}`);
  expect(activeDetail.status()).toBe(200);

  const expiredDetail = await request.get(`/api/messages/${expiredId}`);
  expect(expiredDetail.status()).toBe(410);
  expect((await expiredDetail.json()).code).toBe('message_gone');
});

test('la purga borra mensajes, comentarios, reportes y sesiones vencidas', async () => {
  const author = await createUser('purgeauthor');
  const commenter = await createUser('purgecommenter');
  const reporter = await createUser('purgereporter');

  const messageId = await createMessageExpiringIn(author.id, 'Expiring soon', 3);

  await pool.query(
    `INSERT INTO comments (message_id, user_id, content)
     VALUES ($1, $2, $3)`,
    [messageId, commenter.id, 'Comment to cascade'],
  );
  await pool.query(
    `INSERT INTO reports (message_id, reporter_id, reason)
     VALUES ($1, $2, $3)`,
    [messageId, reporter.id, 'Reason to cascade'],
  );

  await new Promise((resolve) => setTimeout(resolve, 3_500));

  const { rows: beforePurge } = await pool.query<{ count: number }>(
    'SELECT count(*)::int AS count FROM messages WHERE id = $1',
    [messageId],
  );
  expect(beforePurge[0]?.count).toBe(1);

  const { rows: purgeResult } = await pool.query<{ count: number }>(
    'SELECT public.purge_expired_messages() AS count',
  );
  expect(purgeResult[0]?.count).toBeGreaterThanOrEqual(1);

  const { rows: messageAfter } = await pool.query<{ count: number }>(
    'SELECT count(*)::int AS count FROM messages WHERE id = $1',
    [messageId],
  );
  expect(messageAfter[0]?.count).toBe(0);

  const { rows: commentsAfter } = await pool.query<{ count: number }>(
    'SELECT count(*)::int AS count FROM comments WHERE message_id = $1',
    [messageId],
  );
  expect(commentsAfter[0]?.count).toBe(0);

  const { rows: reportsAfter } = await pool.query<{ count: number }>(
    'SELECT count(*)::int AS count FROM reports WHERE message_id = $1',
    [messageId],
  );
  expect(reportsAfter[0]?.count).toBe(0);

  const expiredToken = tokenHash();
  const activeToken = tokenHash();

  await pool.query(
    `INSERT INTO sessions (token_hash, user_id, created_at, expires_at)
     VALUES ($1, $2, now() - interval '8 days', now() - interval '1 day')`,
    [expiredToken, author.id],
  );
  await pool.query(
    `INSERT INTO sessions (token_hash, user_id, created_at, expires_at)
     VALUES ($1, $2, now(), now() + interval '7 days')`,
    [activeToken, author.id],
  );

  const { rows: sessionsPurged } = await pool.query<{ count: number }>(
    'SELECT public.purge_expired_sessions() AS count',
  );
  expect(sessionsPurged[0]?.count).toBeGreaterThanOrEqual(1);

  const { rows: expiredSession } = await pool.query<{ count: number }>(
    'SELECT count(*)::int AS count FROM sessions WHERE token_hash = $1',
    [expiredToken],
  );
  expect(expiredSession[0]?.count).toBe(0);

  const { rows: activeSession } = await pool.query<{ count: number }>(
    'SELECT count(*)::int AS count FROM sessions WHERE token_hash = $1',
    [activeToken],
  );
  expect(activeSession[0]?.count).toBe(1);
});
