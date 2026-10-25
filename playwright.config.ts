import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

if (existsSync('.env')) {
  try {
    process.loadEnvFile('.env');
  } catch {
    /* ya cargado */
  }
}

const baseURL = process.env.TEST_BASE_URL ?? 'http://localhost:8081';

export default defineConfig({
  testDir: './tests',
  outputDir: 'test-results',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /setup\/.*\.setup\.ts/,
    },
    {
      name: 'e2e',
      testMatch: /e2e\/.*\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },
    // API/DB después de E2E: el test de rate limit de login agota el bucket por IP.
    {
      name: 'api',
      testMatch: /api\/.*\.spec\.ts/,
      dependencies: ['setup'],
    },
    {
      name: 'db',
      testMatch: /db\/.*\.spec\.ts/,
      dependencies: ['setup'],
    },
    {
      name: 'visual',
      testMatch: /visual\/.*\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
