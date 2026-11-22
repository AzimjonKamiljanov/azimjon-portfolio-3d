# Security Policy

## Supported versions

Only the current `main` branch, as deployed to <https://azimjon.dev>, receives
security fixes. There are no long-lived release branches.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for a security problem.

Report it privately through one of these channels:

1. GitHub → **Security** tab → **Report a vulnerability** (private advisory)
2. Telegram: [@CyberAgentNexus](https://t.me/CyberAgentNexus)

Please include:

- the affected URL or file and, where relevant, the commit hash
- steps to reproduce, or a proof-of-concept request
- what an attacker could achieve with it

Expected response time: **72 hours** to first reply. This is a personal
project, so there is no formal SLA beyond that.

## Scope

In scope:

- `worker.js` — the Cloudflare Worker, including `POST /api/contact`
- `src/**` — the client-side application
- the deployed site at `azimjon.dev` and its security headers
- the repository's CI configuration and build scripts

Out of scope:

- third-party services the project merely calls (Cloudflare, Telegram)
- findings that require a compromised browser, extension, or local machine
- volumetric denial of service; rate limiting is handled by Cloudflare
- missing headers with no demonstrated impact, reported from a scanner only

## Handling of secrets

No credential belongs in this repository. All runtime secrets
(`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TURNSTILE_SECRET_KEY`) are stored
as Cloudflare Worker secrets and are read from `env` at request time. There are
no fallback defaults in code — a missing value makes the endpoint return 500
rather than silently using a hardcoded one.

`.dev.vars` is git-ignored; `.dev.vars.example` documents the required keys
with placeholder values only.

Every CI run scans the full git history with Gitleaks. The job **fails** on any
finding, so a leak cannot land on `main` unnoticed.

`.gitleaksignore` holds an allowlist of findings that are already resolved.
Entries are fingerprints — `<commit>:<file>:<rule>:<line>` — so each one
suppresses exactly one occurrence; the same credential appearing anywhere else
still fails the build. An entry is only ever added for a credential that has
already been revoked, and it carries a comment saying when and why. A live
credential is never allowlisted; the only correct response to one is to
revoke it.

If you believe a credential has been exposed, report it through the private
channels above rather than opening an issue — an issue would publicise the
exposure before it can be rotated.
