# Ecco — Muro 24h

Muro efímero de mensajes de solo texto: cada mensaje vive **24 horas**, recibe
comentarios y el más comentado se convierte en el héroe del muro.

> Repositorio: <https://github.com/franmaurizpereira/wall24h>
>
> Estado: **fase 0**, **fase 1 (T01/T02)**, **fase 2 (T03)**, **fase 3
> (T04-T08)**, **T09**, **T10** y **T11** completadas. La API y la UI cubren
> muro, detalle, comentarios, auth, publicación, reportes y polling. El
> siguiente paso es V01, el rediseño visual.

## Qué es

- La lectura del muro es pública; publicar, comentar y reportar requiere sesión.
- Mensajes de solo texto, 1–500 caracteres.
- Vida exacta de 24 horas; después desaparecen del muro y la API responde `410`.
- Un solo mensaje activo por usuario.
- Sin contenido duplicado mientras ambos mensajes estén activos.
- Un comentario por usuario y mensaje; no se puede comentar el propio mensaje.
- El mensaje con más comentarios se muestra como **héroe**; el ranking es
  dinámico y los empates se resuelven por fecha.
- Reportes en cola de moderación.
- Purga automática con `pg_cron` cada minuto.

## Estado actual

| Fase | Estado |
|---|---|
| 0 | ✅ Esquema PostgreSQL, constraints, triggers, purga y tests |
| 1 | ✅ Scaffold, Docker, migraciones, lint, typecheck, Playwright/Vitest y salud |
| 2 | ✅ Auth, sesiones en BD, cookies y rate limit |
| 3 | ✅ API del muro, mensajes, comentarios, reportes y purga (T04-T08) |
| 4 | ✅ Frontend: shell, muro, héroe, countdown y estados (T09-T11) |
| 5 | ✅ Detalle, comentarios, reportes y pantallas de auth (T10) |
| 6 | ✅ Polling, revalidación y pulido de errores (T11) |
| 7–9 | ⏳ Moderación, tests visuales y despliegue |

Existe hoy:

- `package.json`, `package-lock.json`, TS/ESLint/Prettier y scripts.
- `src/` con Fastify, `/healthz`, pool de PostgreSQL y manejo de errores.
- Auth completo: registro, login, logout, `/me`, Argon2id, sesiones y cookies.
- Lectura pública: `GET /api/wall` y `GET /api/messages/:id`, con héroe,
  `server_time`, comentarios y `410` para vencidos.
- Publicación autenticada: `POST /api/messages`, con validación, moderación,
  24 h y 409 de activo/duplicado.
- Comentarios: `POST /api/messages/:id/comments`, uno por usuario/mensaje,
  con validación, moderación y 403/409/410.
- Reportes: `POST /api/messages/:id/report`, `pending`, 403/409/410 y cola
  privada.
- Expiración: filtro en API, purga real, cascada y purga de sesiones.
- Reintento de inserts ante deadlocks transitorios.
- Frontend React + Vite + TypeScript en `web/`: muro público, héroe, grid,
  contador de comentarios, countdown por `server_time` y estados de
  carga/vacío/error. La SPA se compila y se sirve desde Fastify.
- Detalle `/messages/:id` con comentarios, formulario, reporte y `410`.
- Auth modal de login/registro, sesión en cabecera, logout y publicación.
- Reporte con motivo y feedback de errores 401/403/409/410/422.
- Polling cada 15 s con pausa por pestaña oculta y aviso si falla un refresco.
- Toasts accesibles y router mínimo con History API.
- `Dockerfile`, `docker-compose.yml`, `db/Dockerfile`, `db/init/` y `Caddyfile`.
- `docker compose` con `db`, `migrate`, `migrate-test`, `app`, `app-test` y `caddy`.
- `playwright.config.ts`, `vitest.config.ts` y tests de salud, auth, muro,
  publicación, comentarios, reportes, expiración, DB y E2E del muro.
- `db/migrations/001_schema.sql` y `db/migrations/002_cron.sql`.
- `db/tests/schema_test.sql` y scripts de validación real.
- `AGENTS.md`, los agentes SDD y `specs/001-muro-24h/`.
- Documentación y diagramas en `docs/`.

Todavía no existe:

- Rediseño visual de `web/css/style.css` y specs con snapshots (V01).
- Moderación/endurecimiento final y suite visual completa (T12-T13).

## Stack objetivo

