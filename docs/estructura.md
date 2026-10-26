# Estructura del proyecto (histórico)

> Documento histórico de la fase inicial. La estructura actual, los comandos y
> el despliegue están en `README.md` y `docs/despliegue.md`. Los diagramas PNG
> de `docs/` son referencia original y pueden no coincidir con el estado actual.

wall24h/
├── docker-compose.yml
├── Dockerfile
├── Caddyfile
├── .env.example
├── db/
│   └── init.sql          ← el DDL anterior + pg_cron programado
└── src/
    ├── db.js
    └── server.js         ← Fastify con las 4 reglas cableadas
