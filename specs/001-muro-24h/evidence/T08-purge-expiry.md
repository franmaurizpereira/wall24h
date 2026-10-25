# T08 — Purga y expiración

- **Estado**: done
- **Fecha**: 2026-10-25
- **Owner**: implementer

## Entregado

- Verificación de que el muro y el detalle filtran `expires_at > now()`.
- `410 message_gone` para mensajes vencidos antes de la purga.
- Purga real con `purge_expired_messages()` y cascada a comentarios/reportes.
- Purga de sesiones vencidas con `purge_expired_sessions()`.
- Tests de expiración con un mensaje que vence en 3 segundos.
- Reintento de inserts ante `40P01`/`40001` para reducir deadlocks bajo
  concurrencia.

## Context7 consultado

- `/brianc/node-postgres`
- `/fastify/fastify/v5.12.7` para las rutas del muro y detalle.

## Evidencia

```text
npm test → 40 passed
```

Tests nuevos en `tests/db/expiry.spec.ts`:

- El muro y el detalle ocultan vencidos antes de la purga.
- La purga borra mensajes, comentarios, reportes y sesiones vencidas.

Validación de `pg_cron`:

```text
./scripts/validate-cron.sh → OK
purge-expired-messages=* * * * *
purge-expired-sessions=17 * * * *
```

## Notas

- El cron real vive en `wall`; `wall_test` prueba las funciones directamente.
- La API nunca depende de que la purga haya corrido para ocultar un mensaje.
- Los tests de concurrencia aceptan `23P01` o un deadlock `40P01`; la API
  reintenta `40P01`/`40001` antes de devolver error.
