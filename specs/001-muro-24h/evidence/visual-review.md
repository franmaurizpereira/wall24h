# V01 — Revisión visual

- **Estado**: PASS
- **Fecha**: 2026-10-25
- **Brief**: `.opencode/design-brief.md` (editorial oscuro de alto contraste con acento cálido)
- **Archivo fuente**: `web/css/style.css` (único modificado)
- **Revisor**: `reviewer-estilo`

## Veredicto

```text
Integridad:     PASS
Regresión:      PASS
Estética:       PASS
Accesibilidad:  PASS
Limpieza:       PASS
```

## Iteraciones

### 1.ª revisión — FAIL en accesibilidad

- Contraste no textual de `.field__input` / `.field__textarea` en reposo:
  1.95:1 contra el fondo y 1.65:1 contra el panel; mínimo WCAG 1.4.11: 3:1.
- A 200 % de texto y 360 px, las pestañas de auth se partían letra a letra.
- El username de sesión se truncaba a 12ch en móvil.
- La affordance del enlace del mensaje dependía solo del hover.
- Valores literales repetidos sin token.

### 2.ª revisión — PASS

- Nuevo borde de campo `#66707f`: **3.99:1** contra el fondo del campo y
  **3.36:1** contra el panel del diálogo; hover `#7d8798` 5.52/4.65; foco de
  acento 9.62 más halo de 3 px.
- Pestañas auth con `flex-wrap` y `white-space: nowrap`; a 200 % / 360 px
  ocupan dos filas sin cortar palabras.
- Sesión sin truncado; el username completo refluye.
- Enlace del mensaje con subrayado neutro en reposo y acento en hover/focus.
- Tokens para textos, sombra de hover y acentos; `--transition-fast` a 150 ms.
- `.wall` y `.message-detail` con `align-content: start`.

## Evidencia

- `npm test` → **60 passed**.
- `npm run test:unit` → **4 passed**.
- `npx prettier --check web/css/style.css` → OK.
- `npm run build:web` → OK.
- Sin overflow horizontal a 360/480/640/768/1024/1280 ni con texto al 200 %.
- Foco visible, orden lógico, foco retenido en diálogos nativos y `Escape`.
- `prefers-reduced-motion`: transiciones a 0.01 ms y sin transform en hover.

## Capturas

En `specs/001-muro-24h/evidence/screenshots/`:

- `before-{360,768,1280}.png`: baseline sin CSS.
- `after-{360,768,1280}.png`: muro final con héroe y grid.
- `after-detail-{360,768,1280}.png`: detalle y comentarios.
- `after-dialog-{360,768,1280}.png`: auth.
- `after-dialog-200-360.png`: auth con texto al 200 %.
- `after-auth-dialog-{360,768}.png`.
- `after-publish-dialog-{360,768}.png`.
- `after-report-dialog-{360,768}.png`.
- `after-session-{360,200-360}.png`.
- `after-states-{360,768}.png`: héroe, countdown urgente/expirado,
  loading/empty/error, toast y campos en error.
- `after-focus-{360,768}.png`.
- `after-reduced-motion-768.png`.

## Hallazgos menores asumidos

- A 200 % de texto y 360 px la cabecera ocupa tres filas con un username de 32
  caracteres; no hay corte ni overflow, pero es densa. Se prioriza no truncar.
- El subrayado del héroe recorre líneas completas y reduce algo el aire
  editorial; es el coste de hacer visible la affordance del enlace.
- `GET /api/auth/me` devuelve 401 en consola cuando no hay sesión; es el
  comportamiento esperado del hook de sesión, no del CSS.
