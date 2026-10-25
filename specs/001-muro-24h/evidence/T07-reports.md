# T07 — Reportes

- **Estado**: done
- **Fecha**: 2026-10-25
- **Owner**: implementer

## Entregado

- `POST /api/messages/:id/report` con sesión obligatoria.
- Motivo recortado, entre 5 y 500 caracteres.
- Moderación local del motivo con `MODERATION_BANNED_WORDS`.
- `201` con `{ ok: true, status: "pending" }`.
- `403 cannot_report_own_message` para el propio mensaje.
- `409 already_reported` para el segundo reporte del mismo usuario.
- `410 message_gone` para mensajes vencidos, inexistentes o IDs inválidos.
- `422 invalid_input` para motivo vacío, corto, ausente o >500.
- `422 content_not_allowed` para motivo moderado.
- La cola de reportes no tiene endpoint público.
- El detalle del mensaje no incluye reportes.

## Context7 consultado

- `/fastify/fastify/v5.12.7`
- `/brianc/node-postgres`
- `/colinhacks/zod`

## Evidencia

```text
npm test → 38 passed
```

Tests nuevos en `tests/api/reports.spec.ts`:

- Reporte `pending` y cola privada.
- Auto-reporte `403`.
- Reporte duplicado `409`.
- Vencido/inexistente/inválido `410`.
- Validación y moderación `422`.

## Notas

- El reporte queda en `reports` con `status = pending`.
- La cola se revisará manualmente o desde una futura UI de administración.
- La constraint `reports_one_per_user_message` impide duplicados.
