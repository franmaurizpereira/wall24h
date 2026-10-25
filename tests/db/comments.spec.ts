import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import pg from 'pg';

type PgError = {
  code?: string;
  constraint?: string;
  message?: string;
};

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

test.beforeEach(async () => {
  await pool.query('TRUNCATE TABLE messages CASCADE');
});

test.afterAll(async () => {
  await pool.end();
});

test('la BD impide dos comentarios del mismo usuario y mensaje', async () => {
  const author = await createUser('dbauthor');
  const commenter = await createUser('dbcommenter');
  const messageId = await createMessage(author.id, 'DB comment target');
  const clientA = await pool.connect();
  const clientB = await pool.connect();

  try {
    const results = await Promise.allSettled([
      clientA.query(
        `INSERT INTO comments (message_id, user_id, content)
         VALUES ($1, $2, $3)`,
        [messageId, commenter.id, 'DB comment one'],
      ),
      clientB.query(
        `INSERT INTO comments (message_id, user_id, content)
         VALUES ($1, $2, $3)`,
        [messageId, commenter.id, 'DB comment two'],
      ),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const error = (rejected[0] as PromiseRejectedResult).reason as PgError;
    expect(error.code).toBe('23505');
    expect(error.constraint).toBe('uq_comments_one_per_user_message');

    const { rows } = await pool.query<{ comments_count: number }>(
      'SELECT comments_count FROM messages WHERE id = $1',
      [messageId],
    );
    expect(rows[0]?.comments_count).toBe(1);
  } finally {
    clientA.release();
    clientB.release();
  }
});

test('la BD impide comentar el propio mensaje', async () => {
  const author = await createUser('dbown');
  const messageId = await createMessage(author.id, 'DB own target');

  let error: PgError | null = null;
  try {
    await pool.query(
      `INSERT INTO comments (message_id, user_id, content)
       VALUES ($1, $2, $3)`,
      [messageId, author.id, 'Own comment'],
    );
  } catch (caught) {
    error = caught as PgError;
  }

  expect(error?.code).toBe('P0001');
  expect(error?.message).toBe('cannot_comment_on_own_message');
});

test('la BD impide comentar mensajes vencidos', async () => {
  const author = await createUser('dbexpiredauthor');
  const commenter = await createUser('dbexpiredcommenter');
  const messageId = await createMessage(author.id, 'DB expired target', 25);

  let error: PgError | null = null;
  try {
    await pool.query(
      `INSERT INTO comments (message_id, user_id, content)
       VALUES ($1, $2, $3)`,
      [messageId, commenter.id, 'Too late'],
    );
  } catch (caught) {
    error = caught as PgError;
  }

  expect(error?.code).toBe('EC001');
  expect(error?.message).toBe('message_gone');
});
