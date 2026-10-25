import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'web/dist/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'docs/**',
      'db/**',
      'specs/**',
      '.opencode/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    rules: {
      'no-console': 'warn',
    },
  },
];
