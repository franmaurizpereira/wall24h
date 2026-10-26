import { expect, test } from '@playwright/test';
import { createMessageForUser, dbExec, dbQuery, truncateMessages } from '../helpers/api';

async function createVisualUser(username: string): Promise<{ id: number }> {
  const rows = await dbQuery<{ id: string }>(
    `INSERT INTO users (username, email, password_hash)
     VALUES ($1, $2, 'fixture-not-a-real-hash')
     RETURNING id`,
    [username, `${username}@example.com`],
  );

  return { id: Number(rows[0].id) };
}

test.describe('regresión visual del muro', () => {
  test.beforeEach(async () => {
    await truncateMessages();
    await dbExec("DELETE FROM users WHERE username LIKE 'visual_%'");

    const luna = await createVisualUser('visual_luna');
    const mateo = await createVisualUser('visual_mateo');
    const sofia = await createVisualUser('visual_sofia');
    const nico = await createVisualUser('visual_nico');

    const hero = await createMessageForUser(
      luna.id,
      'Hay ideas que solo duran un día. Esta es una de ellas.',
    );
    const second = await createMessageForUser(
      mateo.id,
      'La ciudad suena distinta a las siete de la mañana.',
    );
    await createMessageForUser(
      sofia.id,
      'Un mensaje pequeño para probar el muro y el paso del tiempo.',
    );

    await dbExec(
      `INSERT INTO comments (message_id, user_id, content)
       VALUES ($1, $2, 'Esta frase se queda conmigo.'),
              ($1, $3, 'El detalle de las siete de la mañana es real.'),
              ($4, $3, 'La ciudad también suena distinta cuando llueve.')`,
      [hero, sofia.id, nico.id, second],
    );
  });

  for (const width of [360, 768, 1280]) {
    test(`muro a ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await expect(page.getByTestId('top-message')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);

      await expect(page).toHaveScreenshot(`wall-${width}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.01,
        mask: [page.getByTestId('countdown')],
      });
    });
  }
});
