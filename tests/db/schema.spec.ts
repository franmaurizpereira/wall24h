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

    const { rows: columns } = await pool.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND (
           (table_name = 'messages' AND column_name IN ('hidden_at', 'hidden_by'))
           OR (table_name = 'reports' AND column_name IN ('reviewed_at', 'reviewed_by'))
         )`,
    );

    expect(columns).toEqual(
      expect.arrayContaining([
        { table_name: 'messages', column_name: 'hidden_at' },
        { table_name: 'messages', column_name: 'hidden_by' },
        { table_name: 'reports', column_name: 'reviewed_at' },
        { table_name: 'reports', column_name: 'reviewed_by' },
      ]),
    );
  } finally {
    await pool.end();
  }
});
