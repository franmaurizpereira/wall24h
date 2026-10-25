import { expect, test as setup } from '@playwright/test';
import pg from 'pg';

setup('stack de test disponible', async ({ request }) => {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  expect(testDatabaseUrl, 'TEST_DATABASE_URL debe estar definido').toBeTruthy();

  const pool = new pg.Pool({ connectionString: testDatabaseUrl });
  try {
    const { rows } = await pool.query<{ count: number }>(
      `SELECT count(*)::int AS count
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'messages'`,
    );
    expect(rows[0]?.count, 'wall_test debe tener el esquema aplicado').toBe(1);
  } finally {
    await pool.end();
  }

  await expect
    .poll(
      async () => {
        const response = await request.get('/healthz').catch(() => null);
        return response?.status() ?? 0;
      },
      {
        message: 'app-test debe responder /healthz',
        timeout: 60_000,
        intervals: [500, 1_000, 2_000, 5_000],
      },
    )
    .toBe(200);
});
