# Spec — 001 Muro 24h

- **Estado**: borrador para revisión
- **Feature**: `001-muro-24h`
- **Fuente**: `docs/`, `db/migrations/`, conversación de planificación
- **Autor**: planner
- **Fecha**: 2026-10-25

## 1. Resumen

Ecco es un muro público y efímero. Un usuario autenticado publica un mensaje de
solo texto que vive exactamente 24 horas. Durante ese tiempo, otros usuarios
pueden comentarlo. El mensaje con más comentarios se muestra como héroe del
muro mientras sea el máximo. Al vencer, el mensaje desaparece y la API responde
`410`.

## 2. Problema

Las redes sociales habituales priorizan permanencia y engagement infinito.
Ecco propone lo contrario: un espacio de baja fricción, texto puro y memoria
corta. La presión social se concentra en las 24 horas de vida del mensaje.

## 3. Usuarios

- **Visitante**: lee el muro y el detalle sin cuenta.
- **Autor**: se registra, publica un mensaje y ve su countdown.
- **Comentarista**: comenta mensajes ajenos una vez por mensaje.
- **Moderador (manual, fuera de UI)**: revisa reportes en la base de datos.

## 4. Objetivos

- Publicar mensajes de texto con una vida exacta de 24 h.
- Comentar mensajes activos con reglas anti-abuso.
- Destacar dinámicamente el mensaje más comentado.
- Purgar automáticamente lo vencido.
- Ofrecer una experiencia rápida, responsive y accesible.

## 5. No objetivos

- Mensajes permanentes, edición o borrado.
- Imágenes, enlaces, adjuntos o HTML.
- Mensajería privada o notificaciones.
- Panel de administración.
- Verificación de email o recuperación de contraseña.
- SSE/WebSocket.
- Multi-idioma.

## 6. Requisitos funcionales

| ID | Requisito | Criterio de aceptación |
|---|---|---|
| RF-01 | Lectura pública, escritura autenticada | `GET /api/wall` y `GET /api/messages/:id` responden sin cookie; `POST` de mensaje/comentario/reporte responde `401` sin sesión |
| RF-02 | Mensaje solo texto de 1–500 caracteres | Se recorta; vacío o solo espacios → `422`; 501 caracteres → `422`; moderación rechaza → `422` |
| RF-03 | Vida exacta de 24 h | `expires_at = created_at + 24h`; el muro solo incluye `expires_at > now()`; después `GET`/`POST` → `410` |
| RF-04 | Un mensaje activo por usuario | Dos mensajes solapados → el segundo `409 already_has_active_message`; al vencer el primero se puede publicar otro |
| RF-05 | Sin contenido duplicado activo | Contenido normalizado (trim, minúsculas, espacios colapsados) igual a otro activo → `409 duplicate_message`; al vencer, se libera |
| RF-06 | Comentarios 1–300; uno por usuario y mensaje | Comentar el propio → `403`; vencido → `410`; segundo comentario → `409 already_commented`; vacío/301 → `422` |
| RF-07 | Héroe del muro | El mensaje con más comentarios se muestra en tarjeta grande; solo si `comments_count > 0`; empate: `created_at DESC`; ranking dinámico |
| RF-08 | Purga automática | Job cada minuto borra mensajes vencidos y, en cascada, comentarios y reportes; la app no depende del job para filtrar |
| RF-09 | Reportes | Un reporte por usuario y mensaje; auto-reporte → `403`; vencido → `410`; duplicado → `409 already_reported` |
| RF-10 | Sesiones | Registro/login/logout; cookie `HttpOnly`; sesión de 7 días; token hasheado en BD; logout revoca |

## 7. Requisitos no funcionales

| ID | Requisito |
|---|---|
| RNF-01 | Responsive desde 360 px; WCAG AA; foco visible; teclado; `prefers-reduced-motion` |
| RNF-02 | Polling cada 15 s con `server_time`; pausa con pestaña oculta; `ETag` si es viable |
| RNF-03 | Argon2id; Zod; SQL parametrizado; rate limit; logs sin contenido sensible |
| RNF-04 | UTC en base; countdown calculado con `server_time`, no con el reloj del cliente |
| RNF-05 | Texto plano; React escapa; prohibido `dangerouslySetInnerHTML` |
| RNF-06 | Respuestas de error uniformes `{ code, message, issues? }` |
| RNF-07 | La UI debe funcionar con teclado y lector de pantalla básico |