- **Backend**: Node.js 22, Fastify 5, PostgreSQL 16, `pg`, Zod, Argon2.
- **Frontend**: React + Vite + TypeScript.
- **Estilos**: CSS plano centralizado en `web/css/style.css`.
- **Base de datos**: PostgreSQL 16 con `pgcrypto`, `citext`, `btree_gist` y
  `pg_cron`.
- **Infraestructura**: Docker Compose + Caddy.
- **Testing**: Playwright para API, DB, E2E y visual; Vitest solo para funciones
  puras.

## Arranque rápido

```sh
cp .env.example .env
# Edita DB_PASSWORD, COOKIE_SECRET y TEST_COOKIE_SECRET.
docker compose up -d --build
curl http://localhost:8080/healthz
```

La app sirve la SPA en `/` y expone `/healthz`, `/api/auth/*`, `/api/wall`,
`/api/messages`, `/api/messages/:id`, `/api/messages/:id/comments` y
`/api/messages/:id/report`.

Para desarrollo del frontend con recarga en caliente:

```sh
npm run dev       # API en http://localhost:3000
npm run dev:web   # Vite en http://localhost:5173 (proxy /api → 8080)
```

## Docker

| Servicio | Puerto host | Base |
|---|---|---|
| `db` | `5433` | `wall` (desarrollo) y `wall_test` (tests) |
| `app` | `8080` | `wall` |
| `app-test` | `8081` | `wall_test` |
| `caddy` | `80/443` | reverse proxy de `app` |

- El PostgreSQL local del `5432` **no se usa** en este proyecto.
- `pg_cron` solo apunta a `wall`.
- Dentro de Docker, la app usa `db:5432`; desde el host se usa
  `localhost:5433`.
- `wall_test` no ejecuta cron; las pruebas de purga llaman directamente a
  `purge_expired_messages()`.

```sh
docker compose up -d --build          # db + migrate + app + caddy
npm run test:up                       # db + migrate-test + app-test
npm run test:down
```

## Base de datos

El esquema está en `db/migrations/001_schema.sql` y documentado en
`db/README.md`.

Reglas implementadas:

- Un mensaje activo por usuario mediante una `EXCLUDE USING gist` sobre
  intervalos. No se usan índices parciales con `now()` porque PostgreSQL exige
  predicados `IMMUTABLE`.
- Sin contenido activo duplicado: `content_hash` generado con
  `normalize_hash(content)` y exclusion constraint por intervalos.
- `expires_at = created_at + 24h`, fijado por trigger y protegido contra updates.
- `comments_count` sincronizado con triggers.
- Un comentario por usuario y mensaje.
- Un reporte por usuario y mensaje; no auto-reporte.
- No se comenta ni se reporta un mensaje vencido.
- Purga en cascada de mensajes, comentarios y reportes.
- Sesiones en base de datos con token hasheado (sha256).

## Validar la base de datos

Requiere `podman` o `docker` y el cliente `psql`:

```sh
./scripts/validate-schema.sh   # esquema, reglas, triggers y purga
./scripts/validate-cron.sh     # pg_cron real (hasta ~75 s)
```

`validate-schema.sh` crea una base desechable con PostgreSQL 16.
`validate-cron.sh` construye una imagen local con `postgres:16` +
`postgresql-16-cron` y comprueba que el job borra un mensaje vencido.

## Testing

Tests disponibles:

```sh
npm test              # Playwright: setup + e2e + api + db
npm run test:api      # /healthz + auth + muro + mensajes + comentarios + reportes
npm run test:db       # esquema, constraints y expiración en wall_test
npm run test:e2e      # muro, auth, detalle, publicación, reportes y polling
npm run test:unit     # Vitest: formatComments y formatCountdown
npm run test:all      # test:up + unit + Playwright + test:down
npm run test:up
npm run test:down
```

- Playwright corre en el host contra `app-test` (`http://localhost:8081`) y
  `wall_test` (`localhost:5433`).
- La suite actual tiene 60 tests Playwright: setup, 20 E2E, 31 de API y 8 de DB.
  Vitest añade 4 tests de funciones puras.
- Los proyectos corren `setup → e2e → api → db`; el test de rate limit de login
  se ejecuta después de E2E para no bloquear el flujo de auth.
- `test:visual` está configurado; los snapshots llegan con V01.
- Los tests SQL de esquema y `pg_cron` siguen en `psql`, no en Playwright.
- Evidencia: HTML report, traces y screenshots en `specs/<feature>/evidence/`.

## Variables de entorno

Copia `.env.example` a `.env` y rellena los valores:

