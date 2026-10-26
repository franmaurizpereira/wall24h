import { createHash } from 'node:crypto';
import { httpError } from './errors.js';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

export function isMutatingMethod(method) {
  return MUTATING_METHODS.has(String(method).toUpperCase());
}

function normalizeOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function configuredOrigins() {
  const explicit = (process.env.APP_ORIGIN ?? '')
    .split(',')
    .map((value) => normalizeOrigin(value.trim()))
    .filter(Boolean);

  const dev = process.env.NODE_ENV === 'production' ? [] : DEV_ORIGINS;

  return new Set([...explicit, ...dev]);
}

function forwardedHost(request) {
  const forwarded = request.headers['x-forwarded-host'];
  if (typeof forwarded === 'string' && forwarded.trim() !== '') {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.host;
}

/**
 * Permite peticiones sin Origin (curl, clientes) y same-origin. Rechaza
 * orígenes explícitos que no estén en APP_ORIGIN ni coincidan con el host.
 */
export function isAllowedOrigin(origin, request) {
  if (!origin) {
    return true;
  }

  if (origin === 'null') {
    return false;
  }

  const parsed = normalizeOrigin(origin);
  if (!parsed) {
    return false;
  }

  const host = forwardedHost(request);
  if (host && new URL(parsed).host === host) {
    return true;
  }

  return configuredOrigins().has(parsed);
}

export function assertAllowedOrigin(request) {
  if (!isMutatingMethod(request.method)) {
    return;
  }

  if (!isAllowedOrigin(request.headers.origin, request)) {
    throw httpError(403, 'invalid_origin', 'Origen no permitido');
  }
}

/**
 * Clave de rate limit por sesión (hash del token) o IP si es anónimo. Incluye
 * la ruta para que los límites de escritura no compartan cubo.
 */
export function rateLimitKey(request) {
  const token = request.cookies?.session;
  const identity = token
    ? `session:${createHash('sha256').update(token).digest('hex')}`
    : `ip:${request.ip}`;

  return `${request.routeOptions?.url ?? 'route'}:${identity}`;
}

export function writeRateLimit(max) {
  return {
    rateLimit: {
      max,
      timeWindow: '1 minute',
      keyGenerator: rateLimitKey,
    },
  };
}

/**
 * Objeto apto para logs: nunca incluye mensaje, stack, query, parámetros,
 * contenido de usuario ni secretos.
 */
export function safeErrorForLog(error) {
  return {
    name: typeof error?.name === 'string' ? error.name : 'Error',
    code: typeof error?.code === 'string' ? error.code : undefined,
    constraint: typeof error?.constraint === 'string' ? error.constraint : undefined,
    statusCode: typeof error?.statusCode === 'number' ? error.statusCode : undefined,
  };
}
