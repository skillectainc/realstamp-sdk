# Security Policy

## Reporting a vulnerability

If you discover a security issue in `@realstamp/verify` or in the RealStamp service it talks to, please report it privately:

- **Email:** security@realstamp.app
- **Subject line:** `[security] @realstamp/verify — <one-line summary>`
- **PGP key:** available on request at the same address

Please **do not** open a public GitHub issue for security reports. Use the email channel so we can triage and remediate before any details become public.

We commit to:

1. Acknowledging your report within **48 hours**.
2. Providing an initial assessment (severity + likely path to fix) within **5 business days**.
3. Coordinating disclosure on a timeline that gives integrators time to upgrade before public details appear.
4. Crediting researchers in release notes when desired.

## Supported versions

| Version | Supported |
|---------|-----------|
| `0.1.x` | ✅ Current |
| `< 0.1` | ❌ |

When a new minor or major version ships, the previous minor receives critical security patches for at least 30 days.

## Scope

In scope for this repository:

- The published `@realstamp/verify` npm package (any version)
- Source code in this repository
- Build artifacts published to npm under `@realstamp/*`

Out of scope here (report at the same email — we'll route appropriately):

- The realstamp.app web application
- Supabase Edge Functions (`api-verify`, `revocations-api`, `impersonation-api`, etc.)
- Sigstore Rekor (report to Sigstore directly)
- Underlying cryptographic primitives (ES256, WebAuthn, HMAC-SHA256)

## What constitutes a vulnerability

Examples of in-scope issues for this SDK:

- A way to make the verifier return `valid: true` for a credential that should be invalid
- A webhook signature bypass (returning `true` for a tampered or unsigned body)
- Information disclosure beyond what the public API exposes
- Dependency vulnerabilities in our (very small) runtime surface
- Type definitions that allow a consumer to bypass a documented safety contract

Examples that are NOT vulnerabilities (please open a regular issue):

- Rate-limited responses (HTTP 429) under normal load
- Stale cached results within documented cache windows
- Errors raised by malformed input that's documented as invalid
