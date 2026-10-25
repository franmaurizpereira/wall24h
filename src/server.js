import { buildApp } from './app.js';
import { closePool } from './db.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

const app = await buildApp();

const shutdown = async (signal) => {
  app.log.info({ signal }, 'Shutting down');
  try {
    await app.close();
    await closePool();
    process.exit(0);
  } catch (error) {
    app.log.error({ err: error }, 'Shutdown failed');
    process.exit(1);
  }
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

try {
  await app.listen({ port, host });
  app.log.info({ port, host }, 'wall24h listening');
} catch (error) {
  app.log.error({ err: error }, 'Failed to start');
  await closePool();
  process.exit(1);
}
