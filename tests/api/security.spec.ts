import { expect, test } from '@playwright/test';
import { baseURL, createSessionContext, uniqueUser } from '../helpers/api';

test.describe('hardening', () => {
  test('envía cabeceras de seguridad y CSP', async ({ request }) => {
    const response = await request.get('/healthz');
    expect(response.status()).toBe(200);

    const headers = response.headers();
    expect(headers['content-security-policy']).toContain("default-src 'self'");
    expect(headers['content-security-policy']).toContain("script-src 'self'");
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBeTruthy();
  });

  test('rechaza mutaciones con Origin no permitido', async () => {
    const { context } = await createSessionContext('origin_bad');
    const response = await context.post('/api/messages', {
      headers: { origin: 'https://evil.example' },
      data: { text: 'Mensaje con origen no permitido' },
    });

    expect(response.status()).toBe(403);
    expect((await response.json()).code).toBe('invalid_origin');
    await context.dispose();
  });

  test('acepta el mismo Origin', async () => {
    const { context } = await createSessionContext('origin_ok');
    const origin = new URL(baseURL).origin;
    const response = await context.post('/api/messages', {
      headers: { origin },
      data: { text: `Mensaje con origen permitido ${uniqueUser('x').username}` },
    });

    expect(response.status()).toBe(201);
    await context.dispose();
  });

  test('aplica rate limit por sesión en escritura', async () => {
    const { context } = await createSessionContext('rate_write');
    const statuses: number[] = [];
    let lastStatus = 0;
    let lastBody: { code?: string } = {};

    for (let attempt = 0; attempt < 11; attempt += 1) {
      const response = await context.post('/api/messages', { data: {} });
      lastStatus = response.status();
      lastBody = (await response.json()) as { code?: string };
      statuses.push(lastStatus);
    }

    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(422));
    expect(lastStatus).toBe(429);
    expect(lastBody.code).toBe('rate_limited');
    await context.dispose();
  });

  test('modera mayúsculas y acentos', async () => {
    const { context } = await createSessionContext('moderate_case');
    const response = await context.post('/api/messages', {
      data: { text: 'CONTENIDO_PROHIBÍDO' },
    });

    expect(response.status()).toBe(422);
    expect((await response.json()).code).toBe('content_not_allowed');
    await context.dispose();
  });
});
