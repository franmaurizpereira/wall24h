import { expect, test } from '@playwright/test';

test('GET /healthz responde 200 y la base de datos está disponible', async ({ request }) => {
  const response = await request.get('/healthz');

  expect(response.status()).toBe(200);
  expect(response.ok()).toBeTruthy();

  const body = await response.json();
  expect(body).toMatchObject({ status: 'ok', db: 'ok' });
});
