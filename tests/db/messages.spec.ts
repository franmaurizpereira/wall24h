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

test.beforeEach(async () => {
  await pool.query('TRUNCATE TABLE messages CASCADE');
});

test.afterAll(async () => {
  await pool.end();
});

test('la BD impide dos mensajes activos del mismo usuario', async () => {
  const user = await createUser('dbrace');
  const clientA = await pool.connect();
  const clientB = await pool.connect();

  try {
    const results = await Promise.allSettled([
      clientA.query(
        `INSERT INTO messages (user_id, content)
         VALUES ($1, $2)
         RETURNING id`,
        [user.id, 'DB race one'],
      ),
      clientB.query(
        `INSERT INTO messages (user_id, content)
         VALUES ($1, $2)
         RETURNING id`,
        [user.id, 'DB race two'],
      ),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const error = (rejected[0] as PromiseRejectedResult).reason as {
      code?: string;
      constraint?: string;
    };
    // Un deadlock también deja un único ganador; la API reintenta 40P01.
    expect(['23P01', '40P01']).toContain(error.code);
    if (error.code === '23P01') {
      expect(error.constraint).toBe('uq_messages_active_per_user');
    }
  } finally {
    clientA.release();
    clientB.release();
  }
});

test('la BD impide el mismo contenido activo entre usuarios', async () => {
  const first = await createUser('dbdupa');
  const second = await createUser('dbdupb');
  const clientA = await pool.connect();
  const clientB = await pool.connect();

  try {
    const results = await Promise.allSettled([
      clientA.query(
        `INSERT INTO messages (user_id, content)
         VALUES ($1, $2)
         RETURNING id`,
        [first.id, '  Contenido Dup  '],
      ),
      clientB.query(
        `INSERT INTO messages (user_id, content)
         VALUES ($1, $2)
         RETURNING id`,
        [second.id, 'contenido dup'],
      ),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const error = (rejected[0] as PromiseRejectedResult).reason as {
      code?: string;
      constraint?: string;
    };
    // Un deadlock también deja un único ganador; la API reintenta 40P01.
    expect(['23P01', '40P01']).toContain(error.code);
    if (error.code === '23P01') {
      expect(error.constraint).toBe('uq_messages_active_no_duplicates');
    }
  } finally {
    clientA.release();
    clientB.release();
  }
});
