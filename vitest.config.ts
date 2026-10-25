import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

if (existsSync('.env')) {
  try {
    process.loadEnvFile('.env');
  } catch {
    /* ya cargado */
  }
}

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
  },
});
