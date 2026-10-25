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
