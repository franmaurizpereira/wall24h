# T03 — Auth y sesiones

- **Estado**: done
- **Fecha**: 2026-10-25
- **Owner**: implementer

## Entregado

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- Sesiones en PostgreSQL con token de 32 bytes y sha256 en `sessions.token_hash`.
- Argon2id con `memoryCost: 19456`, `timeCost: 2`, `parallelism: 1`.
- Cookie `session` con `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=604800`
  y `Secure` cuando `NODE_ENV=production`.
- Rate limit de 20 req/min por IP en registro y login.
- Registro transaccional de usuario + sesión.
- Logout revoca la sesión y limpia la cookie.
- `/me` rechaza sesiones vencidas y limpia la cookie.

## Context7 consultado

- `/fastify/fastify/v5.12.7`: rutas, plugins con `prefix` y error handler.
- `/fastify/fastify-cookie`: `reply.setCookie` y `reply.clearCookie`.
- `/napi-rs/node-rs`: `hash`/`verify` de `@node-rs/argon2`, Argon2id y opciones.
- `/brianc/node-postgres`: `Pool` y consultas parametrizadas.
- `/fastify/fastify-rate-limit`: `global: false` y `config.rateLimit` por ruta.

## Evidencia

```text
npm run lint        → OK
npm run typecheck   → OK
npm run format:check → OK
npm run build       → OK
npm run test:unit   → OK, sin tests
npm test            → 9 passed
```

Tests de `tests/api/auth.spec.ts`:

- Registro crea usuario, cookie HttpOnly, password Argon2id y sesión sha256.
- Registro rechaza username/email duplicados con `409 already_exists`.
- Login correcto/incorrecto, `/me` y logout.
- Validación de username, email y password con `422 invalid_input`.
- Sesión expirada deja de autenticar.
- Rate limit de login devuelve `429`.

Validación manual:

```text
PostgreSQL 16.15 + pg_cron en 5433
app contra wall_test
GET /healthz → 200 {"status":"ok","db":"ok"}
```

## Notas

- La app de test se arranca con `DATABASE_URL` apuntando a `wall_test`.
- El rate limit es en memoria; se reinicia con la app.
- La sesión se guarda hasheada; el token en claro solo vive en la cookie.
