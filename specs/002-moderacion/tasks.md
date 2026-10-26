# Tasks — 002 Panel de moderación

## T01 — Migración y backend de moderación

- **Estado**: done
- **RF**: RF-11, RF-12, RF-13, RF-14, RF-15
- **Archivos**: `db/migrations/003_moderation.sql`, `scripts/migrate-test.sh`,
  `scripts/validate-schema.sh`, `src/lib/auth.js`, `src/routes/admin.js`,
  `src/routes/wall.js`, `src/routes/messages.js`, `tests/api/admin.spec.ts`
- **Criterios**:
  - Allowlist `ADMIN_USERNAMES`;
  - listado/revisión de reportes;
  - soft-hide y bloqueo de detalle/comentarios/reportes;
  - auditoría `reviewed_at`/`reviewed_by`.
- **Tests**: Playwright API admin + DB de esquema.

## T02 — UI del panel

- **Estado**: done
- **RF**: RF-16
- **Archivos**: `web/src/components/AdminPanel.tsx`, `web/src/App.tsx`,
  `web/src/components/Header.tsx`, `web/src/api/client.ts`,
  `web/src/hooks/useRoute.ts`, `tests/e2e/admin.spec.ts`
- **Criterios**:
  - `/admin` solo para admin;
  - lista pending, revisar/accionar/ocultar;
  - estados loading/empty/error y confirmación.
- **Tests**: Playwright E2E.

## T03 — Documentación y evidencia

- **Estado**: done
- **Archivos**: `README.md`, `docs/despliegue.md`, `db/README.md`,
  `specs/002-moderacion/evidence/T01-moderation-panel.md`
- **Criterios**:
  - `ADMIN_USERNAMES` documentado;
  - soft-hide explicado;
  - panel y limitaciones.
