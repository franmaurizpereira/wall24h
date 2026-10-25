import { z } from 'zod';
import { query } from '../db.js';
import { requireUser } from '../lib/auth.js';
import { httpError, mapDbError } from '../lib/errors.js';
import { moderate } from '../lib/moderation.js';

const reportSchema = z.object({
  reason: z.string().trim().min(5).max(500),
});

export default async function reportRoutes(app) {
  app.post('/messages/:id/report', { preHandler: requireUser }, async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw httpError(410, 'message_gone', 'Este mensaje ya expiró');
    }

    const { reason } = reportSchema.parse(request.body);
    await moderate(reason);

    try {
      const { rows } = await query(
        `INSERT INTO reports (message_id, reporter_id, reason)
         VALUES ($1, $2, $3)
         RETURNING status`,
        [id, request.user.id, reason],
      );

      return reply.code(201).send({ ok: true, status: rows[0].status });
    } catch (error) {
      throw mapDbError(error);
    }
  });
}
