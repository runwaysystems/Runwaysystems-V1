#!/usr/bin/env bash
# deploy.sh - deploy the Runway Systems suite to Cloudflare.
#
# Usage (from cashflow-os/):
#   ./scripts/deploy.sh --check     pre-flight only, changes nothing
#   ./scripts/deploy.sh             full deploy (build, bucket, migrations, Worker, Pages)
#   ./scripts/deploy.sh --worker    Worker + D1 migrations + R2 bucket only
#   ./scripts/deploy.sh --pages     storefront (Pages) only
#
# Environment:
#   CLOUDFLARE_API_TOKEN   optional; otherwise the existing `wrangler login` session
#   PAGES_PROJECT          Pages project name (default: runway-systems-storefront)
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

MODE="full"
PAGES_PROJECT="${PAGES_PROJECT:-runway-systems-storefront}"
WORKER_CONFIG="worker/wrangler.toml"
D1_NAME="cashflow-os-platform"
R2_BUCKET="runway-product-media"

for arg in "$@"; do
  case "$arg" in
    --check) MODE="check" ;;
    --worker) MODE="worker" ;;
    --pages) MODE="pages" ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

say()  { printf '\033[1;33m[deploy]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[deploy]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[deploy]\033[0m %s\n' "$*" >&2; exit 1; }

require() { command -v "$1" >/dev/null 2>&1 || fail "missing prerequisite: $1 (run npm ci first for wrangler)"; }

# ---------------------------------------------------------------- pre-flight
preflight() {
  require node
  require npm
  npx --no-install wrangler --version >/dev/null 2>&1 || fail "wrangler is not installed (run: npm ci)"

  # Refuse obviously placeholder config.
  grep -q 'APP_ORIGIN = "https://your-domain.com"' "$WORKER_CONFIG" \
    && fail "$WORKER_CONFIG still has the placeholder APP_ORIGIN (set your storefront origin)"
  grep -q 'database_id = "REPLACE_WITH_D1_DATABASE_ID"' "$WORKER_CONFIG" \
    && fail "$WORKER_CONFIG still has the placeholder D1 database_id (run: npx wrangler d1 create $D1_NAME)"
  grep -q 'SUPABASE_URL = "https://YOUR_PROJECT.supabase.co"' "$WORKER_CONFIG" \
    && fail "$WORKER_CONFIG still has the placeholder SUPABASE_URL"
  grep -q 'OWNER_EMAIL = "owner@your-domain.com"' "$WORKER_CONFIG" \
    && fail "$WORKER_CONFIG still has the placeholder OWNER_EMAIL"

  if grep -q 'TRUSTPILOT_REVIEW_URL = "https://www.trustpilot.com/review/your-domain.com"' "$WORKER_CONFIG"; then
    say "warning: TRUSTPILOT_REVIEW_URL is a placeholder"
  fi

  test -f public/_headers || fail "public/_headers is missing (required for Pages security headers)"

  # Build-time frontend variables come from .env or the Pages dashboard.
  # VITE_API_BASE_URL is the single switch between the real Worker API and the
  # localStorage preview adapter. If it is empty at BUILD time, the deployed
  # site silently serves seeded demo data and admin edits never reach the
  # database, so treat it as a hard failure rather than a warning.
  if [ -z "${VITE_API_BASE_URL:-}" ] && ! grep -qs '^VITE_API_BASE_URL=.\+' .env; then
    fail "VITE_API_BASE_URL is not set. Building now would ship the localStorage preview adapter:
    the admin dashboard would show mock data and product edits would never reach the database.
    Fix it in one of these ways, then redeploy:
      - local build : add VITE_API_BASE_URL=https://<your-worker>.workers.dev to cashflow-os/.env
      - Pages build : set VITE_API_BASE_URL in the Pages project build environment variables
    Note that Cloudflare Pages needs it set for BOTH Production and Preview environments."
  fi

  # Secrets can only be verified on the deployed Worker; list what is expected.
  say "expected Worker secrets (Lemon Squeezy): LEMONSQUEEZY_API_KEY LEMONSQUEEZY_WEBHOOK_SECRET"
  say "expected Worker secrets (shared): SUPABASE_ANON_KEY RESEND_API_KEY GOOGLE_SHEETS_COPY_URL RATE_LIMIT_SALT FEEDBACK_SIGNING_SECRET"

  ok "pre-flight passed"
}

# ------------------------------------------------------------- dependencies
build_frontend() {
  say "building the storefront"
  npm ci --no-audit --no-fund
  npm run build
  ok "storefront built into dist/"
}

ensure_bucket() {
  say "ensuring R2 bucket $R2_BUCKET"
  if npx wrangler r2 bucket create "$R2_BUCKET" 2>&1 | grep -qi "already exists"; then
    ok "R2 bucket already exists"
  else
    ok "R2 bucket ready"
  fi
}

apply_migrations() {
  say "applying D1 migrations to $D1_NAME"
  npx wrangler d1 migrations apply "$D1_NAME" --remote --config "$WORKER_CONFIG"
  ok "database migrated"
}

deploy_worker() {
  say "deploying the Worker"
  npx wrangler deploy --config "$WORKER_CONFIG"
  ok "Worker deployed"
}

deploy_pages() {
  say "preparing Pages project $PAGES_PROJECT"
  npx wrangler pages project create "$PAGES_PROJECT" --production-branch main >/dev/null 2>&1 || true
  say "deploying storefront to Pages"
  npx wrangler pages deploy dist --project-name "$PAGES_PROJECT"
  ok "Pages deployed"
}

# ------------------------------------------------------------------ dispatch
preflight
case "$MODE" in
  check)
    ok "check complete; run ./scripts/deploy.sh to deploy"
    ;;
  worker)
    ensure_bucket
    apply_migrations
    deploy_worker
    ok "Worker deploy complete; remember to set secrets and the Lemon Squeezy webhook (see DEPLOYMENT.md)"
    ;;
  pages)
    build_frontend
    deploy_pages
    ok "Pages deploy complete"
    ;;
  full)
    build_frontend
    ensure_bucket
    apply_migrations
    deploy_worker
    deploy_pages
    ok "full deploy complete; run the post-deploy checklist in DEPLOYMENT.md"
    ;;
esac
