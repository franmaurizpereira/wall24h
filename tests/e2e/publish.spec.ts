import { expect, test } from '@playwright/test';
import { createMessageForUser, createUserDirect, truncateMessages } from '../helpers/api';
import { loginAsNewUser } from '../helpers/ui';

test.describe('publicación desde el muro', () => {
  test.beforeEach(async () => {
    await truncateMessages();
  });

  test('publica un mensaje y bloquea un segundo mensaje activo', async ({ page }) => {
    await loginAsNewUser(page, 'publish_user');

    await page.getByTestId('open-publish').click();
    await expect(page.getByTestId('publish-dialog')).toBeVisible();
    await page.getByTestId('publish-submit').click();
    await expect(page.getByTestId('publish-error')).toContainText('Escribe un mensaje');

    await page.getByTestId('publish-text').fill('Mi primer mensaje efímero');
    await page.getByTestId('publish-submit').click();

    await expect(page.getByTestId('publish-dialog')).not.toBeVisible();
    await expect(page.getByTestId('toast')).toContainText('Mensaje publicado');
    await expect(page.getByTestId('wall')).toContainText('Mi primer mensaje efímero');

    await page.getByTestId('open-publish').click();
    await page.getByTestId('publish-text').fill('Un segundo mensaje');
    await page.getByTestId('publish-submit').click();

    await expect(page.getByTestId('publish-error')).toContainText('Ya tienes un mensaje activo');
    await expect(page.getByTestId('publish-dialog')).toBeVisible();
  });

  test('rechaza contenido duplicado de otra persona', async ({ page }) => {
    const author = await createUserDirect('duplicate_author');
    await createMessageForUser(author.id, 'Texto ya publicado');

    await loginAsNewUser(page, 'duplicate_user');
    await page.getByTestId('open-publish').click();
    await page.getByTestId('publish-text').fill('Texto ya publicado');
    await page.getByTestId('publish-submit').click();

    await expect(page.getByTestId('publish-error')).toContainText('Ese texto ya está publicado');
  });
});
