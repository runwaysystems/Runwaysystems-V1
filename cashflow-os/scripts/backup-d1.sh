#!/usr/bin/env bash
# backup-d1.sh - export the production D1 database and store the dump safely.
#
# Usage (from cashflow-os/):
#   ./scripts/backup-d1.sh                    export only, saved under backups/
#   ./scripts/backup-d1.sh --bucket NAME      additionally upload to the R2 bucket NAME
#
# Environment:
#   D1_NAME                database name (default: cashflow-os-platform)
#   CLOUDFLARE_API_TOKEN   optional; otherwise the existing `wrangler login` session
#   CLOUDFLARE_ACCOUNT_ID  required when using CLOUDFLARE_API_TOKEN
#
# The nightly GitHub Action (.github/workflows/backup.yml) runs this script;
# restore instructions live in RECOVERY.md.
set -euo pipefail

cd "$(dirname "$0")/.."

D1_NAME="${D1_NAME:-cashflow-os-platform}"
BUCKET=""
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="backups"
OUT="${OUT_DIR}/d1-${D1_NAME}-${STAMP}.sql"

for arg in "$@"; do :; done
while [ $# -gt 0 ]; do
  case "$1" in
    --bucket)
      BUCKET="${2:?--bucket needs a value}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

say()  { printf '\033[1;33m[backup]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[backup]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[backup]\033[0m %s\n' "$*" >&2; exit 1; }

require() { command -v "$1" >/dev/null 2>&1 || fail "missing prerequisite: $1 (run npm ci first for wrangler)"; }

require node
require npx
npx --no-install wrangler --version >/dev/null 2>&1 || fail "wrangler is not installed (run: npm ci)"

mkdir -p "$OUT_DIR"

say "exporting D1 database $D1_NAME (remote)"
npx --no-install wrangler d1 export "$D1_NAME" --remote --output "$OUT" --config worker/wrangler.toml
[ -s "$OUT" ] || fail "export produced an empty file at $OUT"

say "compressing the dump"
gzip -9 -f "$OUT"
DUMP="${OUT}.gz"
SIZE="$(du -h "$DUMP" | cut -f1)"
ok "dump ready: $DUMP ($SIZE)"

if [ -n "$BUCKET" ]; then
  KEY="d1/$(date -u +%Y/%m)/d1-${D1_NAME}-${STAMP}.sql.gz"
  say "ensuring R2 bucket $BUCKET"
  if npx --no-install wrangler r2 bucket create "$BUCKET" 2>&1 | grep -qi "already exists"; then
    say "R2 bucket already exists"
  fi
  say "uploading to r2://$BUCKET/$KEY"
  npx --no-install wrangler r2 object put "${BUCKET}/${KEY}" --file "$DUMP" --remote
  ok "backup stored in R2 as $KEY"
fi

# Rotation: keep the 14 newest local dumps, delete the rest.
say "rotating local dumps (keeping the newest 14)"
ls -1t "$OUT_DIR"/d1-*.sql.gz 2>/dev/null | tail -n +15 | while read -r old; do
  rm -f "$old"
  say "deleted old dump $old"
done

ok "backup complete"
