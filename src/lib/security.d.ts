import type { FastifyRequest } from 'fastify';

export function isMutatingMethod(method: string): boolean;
export function isAllowedOrigin(origin: string | undefined, request: FastifyRequest): boolean;
export function assertAllowedOrigin(request: FastifyRequest): void;
export function rateLimitKey(request: FastifyRequest): string;
export function writeRateLimit(max: number): {
  rateLimit: {
    max: number;
    timeWindow: string;
    keyGenerator: (request: FastifyRequest) => string;
  };
};
export function safeErrorForLog(error: unknown): {
  name: string;
  code?: string;
  constraint?: string;
  statusCode?: number;
};
