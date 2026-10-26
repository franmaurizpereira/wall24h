# Base de datos — Ecco / Muro 24h

Esquema PostgreSQL de la aplicación: mensajes de solo texto con vida de 24 h,
comentarios, reportes, sesiones y purga automática.

## Archivos

| Archivo | Contenido |
|---|---|
| `migrations/001_schema.sql` | Extensiones, tablas, constraints, triggers, índices y funciones de purga |
| `migrations/002_cron.sql` | Jobs de `pg_cron` para purgar mensajes y sesiones |
| `migrations/003_moderation.sql` | `hidden_at`/`hidden_by` en mensajes y auditoría de reportes; guards de mensajes ocultos |
| `tests/schema_test.sql` | Pruebas de reglas, constraints, triggers, inmutabilidad y purga |
| `Dockerfile` | Imagen de PostgreSQL 16 con `pg_cron` |
| `../scripts/validate-schema.sh` | Validación reproducible del esquema base |
| `../scripts/validate-cron.sh` | Validación reproducible de `pg_cron` (tarda hasta 75 s) |

## Aplicar el esquema

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/001_schema.sql
```

`002_cron.sql` solo debe aplicarse en un PostgreSQL con:

```text
shared_preload_libraries = 'pg_cron'
cron.database_name      = 'wall'
```

Sin esas opciones, los jobs se registran pero el worker no los ejecuta.

## Docker

El entorno principal usa PostgreSQL 16 + `pg_cron` en el servicio `db` de
`docker-compose.yml`, publicado en `localhost:5433`:

- `wall`: desarrollo, con los jobs de `pg_cron`.
- `wall_test`: tests, sin cron; se migra con `migrate-test`.
- Dentro de los contenedores se usa `db:5432`; desde el host, `localhost:5433`.

## Validar

Con `podman` o `docker` y el cliente `psql` instalados:

```sh
./scripts/validate-schema.sh
./scripts/validate-cron.sh
```

`validate-schema.sh` usa `postgres:16-alpine` y crea una base desechable.
`validate-cron.sh` construye una imagen local con `postgres:16` +
`postgresql-16-cron`, aplica los dos migrations y espera a que el job borre
un mensaje vencido.

Los tests de aplicación (API, DB con Playwright, E2E y visual) viven en
`tests/` y usan Playwright. Estos scripts SQL siguen siendo la validación
directa del esquema y de `pg_cron`; no se migran al runner de aplicación.

## Reglas implementadas

- **Un mensaje activo por usuario.** Se usa una `EXCLUDE USING gist` sobre
  `(user_id, tstzrange(created_at, expires_at))`. No se usan índices parciales
  con `now()` porque PostgreSQL exige predicados `IMMUTABLE`.
- **Sin contenido duplicado mientras ambos mensajes estén activos.** La
  exclusion constraint usa `content_hash`, calculado con
  `normalize_hash(content)` en una columna generada.
- **Duración exacta de 24 h.** Un trigger `BEFORE INSERT` fija
  `expires_at = created_at + interval '24 hours'`; un `CHECK` refuerza la
  invariante y otro trigger impide modificarla.
- **Solo texto.** `content` y `content` de comentarios tienen `CHECK` de
  longitud y de al menos un carácter no blanco.
- **No comentar el propio mensaje.**
- **No comentar ni reportar mensajes vencidos.**
- **Ocultado por moderación.** `messages.hidden_at` retira el mensaje del muro
  y del detalle; los guards también bloquean comentarios y reportes con
  `410 message_gone`. La fila se conserva para auditoría.
- **Auditoría de reportes.** `reports.reviewed_at` y `reviewed_by` registran
  la última revisión manual; `status` pasa a `reviewed` o `actioned`.
- **Un comentario por usuario y mensaje.**
- **Un reporte por usuario y mensaje; no auto-reportarse.**
- **`comments_count` denormalizado** y sincronizado con triggers
  `AFTER INSERT/DELETE`.
- **Purga en cascada** de mensajes vencidos, comentarios y reportes.
- **Sesiones en base de datos** con token hasheado (sha256 en hex).

## Códigos de error para la API

| SQLSTATE / constraint | Código de aplicación | HTTP |
|---|---|---|
| `P0001` | `cannot_comment_on_own_message` | 403 |
| `EC001` | `message_gone` | 410 |
| `EC002` | `cannot_report_own_message` | 403 |
| `EC003` | `message_immutable` | 409 |
| `23P01` + `uq_messages_active_per_user` | `already_has_active_message` | 409 |
| `23P01` + `uq_messages_active_no_duplicates` | `duplicate_message` | 409 |
| `23505` + `uq_comments_one_per_user_message` | `already_commented` | 409 |
| `23505` + `reports_one_per_user_message` | `already_reported` | 409 |
| `23505` + `users_username_key` / `users_email_key` | `already_exists` | 409 |
| `23514` | `invalid_input` | 422 |

La API de la fase 2/3 debe mapear estos códigos. El `server.js` actual solo
mapea `P0001` y `23505`, así que esa parte queda pendiente para la siguiente
fase.

## Notas de despliegue

- El tag `cybertecpostgresql/postgresql:16-3` que aparece en `docs/` **no está
  disponible públicamente** (Docker Hub devuelve acceso denegado). Para la
  validación se construyó una imagen local desde `postgres:16` instalando
  `postgresql-16-cron`.
- La aplicación debe seguir filtrando `expires_at > now()` en las consultas del
  muro; la purga puede tardar hasta un minuto y no debe ser la única defensa.
- `cron.database_name` debe coincidir con la base donde se creó la extensión.
