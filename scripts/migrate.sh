#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-$ROOT_DIR/db/migrations}"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "No existe el directorio de migraciones: $MIGRATIONS_DIR" >&2
  exit 1
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  );
"

for file in "$MIGRATIONS_DIR"/*.sql; do
  [ -e "$file" ] || continue
  name="$(basename "$file")"
  applied="$(psql "$DATABASE_URL" -At -v ON_ERROR_STOP=1 \
    -c "SELECT 1 FROM schema_migrations WHERE filename = '$name'")"

  if [ "$applied" = "1" ]; then
    echo "→ $name ya aplicada"
    continue
  fi

  echo "→ aplicando $name"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q \
    -c "INSERT INTO schema_migrations (filename) VALUES ('$name')"
done

echo "✓ migraciones aplicadas"
