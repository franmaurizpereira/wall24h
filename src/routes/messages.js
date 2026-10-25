import { query } from '../db.js';
import { httpError } from '../lib/errors.js';

const toIso = (value) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

export default async function messageRoutes(app) {
  app.get('/messages/:id', async (request) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw httpError(410, 'message_gone', 'Este mensaje ya expiró');
    }

    const { rows } = await query(
      `SELECT m.id,
              m.content,
              m.created_at,
              m.expires_at,
              m.comments_count,
              u.username AS author
       FROM messages m
       JOIN users u ON u.id = m.user_id
       WHERE m.id = $1 AND m.expires_at > now()`,
      [id],
    );

    const message = rows[0];
    if (!message) {
      throw httpError(410, 'message_gone', 'Este mensaje ya expiró');
    }

    const { rows: comments } = await query(
      `SELECT c.id,
              c.content,
              c.created_at,
              u.username AS author
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.message_id = $1
       ORDER BY c.created_at ASC`,
      [id],
    );

    return {
      id: Number(message.id),
      content: message.content,
      author: message.author,
      created_at: toIso(message.created_at),
      expires_at: toIso(message.expires_at),
      comments_count: message.comments_count,
      comments: comments.map((comment) => ({
        id: Number(comment.id),
        content: comment.content,
        author: comment.author,
        created_at: toIso(comment.created_at),
      })),
    };
  });
}
