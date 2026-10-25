# Tasks — 001 Muro 24h

- **Feature**: `001-muro-24h`
- **Spec**: `specs/001-muro-24h/spec.md`
- **Plan**: `specs/001-muro-24h/plan.md`
- **Estados**: `pending` · `in_progress` · `blocked` · `done`

> El coordinator actualiza el estado. El implementer solo trabaja la tarea que
> se le asigna y no cambia el alcance.

## T00 — Fase 0: esquema y purga

- **Estado**: done
- **Owner**: implementer
- **RF**: RF-03, RF-04, RF-05, RF-06, RF-08, RF-09, RF-10
- **Archivos**: `db/migrations/001_schema.sql`, `db/migrations/002_cron.sql`,
  `db/tests/schema_test.sql`, `scripts/validate-schema.sh`,
  `scripts/validate-cron.sh`, `db/README.md`
- **Criterios**:
  - Esquema aplicado en PostgreSQL 16 real.
  - Reglas, triggers, expiración, cascada y purga validados.
  - `pg_cron` ejecuta el job y borra un mensaje vencido.
  - Los tests SQL se mantienen con `psql`; no se migran a Playwright.
- **Evidencia**: salidas de `validate-schema.sh` y `validate-cron.sh`.

## T01 — Scaffold del repositorio

- **Estado**: done
- **Owner**: implementer
- **Depende de**: T00
- **RF**: —
- **Archivos**: `package.json`, `tsconfig*.json`, `eslint.config.*`,
  `playwright.config.ts`, `vitest.config.*`, `tests/setup/`, `tests/api/`,
  `tests/db/`, `tests/e2e/`, `tests/visual/`, `tests/unit/`,
  `.prettierrc`, `.gitignore`, `.env.example`, `README.md`
- **Criterios**:
  - ESM, TypeScript estricto, scripts `dev`, `build`, `test`, `test:up`,
    `test:down`, `test:api`, `test:db`, `test:e2e`, `test:visual`,
    `test:unit`, `test:all`, `lint`, `typecheck`, `db:migrate`.
  - `test:all` levanta el perfil `test`, ejecuta Vitest + Playwright y lo baja.
  - Playwright configurado con proyectos `setup`, `api`, `db`, `e2e`, `visual`;
    `baseURL` desde `TEST_BASE_URL`.
  - Vitest configurado solo para `tests/unit/**`.
  - `.env.example` documenta `DB_PASSWORD`, `POSTGRES_PORT`, `APP_PORT`,
    `APP_TEST_PORT`, `TEST_BASE_URL`, `DATABASE_URL`, `TEST_DATABASE_URL`,
    `COOKIE_SECRET`, `TEST_COOKIE_SECRET`, `PORT`, `NODE_ENV`.
  - No se versiona `.env`.
- **Tests**: `npm run lint`, `npm run typecheck`, `npm run build`,
  `npx playwright test --list`, `npm run test:unit`.
- **Evidencia**: `specs/001-muro-24h/evidence/T01-scaffold.md`.

## T02 — Backend base, Docker y migraciones

- **Estado**: done
- **Owner**: implementer
- **Depende de**: T01
- **RF**: —
- **Archivos**: `src/app.js`, `src/server.js`, `src/db.js`, `src/routes/`,
  `src/lib/`, `Dockerfile`, `db/Dockerfile`, `db/init/`,
  `docker-compose.yml`, `Caddyfile`, `scripts/migrate.*`,
  `scripts/migrate-test.*`, `tests/api/health.spec.ts`
- **Criterios**:
  - Fastify arranca y responde `GET /healthz`.
  - Dockerfile multi-stage base; la etapa de la SPA se integra en T09.
  - `docker compose` levanta `db`, `migrate`, `app`, `app-test`, `migrate-test`
    y `caddy`.
  - `db` publica `5433`, contiene `wall` y `wall_test`, e incluye `pg_cron`.
  - `app` publica `8080` y usa `wall`; `app-test` publica `8081` y usa `wall_test`.
  - `migrate` aplica esquema y cron a `wall`; `migrate-test` solo el esquema a
    `wall_test`.
  - `app` y `app-test` usan `db:5432`, nunca `localhost`.
  - Se sustituye la imagen no disponible de `docs/`.
- **Tests**: `docker compose up -d --build`,
  `docker compose --profile test up -d`, healthcheck, migraciones en bases
  limpias.
- **Evidencia**: `specs/001-muro-24h/evidence/T02-backend-docker.md`.

## T03 — Auth y sesiones

- **Estado**: done
- **Owner**: implementer
- **Depende de**: T02
- **RF**: RF-01, RF-10
- **Archivos**: `src/routes/auth.js`, `src/lib/sessions.js`,
  `src/lib/errors.js`, `tests/api/auth.spec.ts`
