# T11 — Polling, errores y pulido

- **Estado**: done
- **Fecha**: 2026-10-25
- **Owner**: implementer
- **RF**: RF-03, RF-07
- **RNF**: RNF-01, RNF-02

## Entregado

- `usePolling`: refresco cada 15 s, pausa con `document.hidden` y refresh
  inmediato al volver a la pestaña.
- `useWall`: conserva los últimos datos si falla un polling; expone `stale`.
- Aviso no bloqueante `wall-stale` con acción de reintento.
- Countdown recalibrado con cada `server_time` y estable ante el polling.
- El héroe se reordena al refrescar sin mostrar el estado de carga.
- La vista mantiene el muro si un refresco falla; el error de carga inicial
  sigue mostrando el estado de error con reintento.
- Responsive comprobado a 360, 768 y 1280 px sin overflow horizontal.

## Context7 consultado

- `/react/react` versión `19.3.0`: hooks, limpieza de efectos y composición.
- `/vitejs/vite` versión `8.0.10`: build de producción y variables de entorno.

## Evidencia

```text
npm run typecheck       → OK
npm run lint            → OK
npm run build           → OK
npm run format:check    → OK
npm test                → 60 passed
npm run test:unit       → 4 passed
```

Tests nuevos:

- `tests/e2e/polling.spec.ts`:
  - polling a 15 s y reordenación del héroe;
  - pausa con pestaña oculta y refresh al volver;
  - fallo de polling sin perder datos;
  - countdown visible y no expirado;
  - sin overflow a 360/768/1280.
- `tests/unit/format.test.ts`: `formatComments` y `formatCountdown`.

## Notas

- La regresión visual con snapshots se consolida en V01, cuando
  `web/css/style.css` tenga el diseño aprobado; ahora mismo el CSS es un
  placeholder. La comprobación responsive ya está cubierta en E2E.
- El polling no se dispara con la pestaña oculta; al volver hace un fetch
  inmediato.
- Un fallo de red durante el polling no borra los datos ni muestra el estado de
  error de carga inicial.