## 8. Flujos

### 8.1 Publicar

1. El autor abre el muro.
2. Pulsa “Publicar”; si no tiene sesión, se abre login/registro.
3. Escribe 1–500 caracteres y envía.
4. La API valida, modera y comprueba reglas en la BD.
5. Si pasa, responde `201` con `id`, `created_at` y `expires_at`.
6. El muro se refresca y muestra el mensaje con countdown.

### 8.2 Comentar

1. El comentarista abre el detalle de un mensaje activo.
2. Escribe 1–300 caracteres.
3. La API comprueba sesión, expiración, autoría y duplicado.
4. Si pasa, inserta el comentario y el contador sube.
5. El muro recalcula el héroe.

### 8.3 Expiración

1. `pg_cron` ejecuta la purga cada minuto.
2. Borra mensajes con `expires_at <= now()` y sus comentarios/reportes.
3. La API ya filtraba por `expires_at > now()`.
4. El cliente elimina la tarjeta en el siguiente polling.

### 8.4 Reportar

1. Un usuario autenticado elige un mensaje ajeno activo.
2. Indica un motivo de 5–500 caracteres.
3. Se guarda un reporte `pending`.
4. No hay UI de moderación en el MVP.

## 9. Casos borde

- Dos publicaciones simultáneas del mismo usuario: una `201`, otra `409`.
- Dos comentarios simultáneos del mismo usuario: uno `201`, otro `409`.
- Mensaje que vence mientras se escribe el comentario: `410` y refresco.
- Contenido normalizado duplicado: `409`.
- Mensaje con solo espacios o saltos de línea: `422`.
- Mensaje de 501 caracteres o comentario de 301: `422`.
- Sesión vencida: `401` y re-login.
- Reporte duplicado: `409`.
- Auto-reporte: `403`.
- Countdown con reloj de cliente desfasado: usar `server_time`.
- Todos los mensajes con 0 comentarios: no hay héroe; el muro se ordena por fecha.
- Empate en el máximo: héroe el más reciente.
- Job de purga retrasado: el muro no muestra vencidos.
- Fallo de red en polling: conservar último estado y mostrar aviso discreto.
- XSS: `<script>` se muestra como texto.
- Comentarios numerosos: el MVP puede mostrar todos; si supera 100, evaluar paginación.

## 10. Supuestos

- Un mensaje activo por usuario, aunque tenga varios vencidos sin purgar.
- Un comentario por usuario y mensaje; `comments_count` equivale a participantes.
- Lectura pública; acciones de escritura autenticadas.
- El héroe es dinámico, no se “congela” al ganar.
- La moderación inicial es una lista local; se puede sustituir por un servicio.
- No hay borrado/edición de mensajes ni comentarios.
- La base de datos es PostgreSQL 16 con `pg_cron`.

## 11. Preguntas abiertas

- **Estética**: paleta, tipografía, tema claro/oscuro y referencias visuales. Debe resolverse en `.opencode/design-brief.md` antes del rediseño.
- **Moderación**: ¿lista local suficiente para el MVP o servicio externo desde el inicio?
- **Reportes**: ¿umbral de auto-ocultado? Fuera del MVP; por ahora solo cola.
- **Paginación de comentarios**: ¿hace falta si un mensaje supera 100 comentarios?
- **Admin**: ¿se necesita una vista mínima de reportes o basta SQL manual?

## 12. Criterios de aceptación globales

- `docker compose up -d --build` levanta app, PostgreSQL y Caddy; PostgreSQL en `5433`, app en `8080`.
- `docker compose --profile test up -d` levanta `app-test` (`8081`) y `wall_test` para Playwright.
- Registro, login, logout y sesión persistente.
- Publicar, comentar, reportar y ver el muro.
- Todas las reglas de la sección 6 se cumplen.
- Expiración visible y purga automática.
- Errores con códigos y mensajes correctos.
- Responsive 360 px, teclado y contraste AA.
- Tests Playwright (API, DB, E2E, visual) y unitarios Vitest en verde.
- Scripts SQL de esquema y `pg_cron` en verde cuando se toque la base.
- Sin secretos ni contenido sensible en logs.