- **Criterios**:
  - Registro `201`, duplicado `409`, validación `422`.
  - Login `200`/`401`; logout revoca; `/me` `200`/`401`.
  - Argon2id; token de 32 bytes; BD guarda sha256 hex.
  - Cookie `HttpOnly`, `SameSite=Lax`, `Secure` en producción.
  - Rate limit en registro/login.
  - Consultar Context7 para Fastify 5, `@fastify/cookie`, `@node-rs/argon2`,
    `pg` y `@fastify/rate-limit`; citar docs en la evidencia.
- **Tests**: Playwright API: flujo completo, cookie, sesión vencida, logout,
  duplicados.
- **Evidencia**: `specs/001-muro-24h/evidence/T03-auth-sessions.md`.

## T04 — Lectura del muro y detalle

- **Estado**: done
- **Owner**: implementer
- **Depende de**: T02
- **RF**: RF-01, RF-03, RF-07
- **Archivos**: `src/routes/wall.js`, `src/routes/messages.js`,
  `tests/api/wall.spec.ts`
- **Criterios**:
  - `GET /api/wall` solo activos; orden por comentarios y fecha.
  - `server_time` presente; `is_top` correcto.
  - `GET /api/messages/:id` incluye comentarios; vencido/inexistente `410`.
  - Sin emails ni hashes en la respuesta.
- **Tests**: Playwright API: orden, héroe, sin comentarios, empate, 410,
  lectura anónima.
- **Evidencia**: `specs/001-muro-24h/evidence/T04-wall-read.md`.

## T05 — Publicar mensaje

- **Estado**: done
- **Owner**: implementer
- **Depende de**: T03, T04
- **RF**: RF-02, RF-04, RF-05
- **Archivos**: `src/routes/messages.js`, `src/lib/auth.js`,
  `src/lib/moderation.js`, `src/lib/errors.js`,
  `tests/api/messages.spec.ts`, `tests/db/messages.spec.ts`
- **Criterios**:
  - `201` con `expires_at = created_at + 24h`.
  - Texto recortado, 1–500, no vacío, moderación.
  - Segundo activo `409 already_has_active_message`.
  - Duplicado activo `409 duplicate_message`.
  - `23P01` y `23514` mapeados; no `500`.
  - Concurrencia: una de dos publicaciones gana.
- **Tests**: Playwright API + DB: 201, 409, 422, 501 chars, espacios,
  duplicado y concurrencia.
- **Evidencia**: `specs/001-muro-24h/evidence/T05-publish-message.md`.

## T06 — Comentarios

- **Estado**: done
- **Owner**: implementer
- **Depende de**: T03, T04
- **RF**: RF-06
- **Archivos**: `src/routes/messages.js`, `src/lib/errors.js`,
  `src/lib/moderation.js`, `tests/api/comments.spec.ts`,
  `tests/db/comments.spec.ts`
- **Criterios**:
  - `201` y contador +1.
  - Propio `403`; vencido/inexistente `410`; duplicado `409`; inválido `422`.
  - Un comentario por usuario/mensaje.
- **Tests**: Playwright API + DB: 201, 403, 409, 410, 422, contador y
  concurrencia.
- **Evidencia**: `specs/001-muro-24h/evidence/T06-comments.md`.

## T07 — Reportes

- **Estado**: pending
- **Owner**: implementer
- **Depende de**: T03, T04
- **RF**: RF-09
- **Archivos**: `src/routes/reports.js`, `src/lib/errors.js`,
  `tests/api/reports.spec.ts`
- **Criterios**:
  - `201` con estado `pending`.
  - Auto-reporte `403`; vencido `410`; duplicado `409`; motivo inválido `422`.
  - No se expone la cola al público.
- **Tests**: Playwright API: 201, 403, 409, 410, 422.

## T08 — Purga y expiración

- **Estado**: pending
- **Owner**: implementer
- **Depende de**: T02, T04
- **RF**: RF-03, RF-08
- **Archivos**: `db/migrations/002_cron.sql`, `scripts/validate-cron.sh`,
  `src/routes/wall.js`, `tests/db/expiry.spec.ts`
- **Criterios**:
  - Cron cada minuto borra vencidos y cascada.
  - Sesiones vencidas se purgan.
  - La API filtra aunque el cron falle.
  - `410` después de vencer.
  - `pg_cron` solo apunta a `wall`; `wall_test` llama a la función de purga
    directamente.
  - `validate-cron.sh` valida el job real en un contenedor aparte.
- **Tests**: Playwright DB + SQL: mensaje vencido oculto, `410`, purga real y
  cascada.

## T09 — Shell del frontend, muro y héroe

- **Estado**: pending
- **Owner**: implementer
- **Depende de**: T04
- **RF**: RF-01, RF-03, RF-07
- **Archivos**: `web/index.html`, `web/src/main.tsx`, `web/src/App.tsx`,
  `web/src/api/client.ts`, `web/src/components/`, `tests/e2e/wall.spec.ts`
