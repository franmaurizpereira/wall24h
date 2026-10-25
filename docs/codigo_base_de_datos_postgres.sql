-- ============================================================
--  Muro de mensajes 24h — PostgreSQL 14+
--  Requiere: pgcrypto (para digest())
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- Tipos
-- ------------------------------------------------------------
CREATE TYPE report_status AS ENUM ('pending', 'reviewed', 'actioned');

-- ------------------------------------------------------------
-- Función helper: hash normalizado anti-duplicados
-- (trim + lowercase + colapsar espacios + sha256)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION normalize_hash(p_text text)
RETURNS text
LANGUAGE sql IMMUTABLE
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
-- Tablas
-- ------------------------------------------------------------
CREATE TABLE users (
    id            bigserial PRIMARY KEY,
    username      citext      NOT NULL UNIQUE,
    email         citext      NOT NULL UNIQUE,
    password_hash text        NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE messages (
    id             bigserial PRIMARY KEY,
    user_id        bigint      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content        text        NOT NULL
                   CHECK (char_length(content) BETWEEN 1 AND 500),
    content_hash   text        NOT NULL DEFAULT normalize_hash(content),
    comments_count integer     NOT NULL DEFAULT 0
                   CHECK (comments_count >= 0),
    created_at     timestamptz NOT NULL DEFAULT now(),
    expires_at     timestamptz NOT NULL DEFAULT now() + interval '24 hours'
);

CREATE TABLE comments (
    id         bigserial PRIMARY KEY,
    message_id bigint      NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id    bigint      NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    content    text        NOT NULL
               CHECK (char_length(content) BETWEEN 1 AND 300),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reports (
    id            bigserial PRIMARY KEY,
    message_id    bigint        NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    reporter_id   bigint        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    reason        text          NOT NULL,
    status        report_status NOT NULL DEFAULT 'pending',
    created_at    timestamptz   NOT NULL DEFAULT now(),
    -- un reporte por usuario por mensaje (puede re-reportar tras resolver)
    CONSTRAINT reports_one_per_user_message UNIQUE (reporter_id, message_id)
);

-- ------------------------------------------------------------
-- Índices: reglas de negocio y visibilidad
-- ------------------------------------------------------------

-- [Regla 2] Solo UN mensaje ACTIVO por usuario.
-- Index parcial: un mensaje vencido NO bloquea al usuario,
-- ni siquiera si el job de purga aún no lo ha borrado.
CREATE UNIQUE INDEX uq_messages_active_per_user
    ON messages (user_id)
    WHERE expires_at > now();

-- [Regla 3a] Sin mensajes ACTIVOS idénticos (entre usuarios distintos).
CREATE UNIQUE INDEX uq_messages_active_no_duplicates
    ON messages (content_hash)
    WHERE expires_at > now();

-- [Visibilidad] Consulta principal del muro:
--   SELECT * FROM messages
--   WHERE expires_at > now()
--   ORDER BY comments_count DESC, created_at DESC;
CREATE INDEX idx_messages_wall_order
    ON messages (expires_at, comments_count DESC, created_at DESC);

CREATE INDEX idx_comments_by_message
    ON comments (message_id, created_at);

CREATE INDEX idx_reports_open
    ON reports (status) WHERE status = 'pending';

-- ------------------------------------------------------------
-- [Regla 1] No se puede comentar el propio mensaje
-- (invariante entre tablas → solo se puede hacer con trigger)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_no_own_comments()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF (SELECT user_id FROM messages WHERE id = NEW.message_id) = NEW.user_id THEN
        RAISE EXCEPTION 'cannot_comment_on_own_message'
            USING ERRCODE = 'P0001';   -- la API la mapea a HTTP 403
    END IF;
    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER no_own_comments
    BEFORE INSERT ON comments
    DEFERRABLE INITIALLY DEFERRED   -- permite validar dentro de la TX
    FOR EACH ROW EXECUTE FUNCTION trg_no_own_comments();

-- ------------------------------------------------------------
-- Mantener comments_count (ordenación del muro sin COUNT(*))
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_sync_comments_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE messages SET comments_count = comments_count + 1 WHERE id = NEW.message_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE messages SET comments_count = comments_count - 1 WHERE id = OLD.message_id;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER sync_comments_count
    AFTER INSERT OR DELETE ON comments
    FOR EACH ROW EXECUTE FUNCTION trg_sync_comments_count();

-- ------------------------------------------------------------
-- OPCIONAL: [decisión pendiente] solo 1 comentario por usuario por mensaje
-- ------------------------------------------------------------
-- CREATE UNIQUE INDEX uq_one_comment_per_user_per_message
--     ON comments (message_id, user_id);
