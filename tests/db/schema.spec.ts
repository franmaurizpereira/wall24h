import { expect, test } from '@playwright/test';
import pg from 'pg';

test('wall_test tiene el esquema base aplicado', async () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  expect(connectionString, 'TEST_DATABASE_URL debe estar definido').toBeTruthy();

  const pool = new pg.Pool({ connectionString });
  try {
    const { rows } = await pool.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
       ORDER BY table_name`,
    );

    const tables = rows.map((row) => row.table_name);
    expect(tables).toEqual(
      expect.arrayContaining(['users', 'sessions', 'messages', 'comments', 'reports']),
    );
  } finally {
    await pool.end();
  }
});
