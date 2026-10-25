import { query } from '../db.js';

const toIso = (value) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

export default async function wallRoutes(app) {
  app.get('/wall', async () => {
    const { rows } = await query(
      `SELECT m.id,
              m.content,
              m.created_at,
              m.expires_at,
              m.comments_count,
              u.username AS author,
              now() AS server_time
       FROM messages m
       JOIN users u ON u.id = m.user_id
       WHERE m.expires_at > now()
       ORDER BY m.comments_count DESC, m.created_at DESC`,
    );

    const serverTime =
      rows[0]?.server_time ?? (await query('SELECT now() AS server_time')).rows[0].server_time;

    const items = rows.map((row, index) => ({
      id: Number(row.id),
      content: row.content,
      author: row.author,
      created_at: toIso(row.created_at),
      expires_at: toIso(row.expires_at),
      comments_count: row.comments_count,
      is_top: index === 0 && row.comments_count > 0,
    }));

    return {
      server_time: toIso(serverTime),
      items,
    };
  });
}
