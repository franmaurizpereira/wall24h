# Plan — 002 Panel de moderación

## Datos

- Migración `003_moderation.sql`:
  - `messages.hidden_at`, `messages.hidden_by`;
  - `reports.reviewed_at`, `reports.reviewed_by`;
  - guards de comentario/reporte con `hidden_at IS NULL`;
  - índice de mensajes visibles.
- `migrate-test` aplica las migraciones de estructura y omite `002_cron.sql`.
- `validate-schema.sh` aplica todas las migraciones de estructura.

## API

| Método | Ruta | Auth | Respuesta |
|---|---|---|---|
| GET | `/api/admin/reports?status=pending\|reviewed\|actioned\|all` | admin | `{ items }` |
| PATCH | `/api/admin/reports/:id` | admin | `{ ok, status, reviewed_at }` |
| POST | `/api/admin/messages/:id/hide` | admin | `{ ok, hidden_at }` |

- `requireAdmin` = sesión válida + `ADMIN_USERNAMES`.
- `GET /api/auth/me` y registro devuelven `is_admin`.
- Wall, detalle y guards excluyen/bloquean mensajes ocultos.

## UI

- `/admin` con `AdminPanel`.
- Cabecera: botón “Moderación” solo si `user.is_admin`.
- Estados loading, empty, error y acciones con confirmación de ocultado.
- Se reutilizan clases existentes del sistema visual.

## Tests

- API: allowlist, lista, revisión, validación, ocultado, bloqueo de comentarios/
  reportes, `is_admin`.
- E2E: panel, revisar, ocultar y volver al muro.
- DB: columnas de moderación y migración aplicada.

## Riesgos

- `ADMIN_USERNAMES` vacío deja el panel inaccesible; documentado.
- Soft-hide no borra datos; el mensaje oculto no se muestra pero permanece.
- No hay historial de acciones; `reviewed_at`/`reviewed_by` es la única auditoría.
