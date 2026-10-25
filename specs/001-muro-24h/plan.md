# Plan — 001 Muro 24h

- **Feature**: `001-muro-24h`
- **Spec**: `specs/001-muro-24h/spec.md`
- **Estado**: borrador para revisión
- **Dependencia**: fase 0 de base de datos completada

## 1. Arquitectura

```text
Navegador
   │
   ▼
Caddy (TLS / reverse proxy)
   │
   ▼
Fastify 5
   ├── /api/*          API REST
   ├── /assets/*       SPA compilada
   └── /healthz
   │
   ▼
PostgreSQL 16
   ├── pg_cron: purga cada minuto
   ├── pgcrypto + citext + btree_gist
   └── migraciones numeradas
```

Decisiones:

- Un solo contenedor de aplicación sirve API y SPA compilada.
- Caddy solo hace proxy/TLS.
- PostgreSQL es la fuente de verdad para tiempo y reglas.
- La app filtra siempre por `expires_at > now()`; `pg_cron` es una capa de
  limpieza, no la única defensa.
- `app` (`8080`) usa `wall`; `app-test` (`8081`) usa `wall_test`.
- `db` se publica en `localhost:5433`; el PostgreSQL local del `5432` no se usa.
- Polling cada 15 s en el MVP.

## 2. Estructura del repositorio

```text
ecco/
├── AGENTS.md
├── .opencode/agents/
├── specs/001-muro-24h/
├── db/
│   ├── Dockerfile          # PostgreSQL 16 + pg_cron
│   ├── init/               # creación de wall_test
│   ├── migrations/
│   │   ├── 001_schema.sql
│   │   └── 002_cron.sql
│   └── tests/schema_test.sql
├── src/
│   ├── server.js          # arranque
│   ├── app.js             # Fastify, plugins, rutas
│   ├── db.js              # pool pg
│   ├── routes/
│   │   ├── auth.js
│   │   ├── wall.js
│   │   ├── messages.js
│   │   └── reports.js
│   └── lib/
│       ├── errors.js
│       ├── sessions.js
│       ├── moderation.js
│       └── validate.js
├── web/
│   ├── index.html
│   ├── css/style.css      # único archivo de estilos
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/client.ts
│       ├── components/
│       └── hooks/
├── tests/
│   ├── setup/
│   ├── api/
│   ├── db/
│   ├── e2e/
│   ├── visual/
│   └── unit/
├── scripts/
│   ├── validate-schema.sh
│   └── validate-cron.sh
├── docs/                  # referencia histórica
├── docker-compose.yml
├── Dockerfile
├── Caddyfile
├── playwright.config.ts
├── vitest.config.ts
├── .env.example
├── package.json
└── README.md
```

## 3. Stack y dependencias

- Node.js 22, ESM.
- Fastify 5 + `@fastify/cookie`, `@fastify/helmet`, `@fastify/rate-limit`,
  `@fastify/static`.
- `pg`, `zod`, `@node-rs/argon2`.
- React + Vite + TypeScript para el frontend.
- Playwright Test para API, DB, E2E y visual.
- Vitest solo para funciones puras.
- PostgreSQL 16 con `pg_cron`; `wall` para desarrollo y `wall_test` para tests.
- Docker Compose con `db`, `migrate`, `app`, `app-test` y `caddy`.
- Puertos: PostgreSQL `5433`, app `8080`, app-test `8081`, Caddy `80/443`.
- Playwright en el host contra `app-test`.

No se añaden dependencias fuera de esta lista sin actualizar el plan.

## 4. Datos y migraciones

El esquema vigente está en `db/migrations/001_schema.sql` y documentado en
`db/README.md`. No se reescribe aquí.

Invariantes:

- `messages.expires_at = messages.created_at + interval '24 hours'`.
- Un mensaje activo por usuario: exclusion constraint por intervalos.
- Sin contenido activo duplicado: exclusion constraint sobre `content_hash`.
- `comments_count` sincronizado por trigger.
- Un comentario por usuario/mensaje.
- Un reporte por usuario/mensaje.
- `sessions` guarda sha256 del token, no el token.
- Purga con `pg_cron` cada minuto.

