#!/usr/bin/env bash
# test-worker-local.sh - run the Worker regression suite the way CI does.
#
# Starts the full local stack (local D1 + R2 emulation, the mock Supabase
# fixture, wrangler dev) and runs tests/worker-local-regression.mjs against
# it. Requires worker/.dev.vars filled with safe local test values; the
# webhook secret for signing test events is read out of that file so the
# two can never disagree.
#
# Safe to re-run: rate-limit buckets live for up to a day, so before the
# run starts the script clears the runtime tables that would otherwise
# contaminate a quick second run.
set -euo pipefail

cd "$(dirname "$0")/.."

say()  { printf '\033[1;33m[test:worker]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[test:worker]\033[0m %s\n' "$*" >&2; exit 1; }

WORKER_CONFIG="worker/wrangler.toml"
D1_NAME="${D1_NAME:-cashflow-os-platform}"

[ -f worker/.dev.vars ] || fail "worker/.dev.vars is missing (see README: copy safe local test values into it)"
WEBHOOK_SECRET="$(grep '^LEMONSQUEEZY_WEBHOOK_SECRET=' worker/.dev.vars | cut -d= -f2-)"
[ -n "$WEBHOOK_SECRET" ] || fail "LEMONSQUEEZY_WEBHOOK_SECRET is not set in worker/.dev.vars"

# wrangler applies local D1 migrations in batches, not in one pass, so call
# it repeatedly until none are left, then prove the newest table exists.
say "applying local D1 migrations (batch-safe)"
for _ in 1 2 3; do
  npx --no-install wrangler d1 migrations apply "$D1_NAME" --local --config "$WORKER_CONFIG" >/dev/null 2>&1 || true
done
say "verifying the newest migration table exists"
npx --no-install wrangler d1 execute "$D1_NAME" --local --config "$WORKER_CONFIG" \
  --command "SELECT id FROM client_errors LIMIT 1" >/dev/null \
  || fail "local migrations did not fully apply - run the apply command manually and check for SQL errors"

# A fresh run must start from clean buckets and queues; rapid re-runs
# otherwise trip the checkout rate limits by design.
say "clearing runtime tables for a repeatable run"
npx --no-install wrangler d1 execute "$D1_NAME" --local --config "$WORKER_CONFIG" --command "
  DELETE FROM rate_limits; DELETE FROM purchases; DELETE FROM processed_webhooks;
  DELETE FROM review_requests; DELETE FROM revoked_orders; DELETE FROM daily_metrics;
  DELETE FROM client_errors; DELETE FROM admin_audit_log; DELETE FROM checkout_consents;
  DELETE FROM feedback; DELETE FROM brevo_quota; DELETE FROM bundles; DELETE FROM testimonials;" >/dev/null

say "starting the mock Supabase fixture on :9876"
node tests/mock-supabase.mjs >/dev/null 2>&1 &
MOCK_PID=$!

say "starting wrangler dev on :8787"
CI=true npx --no-install wrangler dev --local --config "$WORKER_CONFIG" --port 8787 --ip 127.0.0.1 >/dev/null 2>&1 &
DEV_PID=$!

cleanup() { kill "$MOCK_PID" "$DEV_PID" 2>/dev/null || true; }
trap cleanup EXIT

say "waiting for the Worker to report readiness"
ready=0
for _ in $(seq 1 60); do
  if curl -fsS -o /dev/null http://127.0.0.1:8787/health 2>/dev/null; then ready=1; break; fi
  sleep 2
done
[ "$ready" = "1" ] || fail "the local Worker never became ready on :8787"

say "running the regression suite"
LEMONSQUEEZY_WEBHOOK_SECRET="$WEBHOOK_SECRET" \
WORKER_OWNER_TOKEN=ci-local-owner-token \
WORKER_BASE_URL=http://127.0.0.1:8787 \
WORKER_APP_ORIGIN=https://regression-store.test \
node tests/worker-local-regression.mjs
