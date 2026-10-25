# Contrato de clases del frontend

Este documento es la lista de hooks que el `graphic-designer` puede estilizar
en `web/css/style.css` durante V01. El implementer no diseña ni modifica CSS.

## Shell

- `.app`: contenedor raíz.
- `.app__header`: cabecera.
- `.app__footer`: pie.
- `.brand`, `.brand__name`, `.brand__tagline`: identidad textual.

## Muro

- `.wall`: región principal del muro.
- `.wall__grid`: rejilla de mensajes que no son héroe.

## Mensajes

- `.message-card`: tarjeta de mensaje.
- `.message-card--top`: variante héroe (el más comentado).
- `.message-card__content`: texto plano del mensaje.
- `.message-card__meta`: autor, comentarios y countdown.
- `.message-card__author`: autor visible.
- `.message-card__comments`: contador de comentarios.
- `.badge`, `.badge--top`: distintivo del héroe.

## Countdown

- `.countdown`: tiempo restante.
- `.countdown--urgent`: menos de una hora.
- `.countdown--expired`: mensaje vencido.

## Estados

- `.state`: contenedor de estado.
- `.state--loading`: carga inicial o recarga.
- `.state--empty`: muro sin mensajes.
- `.state--error`: error de red o API.

## Controles

- `.button`: botón base.
- `.button--ghost`: acción secundaria (actualizar).
- `.button--primary`: acción principal (reintentar).

## Hooks de test

`data-testid`: `app`, `header`, `wall`, `wall-grid`, `top-message`,
`message-card`, `comment-count`, `countdown`, `wall-loading`, `empty-state`,
`wall-error`.
