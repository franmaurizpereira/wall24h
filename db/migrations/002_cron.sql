-- ============================================================
-- pg_cron — Purga automática
--
-- Requisitos de despliegue:
--   shared_preload_libraries = 'pg_cron'
--   cron.database_name      = 'wall'
--
-- Sin esas dos opciones el worker de pg_cron no ejecuta los jobs.
-- Aplicar este archivo solo en el PostgreSQL que tenga pg_cron.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Hacer la migración idempotente: eliminar jobs previos con el mismo nombre.
DO $$
DECLARE
    jid bigint;
BEGIN
    FOR jid IN
        SELECT jobid
        FROM cron.job
        WHERE jobname IN ('purge-expired-messages', 'purge-expired-sessions')
    LOOP
        PERFORM cron.unschedule(jid);
    END LOOP;
END;
$$;

-- Cada minuto: mensajes vencidos y sus comentarios/reportes en cascada.
SELECT cron.schedule(
    'purge-expired-messages',
    '* * * * *',
    'SELECT public.purge_expired_messages();'
);

-- Cada hora al minuto 17: sesiones vencidas.
SELECT cron.schedule(
    'purge-expired-sessions',
    '17 * * * *',
    'SELECT public.purge_expired_sessions();'
);