- `DB_PASSWORD`: password del usuario `wall` dentro del contenedor PostgreSQL.
- `COOKIE_SECRET` y `TEST_COOKIE_SECRET`: secretos de 32+ caracteres.
- `DATABASE_URL` y `TEST_DATABASE_URL`: conexiones desde el host.
- `POSTGRES_PORT`, `APP_PORT`, `APP_TEST_PORT`, `TEST_BASE_URL`.

`.env` no se versiona. Nunca subas secretos al repositorio.

## Estructura

```text
wall24h/
├── AGENTS.md
├── MEMORY.md
├── README.md
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── playwright.config.ts
├── vitest.config.ts
├── eslint.config.js
├── .prettierrc
├── .env.example
├── .gitignore
├── opencode.json
├── Dockerfile
├── docker-compose.yml
├── Caddyfile
├── .opencode/
│   ├── agents/
│   └── design-brief.md
├── specs/001-muro-24h/
├── db/
│   ├── Dockerfile
│   ├── init/
│   ├── migrations/
│   ├── tests/
│   └── README.md
├── src/
│   ├── server.js
│   ├── app.js
│   ├── db.js
│   ├── routes/
│   └── lib/
├── web/
│   ├── index.html
│   ├── css/style.css
│   ├── src/
│   └── STYLE_CONTRACT.md
├── tests/
│   ├── setup/
│   ├── api/
│   ├── db/
│   ├── e2e/
│   ├── visual/
│   └── unit/
├── scripts/
│   ├── validate-schema.sh
│   ├── validate-cron.sh
│   ├── migrate.sh
│   ├── migrate-test.sh
│   ├── test-up.sh
│   ├── test-down.sh
│   ├── test-all.sh
│   └── with-env.mjs
└── docs/
```

La SPA vive en `web/`; `vite.config.ts` compila a `web/dist` y Fastify la
sirve con fallback para rutas del cliente. `web/css/style.css` se estiliza en
V01.

## Flujo SDD

El proyecto usa Spec-Driven Development con seis agentes:

| Agente | Rol |
|---|---|
| `coordinator` | Orquesta el flujo y transmite contexto |
| `planner` | Redacta spec, plan, tareas y brief visual |
| `reviewer` | Revisa la spec y valida la implementación RF por RF |
| `implementer` | Implementa una tarea aprobada, con tests primero |
| `graphic-designer` | Rediseña solo `web/css/style.css` |
| `reviewer-estilo` | Valida integridad, regresión, estética, accesibilidad y limpieza |

Artefactos en `specs/<feature>/`:

```text
spec.md
plan.md
tasks.md
evidence/
```

## Roadmap

| Fase | Objetivo |
|---|---|
| 0 | Esquema PostgreSQL, constraints, triggers y purga (completada) |
| 1 | Scaffold, Docker, migraciones, lint, typecheck, Playwright/Vitest y salud (completada) |
| 2 | Auth, sesiones en BD, cookies y rate limit |
| 3 | API de muro, mensajes, comentarios y reportes |
| 4 | Frontend: shell, muro, héroe y countdown |
| 5 | Detalle, comentarios, reportes y auth |
| 6 | Polling, errores y pulido |
| 7 | Moderación, rate limit y hardening |
| 8 | Suite Playwright: API, DB, E2E y visual |
| 9 | Documentación final, diagramas y despliegue |

## Documentación

- `AGENTS.md`: reglas de producto, arquitectura, permisos y flujo de agentes.
- `MEMORY.md`: estado operativo y decisiones recientes.
- `specs/001-muro-24h/`: spec, plan, tareas y evidencias.
- `db/README.md`: esquema, reglas y códigos de error.
- `docs/`: estructura original, diagramas y borradores.

## Herramientas de desarrollo

- **Context7**: documentación actualizada de librerías vía MCP. Está configurado
  en `opencode.json`; usa `resolve-library-id` y `query-docs` antes de
  implementar o actualizar una dependencia.
- **Playwright MCP**: verificación visual, capturas y comprobaciones de la UI.
- **OpenCode SDD**: `AGENTS.md`, agentes y `specs/001-muro-24h/`.

## Seguridad

- Contraseñas con Argon2id.
- Sesiones con token de 32 bytes; en BD solo sha256.
- Cookies `HttpOnly`, `SameSite=Lax` y `Secure` en producción.
- Zod en los bordes, SQL parametrizado y rate limit.
- Sin contenido de mensajes, tokens ni contraseñas en logs.
- Sin secretos en el repositorio; `.env` está ignorado.
