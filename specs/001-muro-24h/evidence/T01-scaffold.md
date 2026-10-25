# T01 — Scaffold del repositorio

- **Estado**: done
- **Fecha**: 2026-10-25
- **Owner**: implementer

## Entregado

- `package.json` ESM con scripts `dev`, `start`, `build`, `lint`, `typecheck`,
  `test`, `test:up`, `test:down`, `test:api`, `test:db`, `test:e2e`,
  `test:visual`, `test:unit`, `test:all`, `db:migrate`, `db:migrate:test`.
- `tsconfig.json`, `eslint.config.js`, `.prettierrc`, `.prettierignore`.
- `playwright.config.ts` con proyectos `setup`, `api`, `db`, `e2e`, `visual`.
- `vitest.config.ts` limitado a `tests/unit/**`.
- Estructura `tests/setup`, `tests/api`, `tests/db`, `tests/e2e`,
  `tests/visual`, `tests/unit`.
- `.env.example` con puertos, secretos y URLs de host.
- `package-lock.json`.

## Evidencia

```text
npm run lint        → OK, sin errores
npm run typecheck   → OK
npm run build       → OK
npm run test:unit   → OK, sin tests (passWithNoTests)
npx playwright test --list → 3 tests (setup, api, db)
npm audit --omit=dev → 0 vulnerabilities
```

## Notas

- `build` ejecuta `typecheck` hasta que exista la SPA en T09.
- `test:e2e` y `test:visual` están configurados, pero sus specs llegan en fases
  posteriores.
