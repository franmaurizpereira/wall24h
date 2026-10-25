import { expect, test } from '@playwright/test';
import { createMessageForUser, createUserDirect, truncateMessages } from '../helpers/api';
import { loginAsNewUser } from '../helpers/ui';

test.describe('reportes desde la UI', () => {
  test.beforeEach(async () => {
    await truncateMessages();
  });

  test('envía un reporte y bloquea el duplicado', async ({ page }) => {
    const author = await createUserDirect('report_author');
    await createMessageForUser(author.id, 'Mensaje reportable');

    await loginAsNewUser(page, 'report_user');
    await page.getByTestId('report-button').click();
    await expect(page.getByTestId('report-dialog')).toBeVisible();

    await page.getByTestId('report-submit').click();
    await expect(page.getByTestId('report-error')).toContainText('al menos 5 caracteres');

    await page.getByTestId('report-reason').fill('Contenido ofensivo');
    await page.getByTestId('report-submit').click();

    await expect(page.getByTestId('report-dialog')).not.toBeVisible();
    await expect(page.getByTestId('toast')).toContainText('Reporte enviado');

    await page.getByTestId('report-button').click();
    await page.getByTestId('report-reason').fill('Contenido ofensivo otra vez');
    await page.getByTestId('report-submit').click();

    await expect(page.getByTestId('report-error')).toContainText('Ya reportaste');
    await expect(page.getByTestId('report-dialog')).toBeVisible();
  });

  test('no permite reportar el propio mensaje', async ({ page }) => {
    const user = await loginAsNewUser(page, 'report_own');
    const messageId = await createMessageForUser(user.id, 'Mi mensaje no se reporta');

    await page.goto(`/messages/${messageId}`);
    await page.getByTestId('detail-report').click();
    await page.getByTestId('report-reason').fill('Este es mi propio mensaje');
    await page.getByTestId('report-submit').click();

    await expect(page.getByTestId('report-error')).toContainText(
      'No puedes reportar tu propio mensaje',
    );
  });

  test('pide sesión antes de reportar', async ({ page }) => {
    const author = await createUserDirect('report_guest_author');
    await createMessageForUser(author.id, 'Mensaje anónimo');

    await page.goto('/');
    await page.getByTestId('report-button').click();
    await expect(page.getByTestId('auth-dialog')).toBeVisible();
    await expect(page.getByTestId('report-dialog')).not.toBeVisible();
  });
});
