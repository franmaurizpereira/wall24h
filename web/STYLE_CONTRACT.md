# Contrato de clases del frontend

Este documento es la lista de hooks que el `graphic-designer` puede estilizar
en `web/css/style.css` durante V01. El implementer no diseña ni modifica CSS.

## Shell

- `.app`: contenedor raíz.
- `.app__header`: cabecera.
- `.app__footer`: pie.
- `.brand`, `.brand__name`, `.brand__tagline`: identidad textual.
- `.header__actions`: bloque de acciones de la cabecera.
- `.session`, `.session__user`, `.session__loading`: estado de sesión.

## Muro

- `.wall`: región principal del muro.
- `.wall__grid`: rejilla de mensajes que no son héroe.
- `.wall__stale`: aviso no bloqueante de polling fallido.

## Mensajes

- `.message-card`: tarjeta de mensaje.
- `.message-card--top`: variante héroe (el más comentado).
- `.message-card--detail`: variante del detalle.
- `.message-card__content`: texto plano del mensaje.
- `.message-card__link`: enlace al detalle.
- `.message-card__meta`: autor, comentarios y countdown.
- `.message-card__author`: autor visible.
- `.message-card__comments`: contador de comentarios.
- `.message-card__actions`: acciones de la tarjeta.
- `.badge`, `.badge--top`: distintivo del héroe.
- `.message-detail`, `.message-detail__back`, `.message-detail__actions`: vista de detalle.
- `.comment-section`, `.comment-section__title`: bloques de comentarios.
- `.comment-list`, `.comment-list__empty`: lista de comentarios.
- `.comment`, `.comment__content`, `.comment__meta`, `.comment__author`, `.comment__date`: comentario.
- `.comment-form`, `.comment-form--guest`, `.comment-form__note`, `.comment-form__actions`: formulario.

## Diálogos y formularios

- `.dialog`, `.dialog__panel`, `.dialog__header`, `.dialog__title`,
  `.dialog__close`, `.dialog__actions`: base de diálogo nativo.
- `.auth-dialog`, `.auth-dialog__tabs`, `.auth-dialog__tab`,
  `.auth-dialog__form`: acceso.
- `.publish-dialog`, `.publish-dialog__form`, `.publish-dialog__hint`: publicación.
- `.report-dialog`, `.report-dialog__form`, `.report-dialog__preview`,
  `.report-dialog__author`, `.report-dialog__content`: reporte.
- `.field`, `.field__label`, `.field__input`, `.field__textarea`,
  `.field__help`, `.field__error`: campos.
- `.character-count`, `.character-count--warning`: contador de caracteres.

## Countdown

- `.countdown`: tiempo restante.
- `.countdown--urgent`: menos de una hora.
- `.countdown--expired`: mensaje vencido.

## Estados y avisos

- `.state`: contenedor de estado.
- `.state--loading`: carga inicial o recarga.
- `.state--empty`: muro sin mensajes.
- `.state--error`: error de red o API.
- `.state__actions`: acciones del estado.
- `.toast`, `.toast--success`, `.toast--error`, `.toast--info`,
  `.toast__message`, `.toast__close`: avisos.

## Controles

- `.button`: botón base.
- `.button--primary`: acción principal.
- `.button--secondary`: acción alternativa.
- `.button--ghost`: acción secundaria.
- `.button--danger`: acción destructiva.
- `.button--small`: tamaño compacto.
- `.link-button`: acción con apariencia de enlace.

## Hooks de test

`data-testid`: `app`, `header`, `wall`, `wall-grid`, `top-message`,
`message-card`, `message-link`, `comment-link`, `report-button`,
`comment-count`, `countdown`, `wall-loading`, `empty-state`, `wall-error`,
`open-auth`, `open-publish`, `logout`, `session-user`, `session-loading`,
`auth-dialog`, `auth-username`, `auth-email`, `auth-password`, `auth-submit`,
`auth-error`, `publish-dialog`, `publish-text`, `publish-submit`,
`publish-error`, `report-dialog`, `report-reason`, `report-submit`,
`report-error`, `message-detail`, `detail-loading`, `detail-error`,
`detail-back`, `detail-report`, `detail-comments-count`, `comment-list`,
`comment`, `comments-empty`, `comment-form`, `comment-auth`, `comment-own`,
`comment-already`, `comment-session-loading`, `comment-text`, `comment-submit`,
`comment-error`, `toast`, `wall-stale`, `open-admin`, `admin-panel`,
`admin-reports`, `admin-report`, `admin-review`, `admin-action`, `admin-hide`,
`admin-loading`, `admin-empty`, `admin-error`.
