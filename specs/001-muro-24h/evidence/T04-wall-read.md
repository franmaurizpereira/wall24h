# T04 — Lectura del muro y detalle

- **Estado**: done
- **Fecha**: 2026-10-25
- **Owner**: implementer

## Entregado

- `GET /api/wall`
- `GET /api/messages/:id`
- Lectura anónima, sin sesión.
- Solo mensajes activos (`expires_at > now()`).
- Orden por `comments_count DESC, created_at DESC`.
- `server_time` obtenido de PostgreSQL.
- `is_top` solo para el primer mensaje con `comments_count > 0`.
- Detalle con comentarios ordenados por `created_at`.
- `410 message_gone` para mensajes vencidos, inexistentes o IDs inválidos.
- Respuestas sin email, `password_hash` ni `content_hash`.
- IDs serializados como `number`.

## Context7 consultado

- `/fastify/fastify/v5.12.7`: definición de rutas y plugins con `prefix`.
- `/brianc/node-postgres`: `pool.query` y consultas parametrizadas.

## Evidencia

```text
npm test → 14 passed
```

Tests nuevos en `tests/api/wall.spec.ts`:

- Muro vacío con `server_time` y lista vacía.
- Orden por comentarios y héroe.
- Sin comentarios no hay héroe y ordena por fecha.
- Empate: gana el más reciente.
- Vencidos excluidos, detalle con comentarios, `410` para vencido/inexistente.
- Respuestas sin datos sensibles.

Validación completa:

```text
setup + 6 auth + health + 5 wall + db = 14 tests
```
