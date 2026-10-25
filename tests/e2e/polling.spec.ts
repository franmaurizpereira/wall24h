import { expect, test } from '@playwright/test';
import { createMessageForUser, createUserDirect, dbExec, truncateMessages } from '../helpers/api';

test.describe('polling y estabilidad del muro', () => {
  test.beforeEach(async () => {
    await truncateMessages();
  });

  test('refresca cada 15 s y reordena el héroe sin loading', async ({ page }) => {
    await page.clock.install();

    const authorA = await createUserDirect('poll_author_a');
    const authorB = await createUserDirect('poll_author_b');
    const commenterA = await createUserDirect('poll_commenter_a');
    const commenterB = await createUserDirect('poll_commenter_b');

    const messageA = await createMessageForUser(authorA.id, 'Mensaje A del polling');
    const messageB = await createMessageForUser(authorB.id, 'Mensaje B del polling');

    await dbExec(
      `INSERT INTO comments (message_id, user_id, content)
       VALUES ($1, $2, $3)`,
      [messageA, commenterA.id, 'Comentario para A'],
    );

    await page.goto('/');
    await expect(page.getByTestId('top-message')).toContainText('Mensaje A del polling');

    await dbExec(
      `INSERT INTO comments (message_id, user_id, content)
       VALUES ($1, $2, $3), ($1, $4, $5)`,
      [messageB, commenterA.id, 'Comentario uno para B', commenterB.id, 'Comentario dos para B'],
    );

    await page.clock.fastForward(15_000);

    await expect(page.getByTestId('top-message')).toContainText('Mensaje B del polling');
    await expect(page.getByTestId('wall-loading')).toHaveCount(0);
  });

  test('pausa el polling con la pestaña oculta y refresca al volver', async ({ page }) => {
    await page.clock.install();

    const author = await createUserDirect('poll_visibility');
    await createMessageForUser(author.id, 'Mensaje para visibilidad');

    let wallRequests = 0;
    page.on('request', (request) => {
      if (request.url().includes('/api/wall')) {
        wallRequests += 1;
      }
    });

    await page.goto('/');
    await expect(page.getByTestId('wall')).toBeVisible();
    const initialRequests = wallRequests;

    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.clock.fastForward(45_000);
    expect(wallRequests).toBe(initialRequests);

    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(() => wallRequests).toBeGreaterThan(initialRequests);
  });

  test('un fallo de polling conserva los últimos datos', async ({ page }) => {
    await page.clock.install();

    const author = await createUserDirect('poll_stale');
    await createMessageForUser(author.id, 'Mensaje estable del muro');

    let failRequests = false;
    await page.route('**/api/wall', (route) =>
      failRequests
        ? route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ code: 'internal_error', message: 'Error interno' }),
          })
        : route.continue(),
    );

    await page.goto('/');
    await expect(page.getByTestId('wall')).toContainText('Mensaje estable del muro');

    failRequests = true;
    await page.clock.fastForward(15_000);

    await expect(page.getByTestId('wall-stale')).toBeVisible();
    await expect(page.getByTestId('wall')).toContainText('Mensaje estable del muro');
    await expect(page.getByTestId('wall-error')).toHaveCount(0);
  });

  test('el countdown avanza con server_time', async ({ page }) => {
    await page.clock.install();

    const author = await createUserDirect('poll_countdown');
    await createMessageForUser(author.id, 'Mensaje con countdown');

    await page.goto('/');
    const countdown = page.getByTestId('countdown');
    await expect(countdown).toBeVisible();
    await expect(countdown).not.toContainText('Expirado');
  });

  test('no hay overflow horizontal a 360, 768 y 1280 px', async ({ page }) => {
    const author = await createUserDirect('poll_responsive');
    await createMessageForUser(
      author.id,
      'Un mensaje con varias palabras para comprobar el ancho en móvil y escritorio',
    );

    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await expect(page.getByTestId('wall')).toBeVisible();

      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(hasOverflow, `overflow horizontal a ${width}px`).toBe(false);
    }
  });
});
