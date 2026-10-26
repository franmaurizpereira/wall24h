import { z } from 'zod';
import { query, queryWithRetry } from '../db.js';
import { requireAdmin } from '../lib/auth.js';
import { httpError } from '../lib/errors.js';
import { writeRateLimit } from '../lib/security.js';

const toIso = (value) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const reportsQuerySchema = z.object({
  status: z.enum(['pending', 'reviewed', 'actioned', 'all']).default('pending'),
});

const reviewSchema = z.object({
  status: z.enum(['reviewed', 'actioned']),
});

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw httpError(404, 'not_found', 'Recurso no encontrado');
  }
  return id;
}

export default async function adminRoutes(app) {
  app.get('/admin/reports', { preHandler: requireAdmin }, async (request) => {
    const { status } = reportsQuerySchema.parse(request.query ?? {});
    const params = [];
    let statusFilter = '';

    if (status !== 'all') {
      params.push(status);
      statusFilter = 'AND r.status = $1::report_status';
    }

    const { rows } = await query(
      `SELECT r.id,
              r.message_id,
              r.reporter_id,
              r.reason,
              r.status,
              r.created_at,
              r.reviewed_at,
              m.content AS message_content,
              m.hidden_at,
              m.expires_at,
              u.username AS author
       FROM reports r
       JOIN messages m ON m.id = r.message_id
       JOIN users u ON u.id = m.user_id
       WHERE true ${statusFilter}
       ORDER BY r.created_at ASC`,
      params,
    );

    return {
      items: rows.map((row) => ({
        id: Number(row.id),
        message_id: Number(row.message_id),
        reporter_id: Number(row.reporter_id),
        reason: row.reason,
        status: row.status,
        created_at: toIso(row.created_at),
        reviewed_at: row.reviewed_at ? toIso(row.reviewed_at) : null,
        message_content: row.message_content,
        message_author: row.author,
        message_hidden: row.hidden_at !== null,
        message_expires_at: toIso(row.expires_at),
      })),
    };
  });

  app.patch(
    '/admin/reports/:id',
    { preHandler: requireAdmin, config: writeRateLimit(30) },
    async (request, reply) => {
      const id = parseId(request.params.id);
      const { status } = reviewSchema.parse(request.body);

      const { rows } = await queryWithRetry(
        `UPDATE reports
         SET status = $1::report_status,
             reviewed_at = now(),
             reviewed_by = $2
         WHERE id = $3
         RETURNING status, reviewed_at`,
        [status, request.user.id, id],
      );

      if (rows.length === 0) {
        throw httpError(404, 'report_not_found', 'Reporte no encontrado');
      }

      return reply.send({
        ok: true,
        status: rows[0].status,
        reviewed_at: toIso(rows[0].reviewed_at),
      });
    },
  );

  app.post(
    '/admin/messages/:id/hide',
    { preHandler: requireAdmin, config: writeRateLimit(30) },
    async (request, reply) => {
      const id = parseId(request.params.id);

      const { rows } = await queryWithRetry(
        `UPDATE messages
         SET hidden_at = now(),
             hidden_by = $1
         WHERE id = $2
           AND hidden_at IS NULL
           AND expires_at > now()
         RETURNING hidden_at`,
        [request.user.id, id],
      );

      if (rows.length === 0) {
        throw httpError(404, 'message_not_found', 'Mensaje no encontrado');
      }

      return reply.send({ ok: true, hidden_at: toIso(rows[0].hidden_at) });
    },
  );
}
