-- Purga: borra en cascada comentarios y mensajes vencidos
WITH expired AS (
    SELECT id FROM messages WHERE expires_at <= now()
)
DELETE FROM messages m
    USING expired e
   WHERE m.id = e.id;
