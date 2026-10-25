import { query } from '../db.js';

export default async function healthRoutes(app) {
  app.get('/healthz', async (request, reply) => {
    try {
      await query('SELECT 1');
      return { status: 'ok', db: 'ok' };
    } catch (error) {
      request.log.error({ err: error }, 'Healthcheck failed');
      return reply.code(503).send({ status: 'error', db: 'error' });
    }
  });
}
