-- ============================================================
-- 003 — Moderación: ocultado de mensajes y auditoría de reportes
-- ============================================================

ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS hidden_at timestamptz;

ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS hidden_by bigint
        REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.reports
    ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE public.reports
    ADD COLUMN IF NOT EXISTS reviewed_by bigint
        REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_visible
    ON public.messages (comments_count DESC, created_at DESC)
    WHERE hidden_at IS NULL;

-- Un mensaje oculto no admite comentarios, igual que uno vencido.
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

    IF NOT FOUND OR m.expires_at <= now() OR m.hidden_at IS NOT NULL THEN
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

-- Un mensaje oculto no admite reportes.
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

    IF NOT FOUND OR m.expires_at <= now() OR m.hidden_at IS NOT NULL THEN
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

COMMENT ON COLUMN public.messages.hidden_at IS
    'Soft-hide por moderación; la fila se conserva para auditoría.';
COMMENT ON COLUMN public.reports.reviewed_at IS
    'Última revisión manual del reporte.';
