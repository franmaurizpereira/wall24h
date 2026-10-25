CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ================= DDL anterior (users, messages, comments, reports,
-- índices parciales, triggers) — copiado tal cual =================
-- [aquí va el DDL completo de la respuesta anterior]

-- ================= PURGA PROGRAMADA (job de las 24h) =================
SELECT cron.schedule(
    'purge-expired-messages',
    '*/10 * * * *',
    $purge$
        WITH expired AS (
            SELECT id FROM messages WHERE expires_at <= now()
        )
        DELETE FROM messages m
            USING expired e
           WHERE m.id = e.id;
    $purge$
);

-- Verificación:
-- SELECT jobid, jobname, schedule, command FROM cron.job;
