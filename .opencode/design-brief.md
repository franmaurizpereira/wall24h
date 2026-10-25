# Design Brief — Ecco / Muro 24h

> Documento de referencia. **No es un agente** y no se carga como configuración
> de OpenCode. Es el brief visual canónico del proyecto.

- **Estado**: aprobado el 2026-10-25 y aplicado en V01
- **Feature inicial**: `001-muro-24h`
- **Alcance**: apariencia visual del muro, detalle, auth y estados
- **Archivo permitido**: `web/css/style.css`

> Dirección aprobada: **editorial oscuro de alto contraste con acento cálido**.
> Aplicada en `web/css/style.css` y validada por `reviewer-estilo` (PASS en los
> 5 gates). Las capturas están en `specs/001-muro-24h/evidence/screenshots/`.

## 1. Personalidad

Ecco es efímero, directo y social, pero sin la ansiedad de una red social
tradicional. La interfaz debe transmitir:

- **Urgencia tranquila**: el countdown importa, pero no debe angustiar.
- **Claridad**: texto primero, sin ruido visual.
- **Contraste**: el héroe se siente distinto sin aplastar al resto.
- **Calidez**: un acento humano evita la sensación de panel administrativo.

## 2. Principios

- El contenido manda; la decoración no compite con el texto.
- Jerarquía clara: héroe > tarjetas > detalle > acciones.
- Un solo acento de color; el resto es neutro.
- Estados visibles sin depender solo del color.
- Mobile-first; la experiencia en 360 px es la referencia.
- Movimiento discreto y opcional.

## 3. Restricciones

- Solo se edita `web/css/style.css`.
- No se cambia el markup, las clases, el copy ni el comportamiento.
- Sin Tailwind, CSS-in-JS, CSS Modules, estilos inline ni `@import`.
- Tokens en `:root`; organización por secciones.
- Sin `!important` salvo justificación documentada.
- Debe funcionar con el DOM y las clases que entregue el implementer.

## 4. Dirección aprobada: editorial oscuro

Dirección aprobada por el usuario: **editorial oscuro de alto contraste**, con
un acento cálido.

| Token | Propuesta inicial |
|---|---|
| Fondo | Negro azulado muy oscuro |
| Superficie | Gris carbón con bordes sutiles |
| Texto principal | Blanco roto |
| Texto secundario | Gris claro |
| Acento | Ámbar/coral cálido |
| Peligro | Rojo legible sobre oscuro |
| Éxito | Verde desaturado |
| Tipografía display | Sans de personalidad fuerte, gran tamaño |
| Tipografía texto | Sans legible, 16–18 px base |
| Radios | Medios, 12–20 px |
| Sombras | Suaves, solo para elevar héroe/diálogos |
| Movimiento | 150–250 ms; respetar `prefers-reduced-motion` |

Estos valores son una hipótesis de partida, no una decisión cerrada. El usuario
debe aprobarlos o sustituirlos.

## 5. Jerarquía del muro

- **Header**: marca, estado de sesión, botón “Publicar”.
- **Héroe**: tarjeta grande, texto más grande, badge “Más comentado”, countdown
  visible y CTA de comentar.
- **Grid**: tarjetas medianas; orden por comentarios y fecha.
- **Countdown**: legible, no dominante; cambia de tono cerca del vencimiento.
- **Detalle**: mensaje, comentarios, formulario y acciones.
- **Auth**: diálogo claro, sin competir con el muro.
- **Reporte**: diálogo breve con motivo y confirmación.

## 6. Componentes y estados

- Botones primario, secundario, ghost y peligro.
- Inputs y textareas con label, ayuda, error y foco.
- Tarjetas con hover/focus, estado “tu mensaje” y estado “vencido”.
- Badge de héroe y badge de comentarios.
- Toast de error/éxito.
- Empty state: “El muro está vacío”.
- Loading: skeleton o placeholder discreto.
- Error: mensaje claro y acción de reintento.
- Deshabilitado: visible, no solo con opacidad.

## 7. Responsive

- 360 px: una columna, héroe a ancho completo, acciones apiladas.
- 480 px: una columna con más aire.
- 768 px: dos columnas para el grid; héroe a ancho completo.
- 1024/1280 px: grid de tres columnas; héroe destacado.
- Sin overflow horizontal; texto legible sin zoom.

## 8. Accesibilidad

- Contraste AA: 4.5:1 texto normal, 3:1 texto grande/UI.
- Foco visible en todos los controles.
- Navegación por teclado y orden lógico.
- `aria-live` para el contador y errores.
- `prefers-reduced-motion` respetado.
- El color no es el único indicador de estado.
- Texto al 200 % sin pérdida de contenido.

## 9. Referencias y anti-referencias

Referencias a confirmar por el usuario:

- Editoriales digitales con tipografía grande.
- Interfaces oscuras con un acento cálido.
- Tableros sociales minimalistas.

Evitar:

- Estética de panel de administración.
- Gradientes excesivos, glassmorphism o neón.
- Animaciones constantes.
- Tarjetas idénticas sin jerarquía.
- Contraste bajo “por estética”.

## 10. Entregables del diseñador

- `web/css/style.css` completo y organizado.
- Capturas antes/después en 360/768/1280.
- Notas de accesibilidad y motion.
- Lista de hooks/clases faltantes, si hay.
- Sin cambios fuera de `web/css/style.css`.

## 11. Criterios de aprobación

- [x] La dirección visual está aprobada por el usuario.
- [ ] El héroe se distingue claramente del resto.
- [ ] El countdown y los comentarios se leen bien.
- [ ] Responsive 360–1280 sin overflow.
- [ ] Contraste AA y foco visible.
- [ ] Estados hover/focus/active/disabled/loading/empty/error.
- [ ] Sin CSS muerto, duplicados ni `!important` injustificado.
- [ ] Solo cambió `web/css/style.css`.

## 12. Preguntas abiertas

La dirección general está aprobada. Quedan como libertad del `graphic-designer`
dentro del brief:

- Tipografía concreta y escala.
- Densidad (compacta o aireada) sin perder legibilidad a 360 px.
- Acento cálido exacto (ámbar o coral).
- Referencias visuales concretas; si no se aportan, el diseñador propone y
  documenta las suyas.
