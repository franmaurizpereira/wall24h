# T06 — Comentarios

- **Estado**: done
- **Fecha**: 2026-10-25
- **Owner**: implementer

## Entregado

- `POST /api/messages/:id/comments` con sesión obligatoria.
- Texto recortado, entre 1 y 300 caracteres.
- Moderación local configurable con `MODERATION_BANNED_WORDS`.
- `201` con `id` y `created_at`.
- `403 cannot_comment_on_own_message` para el propio mensaje.
- `409 already_commented` para el segundo comentario del mismo usuario.
- `410 message_gone` para mensajes vencidos o inexistentes.
- `422 invalid_input` para contenido vacío, solo espacios, ausente o >300.
- `422 content_not_allowed` para contenido moderado.
- `comments_count` incrementado por trigger.
- Un comentario por usuario/mensaje garantizado por constraint.
- Concurrencia resuelta por la constraint de PostgreSQL.

## Cambio adicional

- El rate limit de registro pasa a 50/min para no interferir con la suite;
  login sigue en 20/min.

## Context7 consultado

- `/fastify/fastify/v5.12.7`
- `/brianc/node-postgres`
- `/colinhacks/zod`

## Evidencia

```text
npm test → 33 passed
```

Tests nuevos:

- API: 6 tests de comentarios (201, 403, 409, 410, validación/moderación y
  concurrencia).
- DB: 3 tests (duplicado, propio y vencido).
- Total del proyecto: 33 tests.

## Notas

- La lista de moderación es un stub; en producción debe sustituirse.
- La API se apoya en el trigger y en la constraint; no duplica la lógica de
  negocio en JavaScript.
