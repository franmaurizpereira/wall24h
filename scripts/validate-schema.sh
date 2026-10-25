#!/usr/bin/env bash
# ============================================================
# Valida el esquema contra un PostgreSQL real y desechable.
#
# Uso:
#   ./scripts/validate-schema.sh
#   PG_IMAGE=docker.io/library/postgres:16 ./scripts/validate-schema.sh
#
# Requiere podman o docker y el cliente psql.
# ============================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_IMAGE="${PG_IMAGE:-docker.io/library/postgres:16-alpine}"
DB_NAME="wall"
DB_USER="postgres"
DB_PASSWORD="ecco_schema_test"
CONTAINER_NAME="ecco-schema-test-$$"

if command -v podman >/dev/null 2>&1; then
  ENGINE="podman"
elif command -v docker >/dev/null 2>&1; then
  ENGINE="docker"
else
  echo "Error: se necesita podman o docker." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "Error: se necesita el cliente psql." >&2
  exit 1
fi

cleanup() {
  "$ENGINE" rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "→ Motor: $ENGINE"
echo "→ Imagen: $PG_IMAGE"

if ! "$ENGINE" image inspect "$PG_IMAGE" >/dev/null 2>&1; then
  echo "→ Descargando imagen..."
  "$ENGINE" pull "$PG_IMAGE" >/dev/null
fi

echo "→ Levantando PostgreSQL..."
"$ENGINE" run -d --rm \
  --name "$CONTAINER_NAME" \
  -e POSTGRES_PASSWORD="$DB_PASSWORD" \
  -e POSTGRES_DB="$DB_NAME" \
  -p 127.0.0.1::5432 \
  "$PG_IMAGE" >/dev/null

PORT=""
for _ in $(seq 1 40); do
  PORT="$("$ENGINE" port "$CONTAINER_NAME" 5432/tcp 2>/dev/null | head -n1 | sed 's/.*://' || true)"
  [[ -n "$PORT" ]] && break
  sleep 0.25
done

if [[ -z "$PORT" ]]; then
  echo "Error: no se pudo obtener el puerto del contenedor." >&2
  exit 1
fi

export PGPASSWORD="$DB_PASSWORD"

READY=0
for _ in $(seq 1 80); do
  if psql -X -w -h 127.0.0.1 -p "$PORT" -U "$DB_USER" -d "$DB_NAME" \
      -c 'SELECT 1' >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 0.5
done

if [[ "$READY" -ne 1 ]]; then
  echo "Error: PostgreSQL no respondió a tiempo." >&2
  "$ENGINE" logs "$CONTAINER_NAME" | tail -n 50 >&2 || true
  exit 1
fi

PSQL=(psql -X -w -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PORT" -U "$DB_USER" -d "$DB_NAME")

echo "→ Aplicando db/migrations/001_schema.sql"
"${PSQL[@]}" -f "$ROOT_DIR/db/migrations/001_schema.sql" >/dev/null

echo "→ Ejecutando db/tests/schema_test.sql"
"${PSQL[@]}" -f "$ROOT_DIR/db/tests/schema_test.sql"

echo "→ Comprobando objetos creados"
"${PSQL[@]}" -At -c "
  SELECT 'tablas=' || count(*)
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN ('users', 'sessions', 'messages', 'comments', 'reports');
"
"${PSQL[@]}" -At -c "
  SELECT 'constraints=' || count(*)
  FROM pg_constraint
  WHERE conname IN (
    'uq_messages_active_per_user',
    'uq_messages_active_no_duplicates',
    'uq_comments_one_per_user_message',
    'reports_one_per_user_message'
  );
"

echo "✓ Esquema validado correctamente."
