# GitHub Actions workflow templates

These files are preserved as inactive templates because the automated repository
integration used for this release cannot write directly to `.github/workflows/`.
They do not run from this directory.

To activate them, copy the desired YAML files into `.github/workflows/` using an
account or GitHub App with workflow write permission:

```text
.github/workflows/ci.yml
.github/workflows/backup.yml
.github/workflows/uptime.yml
```

Before enabling scheduled production jobs, configure the repository settings
documented in `DEPLOYMENT.md` and `RECOVERY.md`. In particular, the backup job
requires Cloudflare credentials and an R2 bucket, while the uptime job requires
storefront and platform health URLs.
