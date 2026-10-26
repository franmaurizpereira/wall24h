#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${TEST_DATABASE_URL:?TEST_DATABASE_URL is required}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-$ROOT_DIR/db/migrations}"

if [ ! -f "$MIGRATIONS_DIR/001_schema.sql" ]; then
  echo "No existe $MIGRATIONS_DIR/001_schema.sql" >&2
  exit 1
fi

# La base de test se recrea en cada ejecución para evitar estado residual.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q \
  -c "DROP DATABASE IF EXISTS wall_test WITH (FORCE);"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q \
  -c "CREATE DATABASE wall_test;"

# Aplica el esquema y las migraciones de estructura. 002_cron se omite:
# pg_cron solo se configura en la base wall.
for migration in "$MIGRATIONS_DIR"/*.sql; do
  [ -e "$migration" ] || continue
  if [ "$(basename "$migration")" = "002_cron.sql" ]; then
    continue
  fi
  psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"
done

echo "✓ wall_test recreada y esquema aplicado"
