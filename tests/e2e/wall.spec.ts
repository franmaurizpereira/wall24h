import { expect, test } from '@playwright/test';
import { createMessageForUser, createUserDirect, dbExec, truncateMessages } from '../helpers/api';

test.describe('muro público', () => {
  test.beforeEach(async () => {
    await truncateMessages();
  });

  test('muestra el héroe, el grid y el countdown', async ({ page }) => {
    const topAuthor = await createUserDirect('hero_author');
    const secondAuthor = await createUserDirect('grid_author');
    const thirdAuthor = await createUserDirect('grid_author_2');
    const firstCommenter = await createUserDirect('commenter_a');
    const secondCommenter = await createUserDirect('commenter_b');

    const topId = await createMessageForUser(topAuthor.id, 'Mensaje héroe con dos comentarios');
    const secondId = await createMessageForUser(
      secondAuthor.id,
      'Segundo mensaje con un comentario',
    );
    await createMessageForUser(thirdAuthor.id, 'Tercer mensaje sin comentarios');

    await dbExec(
      `INSERT INTO comments (message_id, user_id, content)
       VALUES ($1, $2, $3), ($1, $4, $5)`,
      [topId, firstCommenter.id, 'Comentario uno', secondCommenter.id, 'Comentario dos'],
    );
    await dbExec(
      `INSERT INTO comments (message_id, user_id, content)
       VALUES ($1, $2, $3)`,
      [secondId, firstCommenter.id, 'Comentario del segundo mensaje'],
    );

    await page.goto('/');
    await expect(page.getByTestId('wall')).toBeVisible();

    const top = page.getByTestId('top-message');
    await expect(top).toContainText('Mensaje héroe con dos comentarios');
    await expect(top.getByTestId('comment-count')).toHaveText('2 comentarios');
    await expect(top.getByTestId('countdown')).toContainText(/\d+[hms]/);

    const grid = page.getByTestId('wall-grid');
    await expect(grid.getByTestId('message-card')).toHaveCount(2);
    await expect(grid).toContainText('Segundo mensaje con un comentario');
    await expect(grid).toContainText('Tercer mensaje sin comentarios');
  });

  test('muestra el estado vacío', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('empty-state')).toBeVisible();
    await expect(page.getByTestId('wall')).toHaveCount(0);
  });

  test('muestra el estado de carga mientras espera la API', async ({ page }) => {
    await page.route('**/api/wall', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });

    await page.goto('/');
    await expect(page.getByTestId('wall-loading')).toBeVisible();
    await expect(page.getByTestId('empty-state')).toBeVisible({ timeout: 5000 });
  });

  test('muestra el estado de error si la API falla', async ({ page }) => {
    await page.route('**/api/wall', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'internal_error', message: 'Error interno' }),
      }),
    );

    await page.goto('/');
    await expect(page.getByTestId('wall-error')).toBeVisible();
    await expect(page.getByTestId('wall-error')).toContainText('No se pudo cargar el muro');
  });
});
