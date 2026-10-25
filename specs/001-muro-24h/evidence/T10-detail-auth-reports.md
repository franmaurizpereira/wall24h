# T10 — Detalle, comentarios, auth y reportes UI

- **Estado**: done
- **Fecha**: 2026-10-25
- **Owner**: implementer
- **RF**: RF-01, RF-06, RF-09

## Entregado

- Detalle en `/messages/:id` con mensaje, comentarios, countdown, autor y
  acciones; vuelta al muro y estado `410` para mensajes vencidos.
- `CommentForm` con validación 1–300, contador, estados de sesión, mensaje
  propio y comentario ya publicado.
- `AuthDialog` con login y registro, errores 401/409/422/429 y diálogo nativo
  con foco atrapado.
- `ReportDialog` con motivo 5–500, errores 403/409/410/422/429 y confirmación.
- `PublishDialog` para publicar desde la cabecera, con errores de mensaje
  activo, duplicado, validación y sesión expirada.
- `Toast` accesible para éxito, error e información.
- `useSession`, `useMessage` y router mínimo con History API.
- Botones de comentar/reportar en tarjetas y héroe; enlaces al detalle.
- `web/STYLE_CONTRACT.md` actualizado con todas las clases y hooks nuevos.

## Context7 consultado

- `/react/react` versión `19.3.0`: `createRoot`, hooks, limpieza de efectos y
  composición de componentes.
- `/vitejs/vite` versión `8.0.10`: build, root y proxy de desarrollo.

## Evidencia

```text
npm run typecheck       → OK
npm run lint            → OK
npm run build:web       → OK
npm run format:check    → OK
npm test                → 55 passed
```

Tests nuevos:

- `tests/e2e/auth.spec.ts`: registro, logout, login y error de credenciales.
- `tests/e2e/detail.spec.ts`: detalle, comentario, contador, mensaje propio,
  sesión requerida y `410`.
- `tests/e2e/publish.spec.ts`: publicación, segundo mensaje activo y duplicado.
- `tests/e2e/reports.spec.ts`: reporte, duplicado, auto-reporte y sesión
  requerida.
- `tests/helpers/ui.ts`: helpers de registro y sesión directa para no agotar el
  rate limit de registro en cada spec.

## Notas

- El orden de proyectos Playwright es `setup → e2e → api → db` para que el test
  de rate limit de login no bloquee el login E2E. Es una decisión de test, no
  de producto.
- Los tests de detalle/publicación/reportes crean la sesión directamente en la
  base; el formulario de auth se ejercita en `auth.spec.ts`.
- La UI sigue sin estilos visuales; V01 aplicará el brief aprobado.
- Siguiente tarea: T11 (polling, errores y pulido).
