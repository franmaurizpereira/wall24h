# T05 — Publicar mensaje

- **Estado**: done
- **Fecha**: 2026-10-25
- **Owner**: implementer

## Entregado

- `POST /api/messages` con sesión obligatoria.
- Texto recortado, entre 1 y 500 caracteres.
- Moderación local configurable con `MODERATION_BANNED_WORDS`.
- `201` con `id`, `created_at` y `expires_at` (24 h).
- `401 not_authenticated` sin sesión.
- `422 invalid_input` para texto vacío, solo espacios, ausente o >500.
- `422 content_not_allowed` para contenido moderado.
- `409 already_has_active_message` para el segundo mensaje activo.
- `409 duplicate_message` para contenido duplicado activo.
- `requireUser` reutilizable para rutas autenticadas.
- Concurrencia resuelta con exclusion constraints de PostgreSQL.

## Context7 consultado

- `/fastify/fastify/v5.12.7`: rutas y hooks de autenticación.
- `/brianc/node-postgres`: `Pool` y consultas parametrizadas.
- `/colinhacks/zod`: `trim`, `min`, `max` y `z.email()` en Zod 4.

## Evidencia

```text
npm test → 24 passed
```

Tests nuevos:

- API: 8 tests de publicación (201, validaciones, moderación, 401, 409 y
  concurrencia).
- DB: 2 tests de concurrencia contra las exclusion constraints.
- Total del proyecto: setup + 6 auth + health + 8 messages + 5 wall + 2 DB
  messages + schema = 24 tests.

## Notas

- La lista de moderación es un stub; en producción debe sustituirse por un
  servicio real.
- La BD es la última defensa: aunque dos peticiones lleguen a la vez, solo una
  inserta el mensaje activo.
