import { expect, test } from '@playwright/test';
import { uniqueUser } from '../helpers/api';
import { loginViaUi, registerViaUi } from '../helpers/ui';

test.describe('auth en el muro', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('registro, logout y login desde el muro', async ({ page }) => {
    const user = await registerViaUi(page, 'ui_auth');

    await expect(page.getByTestId('session-user')).toHaveText(`@${user.username}`);
    await expect(page.getByTestId('open-auth')).toHaveCount(0);

    await page.getByTestId('logout').click();
    await expect(page.getByTestId('open-auth')).toBeVisible();
    await expect(page.getByTestId('session-user')).toHaveCount(0);

    await loginViaUi(page, user);
    await expect(page.getByTestId('session-user')).toHaveText(`@${user.username}`);
  });

  test('muestra un error claro con credenciales incorrectas', async ({ page }) => {
    const user = uniqueUser('nadie');

    await page.getByTestId('open-auth').click();
    await expect(page.getByTestId('auth-dialog')).toBeVisible();
    await page.getByTestId('auth-username').fill(user.username);
    await page.getByTestId('auth-password').fill('contraseña-incorrecta');
    await page.getByTestId('auth-submit').click();

    await expect(page.getByTestId('auth-error')).toContainText('Usuario o contraseña incorrectos');
    await expect(page.getByTestId('auth-dialog')).toBeVisible();
  });
});
