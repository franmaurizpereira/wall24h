import { expect, test } from '@playwright/test';
import {
  createMessageForUser,
  createSessionContext,
  createUserDirect,
  truncateMessages,
} from '../helpers/api';
import { loginAsAdmin } from '../helpers/ui';

async function seedReport(content: string): Promise<number> {
  const author = await createUserDirect('admin_e2e_author');
  const messageId = await createMessageForUser(author.id, content);
  const reporter = await createSessionContext('admin_e2e_reporter');
  const response = await reporter.context.post(`/api/messages/${messageId}/report`, {
    data: { reason: 'Contenido ofensivo para revisar' },
  });
  expect(response.status()).toBe(201);
  await reporter.context.dispose();
  return messageId;
}

test.describe('panel de moderación', () => {
  test.beforeEach(async () => {
    await truncateMessages();
  });

  test('revisa un reporte pendiente', async ({ page }) => {
    await seedReport('Mensaje reportado en E2E');
    await loginAsAdmin(page);
    await page.getByTestId('open-admin').click();

    await expect(page.getByTestId('admin-panel')).toBeVisible();
    await expect(page.getByTestId('admin-report')).toContainText('Mensaje reportado en E2E');
    await expect(page.getByTestId('admin-report')).toContainText('Contenido ofensivo para revisar');

    await page.getByTestId('admin-review').click();

    await expect(page.getByTestId('toast')).toContainText('revisado');
    await expect(page.getByTestId('admin-report')).toHaveCount(0);
    await expect(page.getByTestId('admin-empty')).toBeVisible();
  });

  test('oculta un mensaje reportado', async ({ page }) => {
    await seedReport('Mensaje que se ocultará en E2E');
    await loginAsAdmin(page);
    await page.getByTestId('open-admin').click();

    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByTestId('admin-hide').click();

    await expect(page.getByTestId('toast')).toContainText('Mensaje oculto');
    await expect(page.getByTestId('admin-report')).toContainText('Mensaje oculto');

    await page.getByRole('button', { name: '← Volver al muro' }).click();
    await expect(page.getByTestId('empty-state')).toBeVisible();
    await expect(page.getByTestId('empty-state')).not.toContainText(
      'Mensaje que se ocultará en E2E',
    );
  });
});
