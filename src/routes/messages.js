import { z } from 'zod';
import { query, queryWithRetry } from '../db.js';
import { requireUser } from '../lib/auth.js';
import { httpError, mapDbError } from '../lib/errors.js';
import { moderate } from '../lib/moderation.js';
import { writeRateLimit } from '../lib/security.js';

const toIso = (value) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const createMessageSchema = z.object({
  text: z.string().trim().min(1).max(500),
});

const createCommentSchema = z.object({
  text: z.string().trim().min(1).max(300),
});

export default async function messageRoutes(app) {
  app.post(
    '/messages',
    { preHandler: requireUser, config: writeRateLimit(10) },
    async (request, reply) => {
      const { text } = createMessageSchema.parse(request.body);
      await moderate(text);

      try {
        const { rows } = await queryWithRetry(
          `INSERT INTO messages (user_id, content)
           VALUES ($1, $2)
           RETURNING id, created_at, expires_at`,
          [request.user.id, text],
        );

        const message = rows[0];
        return reply.code(201).send({
          id: Number(message.id),
          created_at: toIso(message.created_at),
          expires_at: toIso(message.expires_at),
        });
      } catch (error) {
        throw mapDbError(error);
      }
    },
  );

  app.post(
    '/messages/:id/comments',
    { preHandler: requireUser, config: writeRateLimit(20) },
    async (request, reply) => {
      const id = Number(request.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw httpError(410, 'message_gone', 'Este mensaje ya expiró');
      }

      const { text } = createCommentSchema.parse(request.body);
      await moderate(text);

      try {
        const { rows } = await queryWithRetry(
          `INSERT INTO comments (message_id, user_id, content)
           VALUES ($1, $2, $3)
           RETURNING id, created_at`,
          [id, request.user.id, text],
        );

        const comment = rows[0];
        return reply.code(201).send({
          id: Number(comment.id),
          created_at: toIso(comment.created_at),
        });
      } catch (error) {
        throw mapDbError(error);
      }
    },
  );

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
       WHERE m.id = $1 AND m.expires_at > now() AND m.hidden_at IS NULL`,
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
