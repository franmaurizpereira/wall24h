# MEMORY.md — Ecco / Muro 24h

> Memoria operativa. Máximo ~50 líneas. No guardar secretos.
> Si algo se vuelve regla permanente, moverlo a `AGENTS.md`.

## Estado actual (2026-10-25)

- Fase 0 completada: esquema PostgreSQL, constraints, triggers, purga y tests en `db/`.
- Fase 1 completada (T01/T02): `package.json`, Fastify base con `/healthz`, Docker Compose (`db`, `app`, `app-test`), migraciones y tests Playwright/Vitest.
- Andamiaje SDD creado: `AGENTS.md`, `.opencode/agents/` y `specs/001-muro-24h/`.
- No hay frontend ni API de negocio todavía.
- Brief visual en `.opencode/design-brief.md`; es un documento, no un agente. Pendiente de aprobación.
- Siguiente paso: T03 auth y sesiones.

## Decisiones importantes

- `coordinator` es primary y orquesta; planner/reviewer/implementer/visual son subagentes. Motivo: un subagente no puede lanzar otros subagentes con la profundidad por defecto.
- CSS plano en `web/css/style.css`, sin Tailwind ni inline styles. Motivo: el `graphic-designer` solo puede editar ese archivo.
- Artefactos en `specs/<feature>/`. Motivo: separar spec/plan/tareas de la configuración de agentes.
- Lectura pública; escritura autenticada. Motivo: bajar la fricción del muro sin permitir abuso anónimo.
- Un mensaje activo por usuario, sin duplicado activo, 24 h exactas. Motivo: reglas del producto y constraints de BD.
- Un comentario por usuario y mensaje; héroe top 1 dinámico. Motivo: evitar inflar el ranking y mantener `comments_count` como participantes.
- Polling 15 s; sesiones en BD; reportes en cola. Motivo: MVP simple, multi-instancia y moderación básica.
- Testing: Playwright para API/DB/E2E/visual; Vitest solo unitarios puros; tests SQL en `psql`. Motivo: un runner para flujos reales y velocidad para funciones puras.
- Docker: PostgreSQL + app en compose; DB 5433, app 8080, app-test 8081; el PostgreSQL local del 5432 queda fuera. Motivo: entorno reproducible y sin conflictos.
- Context7: documentación de librerías; Playwright: verificación visual. Motivo: evitar APIs desactualizadas y validar la UI real.

## Errores a evitar

- No usar `docs/init.sql` ni `docs/codigo_base_de_datos_postgres.sql`: están obsoletos.
- No volver a índices parciales con `now()`: no son IMMUTABLE. Usar exclusion constraints.
- No usar `CREATE CONSTRAINT TRIGGER ... BEFORE`: PostgreSQL solo lo permite AFTER ROW.
- No editar `web/css/style.css` desde el implementer; es del graphic-designer.
- No editar código desde coordinator/planner; no editar specs desde implementer.
- No leer `.env` ni imprimir secretos; usar `.env.example`.
- No inventar comandos: los `npm` aún no existen.
- No usar React Testing Library ni apuntar Playwright a producción; usar `TEST_DATABASE_URL`.
- No usar Context7 para reglas de negocio ni pegar claves o datos sensibles en las queries.
- No usar `localhost` dentro de contenedores; usar `db:5432`. No testear contra `wall`.
- No confundir `web/css/style.css` con `css/style.css` en la raíz.
