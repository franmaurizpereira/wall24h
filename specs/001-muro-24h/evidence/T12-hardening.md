# T12 — Moderación, rate limit y hardening

- **Estado**: done
- **Fecha**: 2026-10-26
- **Owner**: implementer
- **RF**: RF-02, RF-06, RF-09
- **RNF**: RNF-03

## Entregado

- CSP estricta con Helmet (`default-src`, `script-src`, `style-src`,
  `connect-src`, `frame-ancestors 'none'`, `object-src 'none'`); cabeceras
  `nosniff`, `X-Frame-Options` y `Referrer-Policy`.
- Comprobación de `Origin` en `POST`/`PUT`/`PATCH`/`DELETE`: mismo host,
  `APP_ORIGIN` explícito o `localhost:5173` en desarrollo; el resto, `403
  invalid_origin`.
- Rate limit de escritura por sesión hasheada (o IP si es anónimo):
  - publicar: 10/min;
  - comentar: 20/min;
  - reportar: 10/min.
- Respuesta 429 uniforme `{ code: "rate_limited", message }`.
- `TRUST_PROXY` para usar `X-Forwarded-For`/`X-Forwarded-Host` detrás de Caddy.
- Moderación normalizada: NFKC, minúsculas, sin diacríticos y espacios
  colapsados; se aplica a mensajes, comentarios y motivos de reporte.
- Logs de error 500 sin mensaje, stack, SQL, parámetros ni contenido: solo
  nombre, código, constraint y status.
- Respuesta 500 genérica `{ code: "internal_error", message: "Error interno" }`.

## Context7 consultado

- `/fastify/fastify-rate-limit`: opciones por ruta, `keyGenerator`,
  `errorResponseBuilder`, `groupId` y límites por ventana.
- `/fastify/fastify-helmet`: `useDefaults: false` y directivas CSP.

## Evidencia

```text
npm run typecheck       → OK
npm run lint            → OK
npm run test:unit       → 6 passed (2 archivos)
npm test                → 65 passed
```

Tests nuevos:

- `tests/api/security.spec.ts`:
  - cabeceras Helmet y CSP;
  - `Origin` no permitido → 403;
  - mismo `Origin` → 201;
  - 11 peticiones con la misma sesión → 10 × 422 + 429 `rate_limited`;
  - moderación de mayúsculas y diacríticos → 422 `content_not_allowed`.
- `tests/unit/security.test.ts`: `safeErrorForLog` no filtra mensaje, SQL,
  parámetros ni secretos.

Comprobación de logs:

```text
grep "contenido_prohibido|Mensaje con origen|password|session=" <log app>
→ sin coincidencias
```

## Notas

- El rate limit es en memoria por instancia; para varias instancias habría que
  usar Redis. Está documentado como limitación en T14.
- `APP_ORIGIN` y `TRUST_PROXY` se añadieron a `.env.example`.
- El CSP no usa `unsafe-inline`; la SPA no tiene scripts ni estilos inline.
- El límite por sesión evita que varios usuarios detrás de Caddy compartan el
  mismo cubo de escritura; el login/registro siguen limitados por IP.
