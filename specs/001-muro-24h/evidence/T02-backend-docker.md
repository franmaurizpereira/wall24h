# T02 — Backend base, Docker y migraciones

- **Estado**: done
- **Fecha**: 2026-10-25
- **Owner**: implementer

## Entregado

- Fastify base con `GET /healthz` y comprobación de PostgreSQL.
- Pool `pg`, manejo central de errores y mapeo de errores de dominio/PostgreSQL.
- `Dockerfile` multi-stage y `db/Dockerfile` con PostgreSQL 16 + `pg_cron`.
- `docker-compose.yml` con `db`, `migrate`, `migrate-test`, `app`, `app-test`,
  `caddy`.
- `db/init/00-create-test-db.sql`.
- `scripts/migrate.sh`, `scripts/migrate-test.sh`, `scripts/test-up.sh`,
  `scripts/test-down.sh`, `scripts/test-all.sh`, `scripts/with-env.mjs`.
- `Caddyfile`.
- Tests `tests/setup/global.setup.ts`, `tests/api/health.spec.ts`,
  `tests/db/schema.spec.ts`.

## Evidencia

Validación con PostgreSQL 16.15 + `pg_cron`:

```text
scripts/migrate.sh        → 001_schema.sql y 002_cron.sql aplicadas
scripts/migrate.sh (2ª)   → ambas ya aplicadas (idempotente)
scripts/migrate-test.sh   → wall_test recreada y 001_schema.sql aplicado
npm test                  → 3 passed (setup, api/health, db/schema)
GET /healthz              → 200 {"status":"ok","db":"ok"}
```

Validación de imágenes con podman:

```text
podman build db/Dockerfile → OK
podman build Dockerfile    → OK
wall24h-app:test contra PostgreSQL real → /healthz 200
```

El `docker-compose.yml` se parseó correctamente y declara:

```text
services: app, app-test, caddy, db, migrate, migrate-test
volumes: caddy_config, caddy_data, dbdata
```

## Notas

- En este entorno no hay Docker Compose, solo podman; el compose se validó de
  forma estática y el stack equivalente se probó con podman + PostgreSQL real.
- `app-test` y `migrate-test` están en el perfil `test`.
- La SPA se integra en T09; la app base solo expone `/healthz` y prepara
  `/api/*`.
