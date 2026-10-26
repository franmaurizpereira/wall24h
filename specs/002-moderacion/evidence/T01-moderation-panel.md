# T01 — Panel de moderación

- **Estado**: done
- **Fecha**: 2026-10-26
- **Feature**: 002-moderacion
- **RF**: RF-11 a RF-16

## Entregado

- Allowlist `ADMIN_USERNAMES` y `requireAdmin`.
- Migración `003_moderation.sql`:
  - `messages.hidden_at`, `messages.hidden_by`;
  - `reports.reviewed_at`, `reports.reviewed_by`;
  - guards de comentario/reporte para mensajes ocultos;
  - índice de mensajes visibles.
- API:
  - `GET /api/admin/reports?status=...`;
  - `PATCH /api/admin/reports/:id`;
  - `POST /api/admin/messages/:id/hide`.
- `is_admin` en `/api/auth/me` y registro.
- Wall/detalle excluyen mensajes con `hidden_at`; comentarios/reportes
  devuelven `410 message_gone`.
- UI `/admin`:
  - lista pending con mensaje, autor y motivo;
  - acciones Revisado, Accionado y Ocultar;
  - badge de mensaje oculto, estados loading/empty/error y confirmación.
- Botón “Moderación” solo para administradores.

## Evidencia

```text
npm run typecheck  → OK
npm run lint       → OK
npm run build:web  → OK
npm run test:unit  → 6 passed
npm run test:all   → 74 Playwright passed
```

Tests nuevos:

- `tests/api/admin.spec.ts`:
  - listar y revisar un reporte;
  - no admin → 403;
  - ocultar → 200, wall sin mensaje, detalle/comentario/reporte → 410;
  - `is_admin` y validación de estados.
- `tests/e2e/admin.spec.ts`:
  - revisar desde `/admin`;
  - ocultar con confirmación y comprobar el muro vacío.
- `tests/db/schema.spec.ts`: columnas de moderación presentes.

## Decisiones

- Acceso por allowlist de usernames, sin roles en BD.
- Ocultar es soft-hide: conserva mensaje, comentarios, reportes y auditoría.
- No hay auto-ocultado por umbral ni historial de acciones.

## Notas

- `ADMIN_USERNAMES` se lee al arrancar la app.
- En tests se usa `admin_test`; en producción hay que poner los usernames
  reales.
- `test-up.sh` ahora compila la imagen antes de levantar `app-test`.
