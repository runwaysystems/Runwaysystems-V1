# Disaster recovery and availability runbook

How the platform protects itself, what is backed up where, and the exact
steps to get back to a working state when something breaks. Read this once
BEFORE launch; during an incident is the wrong time to learn it.

Related docs: [DEPLOYMENT.md](DEPLOYMENT.md) for the initial setup and
[SECURITY.md](SECURITY.md) for the threat model.

## 1. What recovers itself (no action needed)

| Failure | Self-healing behaviour |
| --- | --- |
| Brevo email send fails | Cron (every 5 min) retries paid delivery, complimentary invitations, and review email with cooldown, up to 5 attempts per email |
| Complimentary invitation is resent | A new encrypted/hashed token replaces the old token and restarts the seven-day claim window; old links stop working |
| Brevo daily quota exhausted | A `brevo_quota` circuit breaker pauses the queue until the provider's Retry-After window ends |
| Duplicate Lemon Squeezy webhook delivery | `processed_webhooks` idempotency table; replays are no-ops |
| Worker request crashes | Central handler returns a sanitised 500 with a correlation id; nothing is left half-written except logged |
| Storefront render crash | `AppErrorBoundary` shows a reload screen and reports the crash to `/events/client-error` |
| Admin locked out of authenticator | 10 single-use TOTP recovery codes (shown once at enrolment) |
| Owner's laptop dies | Nothing local exists; the whole system is Cloudflare + Supabase state |

Anything that does not recover itself is visible in the owner dashboard.
Paid delivery failures and browser errors appear under **Operations**;
complimentary invitation status, resend, cancel, and revoke controls appear
under **Complimentary access**.

## 2. Backups

### Automated backup template

- **D1 database (nightly after activation)**: copy
  `docs/workflow-templates/backup.yml` to `.github/workflows/backup.yml`. It
  creates a gzipped SQL dump and uploads it to a private R2 bucket. Customer
  data is deliberately not copied into GitHub artifacts.

  Setup: add repository secrets `CLOUDFLARE_API_TOKEN` (with D1 read/export
  and R2 edit permissions) and `CLOUDFLARE_ACCOUNT_ID`, plus repository
  variable `CLOUDFLARE_BACKUP_BUCKET`. Missing configuration fails visibly.

### Manual backup (any time)

```bash
cd cashflow-os
./scripts/backup-d1.sh --bucket runway-d1-backups
```

Local dumps land in `cashflow-os/backups/`, which is gitignored on purpose:
the dumps contain customer emails and purchase records. Never commit them.

### What is NOT covered by D1 dumps

- **R2 product and Blog media** (feature screenshots, article covers, and
  inline images). Restorable only by re-uploading in the admin dashboard
  unless the bucket is mirrored. If media matters commercially, mirror the
  bucket (`rclone sync` to a second provider) as part of the same schedule.
- **Supabase auth users**. Supabase backup and point-in-time options depend on
  the selected plan and must be configured separately. D1 entitlements are
  bound to Supabase user IDs, so restoring auth identity mappings is part of
  recovery; the account page does not relink purchases from email alone.
- **Secrets and Worker variables**. These exist only in the Cloudflare
  dashboard. Keep an offline copy (password manager) of the inventory in
  DEPLOYMENT.md section 2.4. Restoring the same `TOTP_ENCRYPTION_KEY` preserves
  pending complimentary invitation retries and the encrypted admin TOTP seed;
  if it is lost, use the recovery-code playbook and rotate affected invitations.

## 3. Restoring D1

Point-in-time first: D1 Time Travel can roll the database back within the
retention window available to the current Cloudflare plan. Confirm the window
in Cloudflare before choosing a timestamp:

```bash
npx wrangler d1 time-travel restore cashflow-os-platform \
  --timestamp 2026-08-21T03:00:00Z
```

Full restore from a dump (Time Travel unavailable, or database deleted):

```bash
# 1. Get the dump from the private R2 backups bucket
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

- **GitHub Actions template**: activate `docs/workflow-templates/uptime.yml` as
  `.github/workflows/uptime.yml`. It then probes the Worker and storefront JSON
  health endpoints every 10 minutes and fails loudly on error. Set repository
  variables `PLATFORM_HEALTH_URL` and `STOREFRONT_HEALTH_URL` to their complete
  `/health` URLs.
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

### Blog reader did not receive or cannot use a confirmation link
1. Ask the reader to check spam and confirm they entered the intended address.
2. They can submit the footer signup again. This rotates any pending token and
   sends a fresh 48-hour link without revealing whether the address existed.
3. The reader must use the browser tab that opened the confirmation link and
   press the explicit confirmation button. GET requests and mail scanners cannot
   activate consent; a used or expired token must be replaced by a new signup.
4. Check Brevo provider status and Worker logs using the correlation ID. Never
   confirm a contact directly unless the owner has separate, auditable proof
   of explicit consent through the existing manual-contact flow.

### Complimentary customer did not receive or cannot claim an invitation
1. Open **Admin > Complimentary access** and check the email and claim status.
2. Confirm the selected products still have valid delivery links.
3. Use **Resend** to rotate the token and queue a fresh seven-day invitation;
   the old link becomes invalid immediately.
4. The recipient must use the exact invited Google email. Do not normalize
   Gmail dots, aliases, or `+` addresses manually.
5. If access was granted to the wrong address, cancel it while pending or use
   the TOTP-protected **Revoke** action after claim. Revocation never removes a
   separate paid entitlement for the same product.

### Blog draft, publication, or media recovery
1. Check the browser recovery draft in **Admin → Blog**. Unsaved writing is buffered locally until the versioned server autosave succeeds.
2. For an unwanted saved or published edit, open **Revision history** and restore the prior checkpoint; restore writes a new auditable version rather than deleting history.
3. Recover an archived or deleted article from the **Trash** view within 30 days. Public reads, RSS, sitemap, and LLM discovery exclude it while trashed.
4. After an accidental public URL change, do not recreate the old slug. The `blog_slug_redirects` record permanently routes it to the current canonical article.
5. D1 point-in-time recovery is authoritative for lost post metadata and revisions. Restore the paired R2 inventory for lost media, preserving each immutable `blog-media/` key and checksum.
6. If publication succeeded but discovery appears stale, inspect unprocessed `blog_publication_outbox` rows and invoke the scheduled trigger. The retry is idempotent.

### Lemon Squeezy webhook outage (payments fine, no entitlements)
Replay the missed events from the Lemon Squeezy dashboard. The
`processed_webhooks` table makes replays safe: already-processed events are
skipped by idempotency key.

### Owner lost the authenticator AND the recovery codes
The mutation gate is never globally suspended. When the `admin_totp` row is
absent, only the TOTP enrollment and verification bootstrap routes are
available; all other admin mutations return 428. Sign in to Cloudflare, then:

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
