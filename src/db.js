import pg from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

export const pool = new pg.Pool({
  connectionString,
  max: Number(process.env.PGPOOL_MAX ?? 10),
});

export const query = (text, params) => pool.query(text, params);

export async function closePool() {
  await pool.end();
}
