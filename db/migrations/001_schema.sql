-- ============================================================
-- Ecco / Muro 24h — Esquema base
-- PostgreSQL 16+
--
-- Fase 0: DDL corregido y validado.
-- Requiere las extensiones: pgcrypto, citext, btree_gist.
-- pg_cron se configura aparte en 002_cron.sql.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ------------------------------------------------------------
-- Hash normalizado anti-duplicados
-- (trim + minúsculas + colapsar espacios + sha256)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_hash(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT encode(
        digest(
            lower(btrim(regexp_replace(p_text, '\s+', ' ', 'g'))),
            'sha256'
        ),
        'hex'
    );
$$;

-- ------------------------------------------------------------
-- Tipos
-- ------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'report_status'
          AND typnamespace = 'public'::regnamespace
    ) THEN
        CREATE TYPE public.report_status AS ENUM ('pending', 'reviewed', 'actioned');
    END IF;
END;
$$;

-- ------------------------------------------------------------
-- Usuarios
-- ------------------------------------------------------------
CREATE TABLE public.users (
    id            bigserial   PRIMARY KEY,
    username      citext      NOT NULL UNIQUE,
    email         citext      NOT NULL UNIQUE,
    password_hash text        NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT users_username_format
        CHECK (username::text ~ '^[A-Za-z0-9_]{3,32}$'),
    CONSTRAINT users_password_hash_not_empty
        CHECK (char_length(password_hash) > 0)
);

-- ------------------------------------------------------------
-- Sesiones
-- El token en claro vive solo en la cookie; aquí se guarda su sha256.
-- ------------------------------------------------------------
CREATE TABLE public.sessions (
    token_hash text        PRIMARY KEY,
    user_id    bigint      NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
    CONSTRAINT sessions_token_hash_format
        CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT sessions_expiry_after_creation
        CHECK (expires_at > created_at)
);

CREATE INDEX idx_sessions_user_id ON public.sessions (user_id);
CREATE INDEX idx_sessions_expires_at ON public.sessions (expires_at);

-- ------------------------------------------------------------
-- Mensajes
-- ------------------------------------------------------------
CREATE TABLE public.messages (
    id             bigserial   PRIMARY KEY,
    user_id        bigint      NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content        text        NOT NULL,
    content_hash   text        GENERATED ALWAYS AS (public.normalize_hash(content)) STORED,
    comments_count integer     NOT NULL DEFAULT 0,
    created_at     timestamptz NOT NULL DEFAULT now(),
    expires_at     timestamptz NOT NULL DEFAULT now() + interval '24 hours',
    CONSTRAINT messages_content_valid
        CHECK (char_length(content) BETWEEN 1 AND 500
               AND content ~ '[^[:space:]]'),
    CONSTRAINT messages_comments_count_nonnegative
        CHECK (comments_count >= 0),
    CONSTRAINT messages_expiry_24h
        CHECK (expires_at = created_at + interval '24 hours')
);

-- La expiración siempre se calcula en servidor a partir de created_at.
CREATE OR REPLACE FUNCTION public.trg_set_message_expiry()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.expires_at := NEW.created_at + interval '24 hours';
    RETURN NEW;
END;
$$;

CREATE TRIGGER set_message_expiry
    BEFORE INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.trg_set_message_expiry();

-- [Regla] Solo UN mensaje ACTIVO por usuario.
-- Se usa una exclusion constraint con intervalos, no un índice parcial:
-- los predicados de índice no pueden usar now() porque no es IMMUTABLE.
ALTER TABLE public.messages
    ADD CONSTRAINT uq_messages_active_per_user
    EXCLUDE USING gist (
        user_id WITH =,
        tstzrange(created_at, expires_at) WITH &&
    );

-- [Regla] Sin mensajes ACTIVOS con el mismo contenido normalizado.
ALTER TABLE public.messages
    ADD CONSTRAINT uq_messages_active_no_duplicates
    EXCLUDE USING gist (
        content_hash WITH =,
        tstzrange(created_at, expires_at) WITH &&
    );

-- [Regla] Un mensaje no se puede editar ni extender.
-- Solo el trigger de contador puede modificar comments_count.
CREATE OR REPLACE FUNCTION public.trg_messages_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.content IS DISTINCT FROM OLD.content
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
    THEN
        RAISE EXCEPTION 'message_immutable'
            USING ERRCODE = 'EC003';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER messages_immutable
    BEFORE UPDATE ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.trg_messages_immutable();

CREATE INDEX idx_messages_user_id ON public.messages (user_id);
CREATE INDEX idx_messages_expires_at ON public.messages (expires_at);
CREATE INDEX idx_messages_wall_order
    ON public.messages (comments_count DESC, created_at DESC);

