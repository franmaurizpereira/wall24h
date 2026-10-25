#!/usr/bin/env bash
# ============================================================
# Valida 002_cron.sql contra un PostgreSQL real con pg_cron.
#
# Construye una imagen local a partir de postgres:16 e instala
# postgresql-16-cron desde el repositorio PGDG.
#
# Uso:
#   ./scripts/validate-cron.sh
#
# Tarda hasta ~75 s porque espera a que se ejecute el job.
# ============================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="ecco-postgres-cron:16"
CONTAINER_NAME="ecco-cron-test-$$"
DB_NAME="wall"
DB_USER="postgres"
DB_PASSWORD="ecco_cron_test"

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

echo "→ Construyendo imagen con pg_cron..."
"$ENGINE" build \
  -t "$IMAGE" \
  -f "$ROOT_DIR/db/Dockerfile" \
  "$ROOT_DIR/db" >/dev/null

echo "→ Levantando PostgreSQL con pg_cron precargado..."
"$ENGINE" run -d --rm \
  --name "$CONTAINER_NAME" \
  -e POSTGRES_PASSWORD="$DB_PASSWORD" \
  -e POSTGRES_DB="$DB_NAME" \
  -p 127.0.0.1::5432 \
  "$IMAGE" \
  postgres \
    -c shared_preload_libraries=pg_cron \
    -c cron.database_name="$DB_NAME" >/dev/null

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

echo "→ Aplicando esquema base..."
"${PSQL[@]}" -f "$ROOT_DIR/db/migrations/001_schema.sql" >/dev/null

echo "→ Aplicando jobs de pg_cron..."
"${PSQL[@]}" -f "$ROOT_DIR/db/migrations/002_cron.sql" >/dev/null

echo "→ Comprobando configuración y jobs..."
"${PSQL[@]}" -At -c "SHOW shared_preload_libraries;"
"${PSQL[@]}" -At -c "SHOW cron.database_name;"
"${PSQL[@]}" -At -c "
  SELECT jobname || '=' || schedule
  FROM cron.job
  ORDER BY jobid;
"

echo "→ Insertando un mensaje vencido para comprobar la purga automática..."
"${PSQL[@]}" >/dev/null <<'SQL'
INSERT INTO public.users (username, email, password_hash)
VALUES ('cronuser', 'cron@example.com', 'hash');

INSERT INTO public.messages (user_id, content, created_at)
SELECT id, 'purga automática', now() - interval '25 hours'
FROM public.users
WHERE username = 'cronuser';
SQL

echo "→ Esperando al job (máx. 75 s)..."
DELETED=0
for _ in $(seq 1 15); do
  COUNT="$("${PSQL[@]}" -At -c "SELECT count(*) FROM public.messages WHERE content = 'purga automática';")"
  if [[ "$COUNT" == "0" ]]; then
    DELETED=1
    break
  fi
  sleep 5
done

if [[ "$DELETED" -ne 1 ]]; then
  echo "Error: el job no borró el mensaje en 75 s." >&2
  "${PSQL[@]}" -c "SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;" >&2 || true
  exit 1
fi

echo "→ Última ejecución del job:"
"${PSQL[@]}" -c "
  SELECT jobid, status, return_message, start_time
  FROM cron.job_run_details
  ORDER BY start_time DESC
  LIMIT 1;
"

echo "✓ pg_cron validado: el job purgó el mensaje automáticamente."
