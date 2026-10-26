# Feature 002 — Panel de moderación

## Problema

Los reportes quedan en `pending` y hoy solo se revisan por SQL. Se necesita un
panel mínimo para que un moderador autorizado vea los reportes pendientes,
marque su estado y retire del muro un mensaje reportado sin perder la evidencia.

## Decisiones aprobadas

- **Acceso**: allowlist por variable `ADMIN_USERNAMES` (coma-separada), sin
  migración de roles.
- **Ocultar**: soft-hide con `messages.hidden_at`; la fila, comentarios,
  reportes y auditoría se conservan.
- **UI**: ruta `/admin`, visible solo para usuarios administradores.
- **Alcance**: MVP de moderación; sin historial de acciones, edición de
  mensajes ni auto-ocultado por umbral.

## Requisitos funcionales

| ID | Regla | Criterio |
|---|---|---|
| RF-11 | Acceso admin | Solo usernames en `ADMIN_USERNAMES` pueden usar `/api/admin/*` y `/admin`; el resto recibe `403 not_admin`. |
| RF-12 | Lista de reportes | `GET /api/admin/reports?status=pending` devuelve reportes con mensaje, autor, motivo, fecha y estado. |
| RF-13 | Revisión | `PATCH /api/admin/reports/:id` acepta `reviewed` o `actioned`, guarda `reviewed_at`/`reviewed_by` y devuelve el estado. |
| RF-14 | Ocultar | `POST /api/admin/messages/:id/hide` fija `hidden_at`/`hidden_by`; el mensaje desaparece del muro/detalle y bloquea comentarios y reportes con `410`. |
| RF-15 | Auditoría | El mensaje y sus reportes se conservan aunque estén ocultos. El panel muestra el badge de oculto. |
| RF-16 | UI | `/admin` lista pendientes, permite revisar/accionar/ocultar y muestra errores/estado vacío. |

## No-goals

- Panel de usuarios, roles o permisos granular.
- Historial de cambios del reporte.
- Edición o borrado físico de mensajes.
- Auto-ocultado por número de reportes.
- Notificaciones al autor o al reportero.

## Seguridad

- `ADMIN_USERNAMES` se lee al arrancar; si está vacío, nadie es admin.
- Todas las rutas admin pasan por `requireUser` + allowlist.
- Los logs no registran contenido, tokens ni secretos.
- El botón de ocultar pide confirmación.
