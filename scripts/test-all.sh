#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

cleanup() {
  npm run test:down >/dev/null 2>&1 || true
}
trap cleanup EXIT

npm run test:up
npm run test:unit
npm test
