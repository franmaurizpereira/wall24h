# T14 — Documentación y despliegue

- **Estado**: done
- **Fecha**: 2026-10-26
- **Owner**: implementer
- **RF**: —

## Entregado

- `README.md` reescrito con estado final, arquitectura Mermaid, arranque rápido,
  perfil de test, puertos, variables, migraciones, testing, despliegue,
  estructura, roadmap y seguridad.
- `docs/despliegue.md`: guía operativa de producción con Caddy/TLS, backups,
  restauración, actualización, rollback, checklist y limitaciones.
- `docs/estructura.md` marcado como histórico y apuntando a la documentación
  actual.
- `docker-compose.yml`: `NODE_ENV`, `TRUST_PROXY` y `APP_ORIGIN` configurables;
  `app-test` fija `TRUST_PROXY=false` y `APP_ORIGIN` vacío.
- `Caddyfile`: compresión y bloque de producción documentado con TLS automático.
- `.env.example`: `APP_ORIGIN`, `TRUST_PROXY`, `LOG_LEVEL` y
  `MODERATION_BANNED_WORDS`.

## Evidencia

```text
npm run typecheck       → OK
npm run lint            → OK
npm run build           → OK
npm run format:check    → OK
npm test                → 68 passed
npm run test:unit       → 6 passed
npm run test:visual     → 4 passed
npm run test:all        → OK (test:up + unit + 68 Playwright + test:down)
./scripts/validate-schema.sh → OK
./scripts/validate-cron.sh   → OK (pg_cron purgó el mensaje)
```

Validación del Compose:

```text
python3 yaml.safe_load(docker-compose.yml)
→ servicios: db, migrate, migrate-test, app, app-test, caddy
```

## Notas

- `npm run test:all` se ejecutó con Docker Compose: levantó `db`,
  `migrate-test` y `app-test`, ejecutó Vitest y los 68 tests Playwright, y
  ejecutó `test:down`. El servicio `db` queda levantado por diseño de
  `test:down`.
- El host no tenía `.env`; se pasaron las variables de test inline. Para uso
  normal, copia `.env.example` a `.env`.
- No hay CI/CD ni métricas DORA; se dejó un plan separado.
- Producción requiere `NODE_ENV=production`, `TRUST_PROXY=true` detrás de
  Caddy y `APP_ORIGIN` con el dominio HTTPS.
- No se publican los puertos `5433`, `8080` ni `8081` en producción.
- El rate limit es en memoria; para varias réplicas se necesita Redis.
- Las migraciones no tienen rollback: backup/restore antes y después.
