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

export async function queryWithRetry(text, params, attempts = 2) {
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await query(text, params);
    } catch (error) {
      lastError = error;
      if (error.code !== '40P01' && error.code !== '40001') {
        throw error;
      }
    }
  }

  throw lastError;
}

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* la transacción ya estaba abortada */
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  await pool.end();
}
