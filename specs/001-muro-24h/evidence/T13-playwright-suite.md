# T13 — Suite Playwright completa

- **Estado**: done
- **Fecha**: 2026-10-26
- **Owner**: implementer
- **RF**: todos
- **RNF**: RNF-01, RNF-02, RNF-03, RNF-04, RNF-05, RNF-06, RNF-07

## Entregado

- Proyectos Playwright `setup`, `e2e`, `api`, `db` y `visual` en verde.
- Suite visual con snapshots deterministas a 360, 768 y 1280 px.
- Cobertura de dos usuarios en muro, publicación, comentarios, ranking,
  reportes y expiración.
- Cobertura explícita de `401`, `403`, `409`, `410`, `422` y `429`.
- Snapshots visuales en `tests/visual/wall.spec.ts-snapshots/`.
- Reporte HTML copiado a `evidence/playwright-report/index.html`.

## Evidencia

```text
npm test        → 68 passed
npm run test:unit → 6 passed
npm run test:visual → 4 passed
```

Distribución:

- setup: 1
- E2E: 20
- API: 36
- DB: 8
- visual: 3

Cobertura destacada:

- **Dos usuarios y ranking**: `tests/api/wall.spec.ts`,
  `tests/api/comments.spec.ts` y `tests/e2e/detail.spec.ts`.
- **409**: mensaje activo, duplicado, comentario duplicado, reporte duplicado,
  `already_exists`.
- **410**: mensaje vencido/inexistente en detalle, comentario y reporte.
- **403**: auto-comentario, auto-reporte y `Origin` no permitido.
- **422**: validación Zod y moderación en mensajes, comentarios y reportes.
- **429**: login y escritura por sesión.
- **Expiración**: `tests/db/expiry.spec.ts` y purga real.
- **Visual**: snapshots de muro 360/768/1280 con héroe, grid y countdown
  enmascarado para evitar ruido temporal.

## Notas

- `baseURL` se toma de `TEST_BASE_URL` y la base de `TEST_DATABASE_URL`
  (`localhost:5433/wall_test`).
- `npm run test:all` se ejecutó con el perfil `test` de Docker Compose
  (`db`, `migrate-test`, `app-test`) y terminó con 68 tests Playwright verdes.
  El servicio `db` permanece levantado porque `test:down` solo elimina
  `migrate-test` y `app-test`.
- El reporte HTML es autocontenido y se guarda también en `evidence/`.
