# T09 — Shell del frontend, muro y héroe

- **Estado**: done
- **Fecha**: 2026-10-25
- **Owner**: implementer
- **RF**: RF-01, RF-03, RF-07

## Entregado

- Shell React 19 + Vite 8 + TypeScript en `web/`.
- `GET /api/wall` desde `web/src/api/client.ts` con errores uniformes.
- Muro público con:
  - héroe (`is_top`) y grid del resto de mensajes;
  - contador de comentarios;
  - countdown calculado contra `server_time`, no contra el reloj local;
  - estados de carga, vacío y error;
  - refresco manual.
- `web/STYLE_CONTRACT.md` documenta las clases semánticas para V01.
- `Dockerfile` multi-stage: `deps` → `web-build` → `prod-deps` → `runtime`;
  Fastify sirve `web/dist` y mantiene el fallback SPA.
- `web/css/style.css` queda como placeholder; el rediseño visual es V01.

## Context7 consultado

- `/vitejs/vite` versión `8.0.10`: `root`, `build.outDir`, `server.proxy` y
  configuración de Vite.
- `/react/react` versión `19.3.0`: `createRoot` desde `react-dom/client` y
  renderizado de la aplicación.

## Evidencia

```text
npm run typecheck       → OK
npm run lint            → OK
npm run build:web       → OK (web/dist)
npm run format:check    → OK
npm run test:unit       → OK (sin tests unitarios todavía)
npm run test:e2e        → 5 passed
npm test                → 44 passed
podman build -t wall24h-app:test . → OK
```

Tests E2E en `tests/e2e/wall.spec.ts`:

- Héroe, grid, contador de comentarios y countdown.
- Estado vacío.
- Estado de carga con la API retrasada.
- Estado de error con la API en 500.

## Notas

- La suite completa pasó contra PostgreSQL 16.15 real en `wall_test` y la app
  sirviendo `web/dist` en el puerto 3000.
- `npm run test:e2e` usa el navegador Chromium de Playwright.
- La UI aún no tiene estilos visuales; V01 aplicará el brief aprobado.
- Siguiente tarea: T10 (detalle, comentarios, auth y reportes UI).
