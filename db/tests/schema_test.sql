-- ============================================================
-- Pruebas de integridad del esquema (PostgreSQL 16+)
-- Se ejecutan sobre una base de datos desechable.
--
-- Uso:
--   psql -v ON_ERROR_STOP=1 -f db/tests/schema_test.sql
-- ============================================================

\set ON_ERROR_STOP on

SET client_min_messages = warning;
SET plpgsql.check_asserts = on;

BEGIN;

CREATE TEMP TABLE _test_ids (
    name text PRIMARY KEY,
    id   bigint NOT NULL
) ON COMMIT PRESERVE ROWS;

DO $$
DECLARE
    ua   bigint;
    ub   bigint;
    uc   bigint;
    ud   bigint;
    ue   bigint;
    ma   bigint;
    mb   bigint;
    mc   bigint;
    mc2  bigint;
    mdel bigint;
    cid  bigint;
    deleted integer;
    cname text;
BEGIN
    INSERT INTO public.users (username, email, password_hash)
    VALUES ('alice', 'alice@example.com', 'hash')
    RETURNING id INTO ua;

    INSERT INTO public.users (username, email, password_hash)
    VALUES ('bob', 'bob@example.com', 'hash')
    RETURNING id INTO ub;

    INSERT INTO public.users (username, email, password_hash)
    VALUES ('carol', 'carol@example.com', 'hash')
    RETURNING id INTO uc;

    INSERT INTO public.users (username, email, password_hash)
    VALUES ('dave', 'dave@example.com', 'hash')
    RETURNING id INTO ud;

    INSERT INTO public.users (username, email, password_hash)
    VALUES ('eve', 'eve@example.com', 'hash')
    RETURNING id INTO ue;

    INSERT INTO _test_ids (name, id) VALUES
        ('ua', ua), ('ub', ub), ('uc', uc), ('ud', ud), ('ue', ue);

    -- --------------------------------------------------------
    -- Normalización y hash
    -- --------------------------------------------------------
    ASSERT public.normalize_hash('  Hola   MUNDO ') = public.normalize_hash('hola mundo'),
        'normalize_hash no normaliza mayúsculas/espacios';

    -- --------------------------------------------------------
    -- Mensaje válido
    -- --------------------------------------------------------
    INSERT INTO public.messages (user_id, content)
    VALUES (ua, 'Hola mundo')
    RETURNING id INTO ma;

    INSERT INTO _test_ids (name, id) VALUES ('ma', ma);

    ASSERT (SELECT content_hash FROM public.messages WHERE id = ma)
           = public.normalize_hash('Hola mundo'),
        'content_hash no se generó correctamente';

    ASSERT (SELECT expires_at = created_at + interval '24 hours'
            FROM public.messages WHERE id = ma),
        'expires_at no es created_at + 24h';

    ASSERT (SELECT comments_count FROM public.messages WHERE id = ma) = 0,
        'comments_count inicial distinto de 0';

    -- --------------------------------------------------------
    -- Un solo mensaje activo por usuario
    -- --------------------------------------------------------
    BEGIN
        INSERT INTO public.messages (user_id, content)
        VALUES (ua, 'Otro mensaje');
        RAISE EXCEPTION 'se permitió un segundo mensaje activo'
            USING ERRCODE = 'Z0001';
    EXCEPTION
        WHEN exclusion_violation THEN
            GET STACKED DIAGNOSTICS cname = CONSTRAINT_NAME;
            ASSERT cname = 'uq_messages_active_per_user',
                'constraint inesperada: ' || cname;
    END;

    -- --------------------------------------------------------
    -- Sin contenido duplicado entre mensajes activos
    -- --------------------------------------------------------
    BEGIN
        INSERT INTO public.messages (user_id, content)
        VALUES (ub, '  hola   MUNDO  ');
        RAISE EXCEPTION 'se permitió contenido duplicado activo'
            USING ERRCODE = 'Z0002';
    EXCEPTION
        WHEN exclusion_violation THEN
            GET STACKED DIAGNOSTICS cname = CONSTRAINT_NAME;
            ASSERT cname = 'uq_messages_active_no_duplicates',
                'constraint inesperada: ' || cname;
    END;

    INSERT INTO public.messages (user_id, content)
    VALUES (ub, 'Mensaje de Bob')
    RETURNING id INTO mb;

    INSERT INTO _test_ids (name, id) VALUES ('mb', mb);

    -- --------------------------------------------------------
    -- No comentar el propio mensaje
    -- --------------------------------------------------------
    BEGIN
        INSERT INTO public.comments (message_id, user_id, content)
        VALUES (ma, ua, 'comentario propio');
        RAISE EXCEPTION 'se permitió comentar el propio mensaje'
            USING ERRCODE = 'Z0003';
    EXCEPTION
        WHEN SQLSTATE 'P0001' THEN NULL;
    END;

    -- --------------------------------------------------------
    -- Comentario válido y contador
    -- --------------------------------------------------------
    INSERT INTO public.comments (message_id, user_id, content)
    VALUES (ma, ub, 'comentario de Bob')
    RETURNING id INTO cid;

    INSERT INTO _test_ids (name, id) VALUES ('cid', cid);

    ASSERT (SELECT comments_count FROM public.messages WHERE id = ma) = 1,
        'comments_count no se incrementó';

    -- --------------------------------------------------------
    -- Un comentario por usuario y mensaje
    -- --------------------------------------------------------
    BEGIN
        INSERT INTO public.comments (message_id, user_id, content)
        VALUES (ma, ub, 'otra vez');
        RAISE EXCEPTION 'se permitió un segundo comentario del mismo usuario'
            USING ERRCODE = 'Z0004';
    EXCEPTION
        WHEN unique_violation THEN
            GET STACKED DIAGNOSTICS cname = CONSTRAINT_NAME;
            ASSERT cname = 'uq_comments_one_per_user_message',
                'constraint inesperada: ' || cname;
    END;

    DELETE FROM public.comments WHERE id = cid;

    ASSERT (SELECT comments_count FROM public.messages WHERE id = ma) = 0,
        'comments_count no se decrementó al borrar el comentario';

    DELETE FROM _test_ids WHERE name = 'cid';

    -- --------------------------------------------------------
    -- Mensaje expirado
    -- --------------------------------------------------------
    INSERT INTO public.messages (user_id, content, created_at)
    VALUES (uc, 'Contenido temporal', now() - interval '25 hours')
    RETURNING id INTO mc;

    INSERT INTO _test_ids (name, id) VALUES ('mc', mc);

    ASSERT (SELECT expires_at < now() FROM public.messages WHERE id = mc),
        'el mensaje debería estar expirado';

    BEGIN
        INSERT INTO public.comments (message_id, user_id, content)
        VALUES (mc, ua, 'demasiado tarde');
        RAISE EXCEPTION 'se permitió comentar un mensaje expirado'
            USING ERRCODE = 'Z0005';
    EXCEPTION
        WHEN SQLSTATE 'EC001' THEN NULL;
    END;

    BEGIN
        INSERT INTO public.reports (message_id, reporter_id, reason)
        VALUES (mc, ua, 'motivo válido');
        RAISE EXCEPTION 'se permitió reportar un mensaje expirado'
            USING ERRCODE = 'Z0006';
    EXCEPTION
        WHEN SQLSTATE 'EC001' THEN NULL;
    END;

    -- El mismo contenido se puede volver a publicar cuando el anterior expiró.
    INSERT INTO public.messages (user_id, content)
    VALUES (uc, 'Contenido temporal')
    RETURNING id INTO mc2;

    INSERT INTO _test_ids (name, id) VALUES ('mc2', mc2);

    -- --------------------------------------------------------
    -- Reportes
    -- --------------------------------------------------------
    INSERT INTO public.reports (message_id, reporter_id, reason)
    VALUES (ma, ub, 'motivo válido');

    BEGIN
        INSERT INTO public.reports (message_id, reporter_id, reason)
        VALUES (ma, ub, 'otro motivo');
        RAISE EXCEPTION 'se permitió un reporte duplicado'
            USING ERRCODE = 'Z0007';
    EXCEPTION
        WHEN unique_violation THEN
            GET STACKED DIAGNOSTICS cname = CONSTRAINT_NAME;
            ASSERT cname = 'reports_one_per_user_message',
                'constraint inesperada: ' || cname;
    END;

    BEGIN
        INSERT INTO public.reports (message_id, reporter_id, reason)
        VALUES (ma, ua, 'mi propio mensaje');
        RAISE EXCEPTION 'se permitió auto-reportarse'
            USING ERRCODE = 'Z0008';
    EXCEPTION
        WHEN SQLSTATE 'EC002' THEN NULL;
    END;

    -- --------------------------------------------------------
    -- Inmutabilidad del mensaje
    -- --------------------------------------------------------
    BEGIN
        UPDATE public.messages SET content = 'cambiado' WHERE id = ma;
        RAISE EXCEPTION 'se permitió cambiar el contenido'
            USING ERRCODE = 'Z0009';
    EXCEPTION
        WHEN SQLSTATE 'EC003' THEN NULL;
    END;

    BEGIN
        UPDATE public.messages
        SET expires_at = now() + interval '48 hours'
        WHERE id = ma;
        RAISE EXCEPTION 'se permitió extender la expiración'
            USING ERRCODE = 'Z0010';
    EXCEPTION
        WHEN SQLSTATE 'EC003' THEN NULL;
    END;

    -- El contador sí se puede actualizar (lo hace el trigger de comentarios).
    UPDATE public.messages SET comments_count = comments_count + 1 WHERE id = ma;
    UPDATE public.messages SET comments_count = comments_count - 1 WHERE id = ma;

    -- --------------------------------------------------------
    -- Validaciones de contenido
    -- --------------------------------------------------------
    BEGIN
        INSERT INTO public.messages (user_id, content)
        VALUES (ud, E'   \n\t  ');
        RAISE EXCEPTION 'se permitió un mensaje en blanco'
            USING ERRCODE = 'Z0011';
    EXCEPTION
        WHEN check_violation THEN NULL;
    END;

    BEGIN
        INSERT INTO public.messages (user_id, content)
        VALUES (ud, repeat('a', 501));
        RAISE EXCEPTION 'se permitió un mensaje de 501 caracteres'
            USING ERRCODE = 'Z0012';
    EXCEPTION
        WHEN check_violation THEN NULL;
    END;

    BEGIN
        INSERT INTO public.comments (message_id, user_id, content)
        VALUES (ma, ud, repeat('a', 301));
        RAISE EXCEPTION 'se permitió un comentario de 301 caracteres'
            USING ERRCODE = 'Z0013';
    EXCEPTION
        WHEN check_violation THEN NULL;
    END;

    -- Mensaje inexistente: el guard debe responder "message_gone".
    BEGIN
        INSERT INTO public.comments (message_id, user_id, content)
        VALUES (999999999, ua, 'fantasma');
        RAISE EXCEPTION 'se permitió comentar un mensaje inexistente'
            USING ERRCODE = 'Z0014';
    EXCEPTION
        WHEN SQLSTATE 'EC001' THEN NULL;
    END;

    -- --------------------------------------------------------
    -- Preparar purga: mensaje que expira en 1 segundo
    -- --------------------------------------------------------
    INSERT INTO public.messages (user_id, content, created_at)
    VALUES (ue, 'Para purgar', now() - interval '24 hours' + interval '1 second')
    RETURNING id INTO mdel;

    INSERT INTO _test_ids (name, id) VALUES ('mdel', mdel);

    ASSERT (SELECT expires_at > now() FROM public.messages WHERE id = mdel),
        'el mensaje de purga debería estar activo al insertarlo';

    INSERT INTO public.comments (message_id, user_id, content)
    VALUES (mdel, ua, 'comentario a purgar');

    INSERT INTO public.reports (message_id, reporter_id, reason)
    VALUES (mdel, ub, 'reporte a purgar');

    ASSERT (SELECT comments_count FROM public.messages WHERE id = mdel) = 1,
        'el comentario de purga no se contó';

    -- --------------------------------------------------------
    -- Purga de sesiones vencidas
    -- --------------------------------------------------------
    INSERT INTO public.sessions (token_hash, user_id, created_at, expires_at)
    VALUES (
        repeat('a', 64),
        ua,
        now() - interval '2 days',
        now() - interval '1 day'
    );

    SELECT public.purge_expired_sessions() INTO deleted;

    ASSERT deleted >= 1, 'no se purgó la sesión vencida';
    ASSERT NOT EXISTS (
        SELECT 1 FROM public.sessions WHERE token_hash = repeat('a', 64)
    ), 'la sesión vencida sigue existiendo';

    RAISE NOTICE 'Pruebas de esquema, reglas y triggers: OK';
