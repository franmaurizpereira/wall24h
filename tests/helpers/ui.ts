import { createHash, randomBytes } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import {
  baseURL,
  createSessionForUsername,
  createUserDirect,
  dbExec,
  dbQuery,
  uniqueUser,
} from './api';

export type UiUser = {
  id: number;
  username: string;
  email: string;
  password: string;
};

export type FixtureUser = {
  id: number;
  username: string;
  email: string;
};

async function createSessionForUser(userId: number): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await dbExec(
    `INSERT INTO sessions (token_hash, user_id)
     VALUES ($1, $2)`,
    [createHash('sha256').update(token).digest('hex'), userId],
  );
  return token;
}

/**
 * Crea un usuario y una sesión real en la base para tests de UI que no
 * necesitan ejercitar el formulario de auth. Evita agotar el rate limit de
 * registro con cada spec.
 */
export async function loginAsNewUser(page: Page, prefix: string): Promise<FixtureUser> {
  const user = await createUserDirect(prefix);
  const token = await createSessionForUser(user.id);

  await page.context().addCookies([
    {
      name: 'session',
      value: token,
      url: baseURL,
    },
  ]);
  await page.goto('/');
  await expect(page.getByTestId('session-user')).toHaveText(`@${user.username}`);

  return user;
}

export async function registerViaUi(page: Page, prefix: string): Promise<UiUser> {
  const user = uniqueUser(prefix);

  await page.goto('/');
  await expect(page.getByTestId('open-auth')).toBeVisible();
  await page.getByTestId('open-auth').click();
  await expect(page.getByTestId('auth-dialog')).toBeVisible();
  await page.getByRole('tab', { name: 'Crear cuenta' }).click();
  await page.getByTestId('auth-username').fill(user.username);
  await page.getByTestId('auth-email').fill(user.email);
  await page.getByTestId('auth-password').fill(user.password);
  await page.getByTestId('auth-submit').click();

  await expect(page.getByTestId('session-user')).toHaveText(`@${user.username}`);
  await expect(page.getByTestId('auth-dialog')).not.toBeVisible();

  const rows = await dbQuery<{ id: string }>('SELECT id FROM users WHERE username = $1', [
    user.username,
  ]);

  return { ...user, id: Number(rows[0].id) };
}

export async function loginViaUi(
  page: Page,
  credentials: Pick<UiUser, 'username' | 'password'>,
): Promise<void> {
  await page.getByTestId('open-auth').click();
  await expect(page.getByTestId('auth-dialog')).toBeVisible();
  await page.getByTestId('auth-username').fill(credentials.username);
  await page.getByTestId('auth-password').fill(credentials.password);
  await page.getByTestId('auth-submit').click();

  await expect(page.getByTestId('session-user')).toHaveText(`@${credentials.username}`);
  await expect(page.getByTestId('auth-dialog')).not.toBeVisible();
}

export async function loginAsAdmin(page: Page): Promise<void> {
  const { context, token } = await createSessionForUsername('admin_test');

  await page.context().addCookies([
    {
      name: 'session',
      value: token,
      url: baseURL,
    },
  ]);
  await context.dispose();

  await page.goto('/');
  await expect(page.getByTestId('session-user')).toHaveText('@admin_test');
  await expect(page.getByTestId('open-admin')).toBeVisible();
}
