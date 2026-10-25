import { expect, test } from '@playwright/test';
import { createMessageForUser, createUserDirect, truncateMessages } from '../helpers/api';
import { loginAsNewUser } from '../helpers/ui';

test.describe('detalle y comentarios', () => {
  test.beforeEach(async () => {
    await truncateMessages();
  });

  test('muestra el detalle, publica un comentario y actualiza el contador', async ({ page }) => {
    const author = await createUserDirect('detail_author');
    const messageId = await createMessageForUser(
      author.id,
      'Mensaje para comentar desde el detalle',
    );

    await loginAsNewUser(page, 'detail_user');
    await page.goto(`/messages/${messageId}`);

    await expect(page.getByTestId('message-detail')).toBeVisible();
    await expect(page.getByTestId('detail-comments-count')).toHaveText('0 comentarios');
    await expect(page.getByTestId('comments-empty')).toBeVisible();

    await page.getByTestId('comment-submit').click();
    await expect(page.getByTestId('comment-error')).toContainText('Escribe un comentario');

    await page.getByTestId('comment-text').fill('Mi primer comentario');
    await page.getByTestId('comment-submit').click();

    await expect(page.getByTestId('comment')).toHaveCount(1);
    await expect(page.getByTestId('comment')).toContainText('Mi primer comentario');
    await expect(page.getByTestId('detail-comments-count')).toHaveText('1 comentario');
    await expect(page.getByTestId('comment-already')).toBeVisible();

    await page.getByTestId('detail-back').click();
    await expect(page.getByTestId('wall')).toBeVisible();
    await expect(page.getByTestId('comment-count')).toHaveText('1 comentario');
  });

  test('no permite comentar el propio mensaje', async ({ page }) => {
    const user = await loginAsNewUser(page, 'own_author');
    const messageId = await createMessageForUser(user.id, 'Este mensaje es mío');

    await page.goto(`/messages/${messageId}`);
    await expect(page.getByTestId('comment-own')).toBeVisible();
    await expect(page.getByTestId('comment-form')).toHaveCount(0);
  });

  test('pide sesión para comentar', async ({ page }) => {
    const author = await createUserDirect('guest_author');
    const messageId = await createMessageForUser(author.id, 'Mensaje para invitados');

    await page.goto(`/messages/${messageId}`);
    await expect(page.getByTestId('comment-auth')).toBeVisible();
    await page.getByRole('button', { name: 'Entrar para comentar' }).click();
    await expect(page.getByTestId('auth-dialog')).toBeVisible();
  });

  test('muestra un mensaje vencido', async ({ page }) => {
    const author = await createUserDirect('expired_author');
    const messageId = await createMessageForUser(author.id, 'Mensaje vencido', 25);

    await page.goto(`/messages/${messageId}`);
    await expect(page.getByTestId('detail-error')).toBeVisible();
    await expect(page.getByTestId('detail-error')).toContainText('ya expiró');
  });
});