END;
$$;

COMMIT;

-- Esperar a que el mensaje de purga expire y ejecutar la purga en una
-- transacción nueva, para que now() avance.
SELECT pg_sleep(2);

BEGIN;

DO $$
DECLARE
    mdel    bigint;
    cdel    bigint;
    deleted integer;
BEGIN
    SELECT id INTO mdel FROM _test_ids WHERE name = 'mdel';

    ASSERT mdel IS NOT NULL, 'no se encontró el id del mensaje de purga';
    ASSERT (SELECT expires_at <= now() FROM public.messages WHERE id = mdel),
        'el mensaje de purga aún no expiró';

    SELECT count(*) INTO cdel
    FROM public.comments
    WHERE message_id = mdel;

    ASSERT cdel = 1, 'el comentario de purga no existe antes de purgar';

    SELECT public.purge_expired_messages() INTO deleted;

    ASSERT deleted >= 1, 'la purga no borró ningún mensaje';
    ASSERT NOT EXISTS (SELECT 1 FROM public.messages WHERE id = mdel),
        'el mensaje purgado sigue existiendo';
    ASSERT NOT EXISTS (SELECT 1 FROM public.comments WHERE message_id = mdel),
        'los comentarios no se borraron en cascada';
    ASSERT NOT EXISTS (SELECT 1 FROM public.reports WHERE message_id = mdel),
        'los reportes no se borraron en cascada';

    RAISE NOTICE 'Pruebas de purga y borrado en cascada: OK';
END;
$$;

COMMIT;

DROP TABLE _test_ids;

\echo 'Todas las pruebas de esquema pasaron.'
