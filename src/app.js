import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { ZodError } from 'zod';
import { ApiError, mapDbError } from './lib/errors.js';
import authRoutes from './routes/auth.js';
import healthRoutes from './routes/health.js';
import messageRoutes from './routes/messages.js';
import reportRoutes from './routes/reports.js';
import wallRoutes from './routes/wall.js';

const webDist = path.resolve(fileURLToPath(new URL('../web/dist', import.meta.url)));

export async function buildApp(options = {}) {
  const app = Fastify({
    logger: options.logger ?? {
      level: process.env.LOG_LEVEL ?? 'info',
      redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
    },
    ...options,
  });

  await app.register(cookie);
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, { global: false });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(422).send({
        code: 'invalid_input',
        message: 'Datos inválidos',
        issues: error.issues,
      });
    }

    const mapped = mapDbError(error);
    if (mapped instanceof ApiError) {
      return reply.code(mapped.status).send({
        code: mapped.code,
        message: mapped.message,
        ...(mapped.details ? { issues: mapped.details } : {}),
      });
    }

    if (error.statusCode && error.statusCode < 500) {
      return reply.code(error.statusCode).send({
        code: error.code ?? 'bad_request',
        message: error.message,
      });
    }

    request.log.error({ err: error }, 'Unhandled request error');
    return reply.code(500).send({
      code: 'internal_error',
      message: 'Error interno',
    });
  });

  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(wallRoutes, { prefix: '/api' });
  await app.register(messageRoutes, { prefix: '/api' });
  await app.register(reportRoutes, { prefix: '/api' });

  if (existsSync(webDist)) {
    await app.register(fastifyStatic, {
      root: webDist,
      prefix: '/',
    });
  }

  app.setNotFoundHandler((request, reply) => {
    const acceptsHtml = request.headers.accept?.includes('text/html');
    if (
      request.raw.method === 'GET' &&
      acceptsHtml &&
      existsSync(path.join(webDist, 'index.html'))
    ) {
      return reply.sendFile('index.html');
    }

    return reply.code(404).send({
      code: 'not_found',
      message: 'Ruta no encontrada',
    });
  });

  return app;
}