-- ------------------------------------------------------------
-- Comentarios
-- ------------------------------------------------------------
CREATE TABLE public.comments (
    id         bigserial   PRIMARY KEY,
    message_id bigint      NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id    bigint      NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content    text        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT comments_content_valid
        CHECK (char_length(content) BETWEEN 1 AND 300
               AND content ~ '[^[:space:]]'),
    -- [Decisión] Un comentario por usuario y mensaje.
    -- Así comments_count equivale a participantes únicos.
    CONSTRAINT uq_comments_one_per_user_message
        UNIQUE (message_id, user_id)
);

-- [Regla] No comentar mensajes expirados ni el propio mensaje.
-- La comprobación se hace en la misma transacción, con la fila bloqueada.
CREATE OR REPLACE FUNCTION public.trg_guard_comment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    m public.messages%ROWTYPE;
BEGIN
    SELECT * INTO m
    FROM public.messages
    WHERE id = NEW.message_id
    FOR SHARE;

    IF NOT FOUND OR m.expires_at <= now() THEN
        RAISE EXCEPTION 'message_gone'
            USING ERRCODE = 'EC001';
    END IF;

    IF m.user_id = NEW.user_id THEN
        RAISE EXCEPTION 'cannot_comment_on_own_message'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER guard_comment
    BEFORE INSERT ON public.comments
    FOR EACH ROW EXECUTE FUNCTION public.trg_guard_comment();

-- Mantener comments_count sin COUNT(*) en cada consulta del muro.
CREATE OR REPLACE FUNCTION public.trg_sync_comments_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.messages
        SET comments_count = comments_count + 1
        WHERE id = NEW.message_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.messages
        SET comments_count = comments_count - 1
        WHERE id = OLD.message_id;
    END IF;

    RETURN NULL;
END;
$$;

CREATE TRIGGER sync_comments_count
    AFTER INSERT OR DELETE ON public.comments
    FOR EACH ROW EXECUTE FUNCTION public.trg_sync_comments_count();

CREATE INDEX idx_comments_by_message
    ON public.comments (message_id, created_at);
CREATE INDEX idx_comments_user_id
    ON public.comments (user_id);

-- ------------------------------------------------------------
-- Reportes
-- ------------------------------------------------------------
CREATE TABLE public.reports (
    id          bigserial             PRIMARY KEY,
    message_id  bigint                NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    reporter_id bigint                NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reason      text                  NOT NULL,
    status      public.report_status  NOT NULL DEFAULT 'pending',
    created_at  timestamptz           NOT NULL DEFAULT now(),
    CONSTRAINT reports_reason_valid
        CHECK (char_length(reason) BETWEEN 5 AND 500
               AND reason ~ '[^[:space:]]'),
    -- Un reporte por usuario y mensaje.
    CONSTRAINT reports_one_per_user_message
        UNIQUE (reporter_id, message_id)
);

-- [Regla] No reportar mensajes expirados ni el propio mensaje.
CREATE OR REPLACE FUNCTION public.trg_guard_report()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    m public.messages%ROWTYPE;
BEGIN
    SELECT * INTO m
    FROM public.messages
    WHERE id = NEW.message_id
    FOR SHARE;

    IF NOT FOUND OR m.expires_at <= now() THEN
        RAISE EXCEPTION 'message_gone'
            USING ERRCODE = 'EC001';
    END IF;

    IF m.user_id = NEW.reporter_id THEN
        RAISE EXCEPTION 'cannot_report_own_message'
            USING ERRCODE = 'EC002';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER guard_report
    BEFORE INSERT ON public.reports
    FOR EACH ROW EXECUTE FUNCTION public.trg_guard_report();

CREATE INDEX idx_reports_open
    ON public.reports (status)
    WHERE status = 'pending';
CREATE INDEX idx_reports_message_id
    ON public.reports (message_id);

-- ------------------------------------------------------------
-- Purga
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_expired_messages()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    deleted integer;
BEGIN
    DELETE FROM public.messages
    WHERE expires_at <= now();

    GET DIAGNOSTICS deleted = ROW_COUNT;
    RETURN deleted;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_expired_sessions()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    deleted integer;
BEGIN
    DELETE FROM public.sessions
    WHERE expires_at <= now();

    GET DIAGNOSTICS deleted = ROW_COUNT;
    RETURN deleted;
END;
$$;

COMMENT ON TABLE public.messages
    IS 'Mensajes de solo texto con una vida de 24 horas.';
COMMENT ON COLUMN public.messages.content_hash
    IS 'Hash normalizado; impide duplicados mientras ambos mensajes estén activos.';
COMMENT ON CONSTRAINT uq_messages_active_per_user ON public.messages
    IS 'Un solo mensaje activo por usuario.';
COMMENT ON CONSTRAINT uq_messages_active_no_duplicates ON public.messages
    IS 'Sin contenido duplicado entre mensajes activos.';
COMMENT ON CONSTRAINT uq_comments_one_per_user_message ON public.comments
    IS 'Un comentario por usuario y mensaje.';