- **Criterios**:
  - Vite + React + TS arranca.
  - Muro con héroe y grid; countdown por `server_time`.
  - Estados loading, empty y error.
  - Clases semánticas documentadas para el diseñador.
  - Se añade la etapa de build de la SPA al Dockerfile y Fastify sirve `web/dist`.
- **Tests**: Playwright E2E: smoke del muro, héroe, countdown y estados.

## T10 — Detalle, comentarios, auth y reportes UI

- **Estado**: pending
- **Owner**: implementer
- **Depende de**: T03, T06, T07, T09
- **RF**: RF-01, RF-06, RF-09
- **Archivos**: `web/src/components/MessageDetail*`, `CommentForm*`,
  `AuthDialog*`, `ReportDialog*`, `Toast*`, `tests/e2e/detail.spec.ts`,
  `tests/e2e/auth.spec.ts`, `tests/e2e/reports.spec.ts`
- **Criterios**:
  - Detalle con comentarios y formulario.
  - Login/registro desde el muro.
  - Reporte con motivo.
  - Errores 401/403/409/410/422 con mensajes claros.
- **Tests**: Playwright E2E: detalle, comentarios, auth y reportes.

## T11 — Polling, errores y pulido

- **Estado**: pending
- **Owner**: implementer
- **Depende de**: T09, T10
- **RF**: RF-03, RF-07
- **RNF**: RNF-01, RNF-02
- **Archivos**: `web/src/hooks/useWall.*`, `web/src/hooks/usePolling.*`,
  `web/src/components/`, `tests/e2e/polling.spec.ts`,
  `tests/visual/wall.spec.ts`
- **Criterios**:
  - Polling 15 s; pausa con pestaña oculta.
  - `server_time` y countdown estables.
  - Reordenación del héroe sin parpadeos.
  - Responsive 360–1280.
  - Errores de red no rompen el muro.
- **Tests**: Playwright E2E + visual: polling, countdown, reordenación y
  responsive.

## T12 — Moderación, rate limit y hardening

- **Estado**: pending
- **Owner**: implementer
- **Depende de**: T03, T05, T06, T07
- **RF**: RF-02, RF-06, RF-09
- **RNF**: RNF-03
- **Archivos**: `src/lib/moderation.js`, `src/app.js`,
  `tests/api/security.spec.ts`
- **Criterios**:
  - Helmet, rate limit, comprobación de `Origin`.
  - Moderación aplicada a mensajes, comentarios y motivos.
  - Logs sin contenido ni secretos.
  - Errores 500 sin filtraciones.
- **Tests**: Playwright API: rate limit, moderación, CSRF/Origin y logs.

## T13 — Suite Playwright completa

- **Estado**: pending
- **Owner**: implementer
- **Depende de**: T11, T12
- **RF**: todos
- **Archivos**: `tests/api/`, `tests/db/`, `tests/e2e/`, `tests/visual/`,
  `playwright.config.ts`
- **Criterios**:
  - Proyectos `api`, `db`, `e2e` y `visual` en verde.
  - Dos usuarios: publicar, comentar, ranking y expiración.
  - 409/410/403/422 cubiertos.
  - Capturas 360/768/1280 y reporte HTML.
  - `baseURL` = `TEST_BASE_URL` (`http://localhost:8081`).
  - `TEST_DATABASE_URL` apunta a `localhost:5433/wall_test`.
  - `migrate-test` deja el esquema aplicado; `setup` solo limpia y siembra.
  - Suite reproducible en CI con el perfil `test` de Docker Compose.
- **Tests**: `docker compose --profile test up -d`, `npm run test:up`,
  `npm run test:all`, `npm run test:down`,
  `./scripts/validate-schema.sh`, `./scripts/validate-cron.sh`.

## T14 — Documentación y despliegue

- **Estado**: pending
- **Owner**: implementer
- **Depende de**: T13
- **RF**: —
- **Archivos**: `README.md`, `docs/`, `docker-compose.yml`, `Caddyfile`,
  `.env.example`
- **Criterios**:
  - Quickstart con `docker compose up -d --build`.
  - Perfil `test` documentado: `docker compose --profile test up -d`.
  - Puertos `5433`, `8080`, `8081` y variables documentadas.
  - Variables y migraciones documentadas.
  - Diagramas actualizados.
  - Notas de despliegue y limitaciones.
- **Tests**: seguir el README desde cero; `npm run test:all` y scripts SQL.

## V01 — Rediseño visual

- **Estado**: pending
- **Owner**: graphic-designer
- **Depende de**: T09, T10, T11, `.opencode/design-brief.md` aprobado
- **RF**: RNF-01
- **Archivos**: solo `web/css/style.css`
- **Criterios**:
  - Aplica el brief aprobado.
  - No toca markup, TS, tests ni otros CSS.
  - Responsive 360/768/1280; estados; accesibilidad.
  - Capturas antes/después.
- **Revisión**: `reviewer-estilo` con los 5 gates.
- **Evidencia**: `evidence/visual-review.md` y `evidence/screenshots/`.