Migraciones:

- `001_schema.sql`: tablas, constraints, triggers, índices, funciones.
- `002_cron.sql`: jobs de purga.
- El runner de migraciones se añade en la fase 1. No se ejecutan migraciones
  automáticamente en cada réplica; se usa un servicio `migrate` de un solo uso.

Bases:

- `wall`: base de desarrollo; `pg_cron` activo.
- `wall_test`: base de tests; sin cron; se migra con `migrate-test` o el
  `globalSetup` de Playwright.
- El PostgreSQL de Docker se publica en `localhost:5433`; el local del `5432`
  no se usa.

## 5. API

### Auth

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| POST | `/api/auth/register` | `{ username, email, password }` | `201 { id, username }` |
| POST | `/api/auth/login` | `{ username, password }` | `200 { ok: true }` + cookie |
| POST | `/api/auth/logout` | — | `200`, cookie borrada |
| GET | `/api/auth/me` | — | `200 { id, username }` / `401` |

Reglas:

- Username 3–32, `[a-z0-9_]` case-insensitive.
- Email válido y único.
- Password mínimo 8.
- Argon2id.
- Cookie `session` `HttpOnly`, `SameSite=Lax`, `Secure` en producción, 7 días.

### Muro

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/api/wall` | `{ server_time, items: [...] }` |
| GET | `/api/messages/:id` | mensaje + autor + comentarios |
| POST | `/api/messages` | `201 { id, created_at, expires_at }` |
| POST | `/api/messages/:id/comments` | `201 { id, created_at }` |
| POST | `/api/messages/:id/report` | `201 { ok: true }` |

`GET /api/wall`:

```json
{
  "server_time": "2026-10-25T12:00:00.000Z",
  "items": [
    {
      "id": 12,
      "content": "Hola muro",
      "author": "alice",
      "created_at": "...",
      "expires_at": "...",
      "comments_count": 4,
      "is_top": true
    }
  ]
}
```

Orden: `comments_count DESC, created_at DESC`. `is_top` es `true` solo para el
primero con `comments_count > 0`.

Errores: ver la tabla de `AGENTS.md` sección 5. El `error handler` mapea
`23P01`, `23505`, `23514`, `P0001`, `EC001`, `EC002`, `EC003` y Zod.

## 6. Frontend

### Pantallas

- **Muro**: héroe + grid de mensajes + countdown + estado vacío.
- **Detalle**: mensaje, comentarios y formulario.
- **Auth**: modal o pantalla de login/registro.
- **Reporte**: diálogo con motivo.
- **Estados**: loading, empty, error, expirado, sin sesión.

### Componentes

```text
App
├── Header
├── Wall
│   ├── TopMessage (héroe)
│   ├── MessageCard
│   └── EmptyState
├── MessageDetail
│   ├── CommentList
│   └── CommentForm
├── AuthDialog
├── ReportDialog
├── Countdown
└── Toast
```

### Estado y datos

- `useSession`: `GET /api/auth/me`, login/logout.
- `useWall`: polling cada 15 s; pausa con `document.hidden`; `server_time`.
- `useMessage`: detalle y comentarios; refetch tras comentar.
- Optimistic UI solo para el contador de comentarios; reconciliar con el
  servidor.
- Countdown calculado con `expires_at` y `server_time`, no con el reloj local.
- Errores 401 → abrir auth; 410 → quitar tarjeta y toast; 409 → mensaje claro.

### Accesibilidad

- Botones y formularios semánticos.
- Foco visible y trampa de foco en diálogos.
- `aria-live` para el contador y errores.
- `prefers-reduced-motion`.
- Responsive desde 360 px.

## 7. Sistema visual

- Único archivo: `web/css/style.css`.
- Sin Tailwind, CSS-in-JS, CSS Modules ni inline styles.
- Tokens en `:root`; BEM; mobile-first.
- La dirección visual vive en `.opencode/design-brief.md`; los overrides por feature van en `specs/<feature>/design-brief.md`.
- El implementer crea clases semánticas; el graphic-designer solo edita CSS.
- Gates del reviewer-estilo: integridad, regresión, estética, accesibilidad y
  limpieza.

## 8. Fases

| Fase | Entregable | Estado |
|---|---|---|
| 0 | Esquema PostgreSQL, constraints, triggers y purga | Completada |
| 1 | Scaffold, package.json, TS, lint, Docker (db/app/app-test), migraciones, healthcheck y base Playwright/Vitest | Completada (T01/T02) |
| 2 | Auth, sesiones en BD, cookies, rate limit | Completada (T03) |
| 3 | API de muro, mensajes, comentarios, reportes y purga | Completada (T04-T08) |
| 4 | Frontend shell, muro, héroe, countdown, detalle, auth y reportes | Completada (T09-T11) |
| 5 | Detalle, comentarios, auth y reportes | Completada (T10) |
| 6 | Polling, errores y pulido | Completada (T11) |
| 7 | Moderación, rate limit y hardening | Pendiente (T12) |
| 8 | Suite Playwright: API, DB, E2E y visual | Parcial (visual en V01/T13) |
| 9 | Documentación, diagramas y despliegue | Pendiente (T14) |

Los comandos `npm` ya existen y están descritos en `AGENTS.md` sección 8.

## 9. Tests

Runner principal: **Playwright Test**. Vitest solo para funciones puras.

### Proyectos

| Proyecto | Base | Qué valida |
|---|---|---|
| `setup` | Node + `pg` | Espera `migrate-test`; valida el esquema y `/healthz`; seeds en tests de negocio |
| `api` | `request` | `app-test` (8081): auth, muro, mensajes, comentarios, reportes y 401/403/409/410/422 |
| `db` | `pg` | `wall_test` (5433): constraints, triggers, expiración, purga y concurrencia |
| `e2e` | Navegador | `app-test`: dos usuarios, publicar, comentar, ranking, sesión y expiración |
| `visual` | Navegador | `app-test`: capturas 360/768/1280 y regresión visual |

### Configuración

- `playwright.config.ts` con proyectos `setup`, `api`, `db`, `e2e` y `visual`.
- `baseURL` = `TEST_BASE_URL` (`http://localhost:8081`).
- `migrate-test` aplica el esquema a `wall_test`; `globalSetup` limpia y
  siembra datos.
