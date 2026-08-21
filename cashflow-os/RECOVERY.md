# Disaster recovery and availability runbook

How the platform protects itself, what is backed up where, and the exact
steps to get back to a working state when something breaks. Read this once
BEFORE launch; during an incident is the wrong time to learn it.

Related docs: [DEPLOYMENT.md](DEPLOYMENT.md) for the initial setup and
[SECURITY.md](SECURITY.md) for the threat model.

## 1. What recovers itself (no action needed)

| Failure | Self-healing behaviour |
| --- | --- |
| Brevo email send fails | Cron (every 5 min) retries with cooldown, up to 5 attempts per email |
| Brevo daily quota exhausted | A `brevo_quota` circuit breaker pauses the queue until the provider's Retry-After window ends |
| Duplicate Lemon Squeezy webhook delivery | `processed_webhooks` idempotency table; replays are no-ops |
| Worker request crashes | Central handler returns a sanitised 500 with a correlation id; nothing is left half-written except logged |
| Storefront render crash | `AppErrorBoundary` shows a reload screen and reports the crash to `/events/client-error` |
| Admin locked out of authenticator | 10 single-use TOTP recovery codes (shown once at enrolment) |
| Owner's laptop dies | Nothing local exists; the whole system is Cloudflare + Supabase state |

Anything that does NOT recover itself ends up visible in **Admin dashboard >
Operations**: permanently failed deliveries (with a one-click Retry) and
client-side errors reported by visitors' browsers.

## 2. Backups

### What is backed up automatically

- **D1 database (nightly)**: `.github/workflows/backup.yml` runs
  `scripts/backup-d1.sh`, producing a gzipped SQL dump stored in:
  1. R2 bucket `runway-d1-backups` under `d1/YYYY/MM/...`, and
  2. a GitHub Actions artifact kept for 30 days.

  Setup: add repository secrets `CLOUDFLARE_API_TOKEN` (with D1 and R2
  permissions) and `CLOUDFLARE_ACCOUNT_ID`. Until then the workflow skips
  itself, so enable it before real customers exist.

### Manual backup (any time)

```bash
cd cashflow-os
./scripts/backup-d1.sh --bucket runway-d1-backups
```

Local dumps land in `cashflow-os/backups/`, which is gitignored on purpose:
the dumps contain customer emails and purchase records. Never commit them.

### What is NOT covered by D1 dumps

- **R2 product media** (feature screenshots). Restorable only by re-uploading
  in the admin dashboard. If media matters commercially, mirror the bucket
  (`rclone sync` to a second provider) as part of the same schedule.
- **Supabase auth users**. Supabase keeps its own backups (daily on the free
  tier, point-in-time recovery on paid tiers). Losing auth data does not lose
  purchases: buyers re-register with the same email and the account page
  re-links their orders via the email match in the webhook flow.
- **Secrets and Worker variables**. These exist only in the Cloudflare
  dashboard. Keep an offline copy (password manager) of the inventory in
  DEPLOYMENT.md section 2.4.

## 3. Restoring D1

Point-in-time first: D1 Time Travel can roll the database itself back to any
second within the retention window (30 days) with a single command, which is
faster and loses less data than a nightly dump:

```bash
npx wrangler d1 time-travel restore cashflow-os-platform \
  --timestamp 2026-08-21T03:00:00Z
```

Full restore from a dump (Time Travel unavailable, or database deleted):

```bash
# 1. Get the dump (from the R2 backups bucket or a workflow artifact)
npx wrangler r2 object get runway-d1-backups/d1/2026/08/<file>.sql.gz --remote --file /tmp/restore.sql.gz
gunzip /tmp/restore.sql.gz

# 2a. Overwrite in place (safest for keeping the same database_id)
npx wrangler d1 execute cashflow-os-platform --remote --config worker/wrangler.toml --file /tmp/restore.sql

# 2b. Or create a fresh database and point the Worker at it
npx wrangler d1 create cashflow-os-platform-restored
#    -> put the new database_id into worker/wrangler.toml
npx wrangler d1 execute cashflow-os-platform-restored --remote --config worker/wrangler.toml --file /tmp/restore.sql
npx wrangler deploy --config worker/wrangler.toml
```

Then verify: `GET /health` returns `{"ready":true}` and the DEPLOYMENT.md
section 4 checklist passes.

## 4. Alerts and uptime monitoring

- **GitHub Actions (built in)**: `.github/workflows/uptime.yml` probes
  `<worker>/health` and the storefront every 15 minutes during the day and
  fails loudly on error; GitHub emails repository watchers on failure. Set
  the repository variables `WORKER_HEALTH_URL` and `STOREFRONT_URL` to arm it.
- **Recommended on top**: a dedicated monitor (UptimeRobot or Better Stack
  free tier) pointing at the same `/health` URL, because scheduled GitHub
  runs can be delayed during platform busy periods.
- **Cloudflare dashboard**: enable Workers > your Worker > Notifications for
  error-rate alerts, and watch the Workers Analytics Engine error graph
  after each deploy.
- **Structured logs**: every Worker log line is single-line JSON with PII
  redaction; forward them (`wrangler tail` live, or Workers Logpush) to any
  SIEM for long-term retention.

## 5. Playbooks

### Storefront is down, Worker is up
Check the Pages deployment status in the Cloudflare dashboard; redeploy with
`./scripts/deploy.sh --pages`. The Worker keeps checkout webhooks alive
meanwhile, so paid orders are still fulfilled.

### Worker returns 5xx everywhere
`GET /health` reports which variable or binding is missing. Most often a
secret was rotated or a variable was edited; fix in the dashboard or
redeploy with `./scripts/deploy.sh --worker`.

### Buyers paid but got no delivery email
1. Check **Admin > Operations > Delivery issues**; use **Retry** per row.
2. If many rows appear at once, check the Brevo key/quota (the integration
   card in Admin > Integrations) and the Worker logs for
   `brevo_quota` cooldown notices.
3. As a last resort the buyer can always use **Account > Resend delivery**,
   which takes the same retry path.

### Lemon Squeezy webhook outage (payments fine, no entitlements)
Replay the missed events from the Lemon Squeezy dashboard. The
`processed_webhooks` table makes replays safe: already-processed events are
skipped by idempotency key.

### Owner lost the authenticator AND the recovery codes
Bootstrap rule: the TOTP gate is suspended while the `admin_totp` row does
not exist. Sign in to Cloudflare, then:

```bash
npx wrangler d1 execute cashflow-os-platform --remote --config worker/wrangler.toml \
  --command "DELETE FROM admin_totp WHERE id = 1;"
```

...then re-enrol via Admin > Security. Treat this as a break-glass action:
rotate `RATE_LIMIT_SALT` and review `admin_audit_log` afterwards.

### Everything is on fire
1. Restore D1 (section 3).
2. Redeploy from the last green commit: `./scripts/deploy.sh`.
3. Re-set the Worker secrets from the offline inventory.
4. Replay Lemon Squeezy webhooks for the gap window.
5. Re-upload R2 media if the bucket was lost.
6. Run the DEPLOYMENT.md section 4 verification checklist.