- `setup` espera `/healthz` de `app-test`; sin `webServer` si el stack de test
  ya está levantado.
- `TEST_DATABASE_URL` = `postgresql://wall:...@localhost:5433/wall_test`.
- `trace: "retain-on-failure"`, `screenshot: "only-on-failure"`,
  `video: "retain-on-failure"`.
- `workers: 1` para `db`; datos únicos por test para evitar colisiones.
- Evidencia: HTML report, traces, screenshots y vídeo en `evidence/`.
- Playwright no usa `app` ni `wall`; solo `app-test` y `wall_test`.

### Comandos

```sh
docker compose --profile test up -d   # db + migrate-test + app-test
npm run test:up                       # atajo del comando anterior
npm test                              # Playwright: api + db + e2e + visual
npm run test:api
npm run test:db
npm run test:e2e
npm run test:visual
npm run test:unit                     # Vitest: funciones puras
npm run test:all                      # test:up + unit + Playwright + test:down
npm run test:down
docker compose --profile test down
```

`test:all` orquesta `test:up`, Vitest, Playwright y `test:down`.

Los tests SQL siguen siendo independientes:

```sh
./scripts/validate-schema.sh
./scripts/validate-cron.sh
```

Criterio: ningún test se declara en verde sin ejecutarlo.

## 10. Seguridad

- Argon2id; sesión con token hasheado.
- Cookies `HttpOnly`, `SameSite=Lax`, `Secure` en producción.
- CSRF: `SameSite` + comprobación de `Origin`.
- Rate limit en auth, publicación, comentarios y reportes.
- Zod en todos los bordes.
- SQL parametrizado.
- XSS: texto plano; sin HTML del usuario.
- Logs sin contenido, tokens, contraseñas ni emails.
- Errores 500 sin detalles internos.
- CORS restringido al mismo origen.
- No secretos en el repositorio.

## 11. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Imagen `cybertecpostgresql/postgresql:16-3` no disponible | Usar `postgres:16` + `postgresql-16-cron` o una imagen verificada en fase 1 |
| `pg_cron` mal configurado | `shared_preload_libraries=pg_cron`, `cron.database_name=wall`; validar con `validate-cron.sh` |
| Sesiones en memoria | Sesiones en PostgreSQL desde la fase 2 |
| Ranking inflado | Un comentario por usuario y mensaje |
| Héroe “saltando” | Transición visual suave; el ranking es dinámico por diseño |
| Reloj del cliente desfasado | `server_time` y offset |
| Purga retrasada | Filtro `expires_at > now()` en todas las consultas |
| Comentarios ilimitados en la UI | Evaluar paginación si supera 100 |
| Moderación insuficiente | Lista local + reportes; servicio externo en fase posterior |
| Pérdida de datos por diseño | Datos efímeros; no se promete recuperación |
| XSS | React escapa; sin `dangerouslySetInnerHTML` |
| Abuso de cuentas | Rate limit; verificación de email fuera del MVP |

## 12. Despliegue

- Docker multi-stage: build de Vite + runtime Node.
- `docker compose` con `db`, `migrate`, `migrate-test`, `app`, `app-test` y `caddy`.
- `db` se publica en `5433` y contiene `wall` y `wall_test`; `pg_cron` solo en `wall`.
- `app` se publica en `8080` y usa `wall`; `app-test` se publica en `8081` y usa `wall_test`.
- `migrate` aplica `001_schema.sql` y `002_cron.sql` a `wall`;
  `migrate-test` aplica solo el esquema a `wall_test`.
- `app` y `app-test` dependen de su migración y de la salud de `db`.
- Caddy en 80/443; app en 3000 interna.
- Variables: `DB_PASSWORD`, `POSTGRES_PORT`, `APP_PORT`, `APP_TEST_PORT`,
  `TEST_BASE_URL`, `DATABASE_URL`, `TEST_DATABASE_URL`, `COOKIE_SECRET`,
  `TEST_COOKIE_SECRET`, `PORT`, `NODE_ENV`.
- Healthcheck `/healthz`.
- Logs estructurados sin contenido sensible.
- CI: `docker compose --profile test up -d`, `npm run test:all` y los scripts SQL.
- Artefactos de CI: Playwright HTML report, traces y screenshots.
- Datos efímeros: no se promete backup, pero el volumen de PostgreSQL se
  conserva para reinicios.

## 13. Decisiones

- Lectura pública; escritura autenticada.
- Un comentario por usuario y mensaje.
- Héroe dinámico, solo con `comments_count > 0`; empate por fecha.
- Polling 15 s; sin SSE/WebSocket.
- CSS plano en `web/css/style.css`.
- Sesiones en PostgreSQL.
- Moderación local en el MVP; reportes en cola.
- Sin edición ni borrado de mensajes/comentarios.
- Playwright es el runner de API/DB/E2E/visual; Vitest solo unitarios puros.
- Los tests de esquema y pg_cron siguen en SQL puro.
- PostgreSQL y app en Docker; DB en `5433`, app en `8080`, app-test en `8081`.
- `wall` para desarrollo y `wall_test` para tests; `pg_cron` solo en `wall`.
- Playwright en el host contra `app-test`; Vitest solo unitarios.

## 14. Preguntas abiertas

- Dirección visual definitiva (ver `.opencode/design-brief.md`).
- ¿Servicio de moderación externo desde el MVP?
- ¿Paginación de comentarios?
- ¿Vista mínima de reportes o SQL manual?
- ¿Umbral de auto-ocultado por reportes? Fuera del MVP.
