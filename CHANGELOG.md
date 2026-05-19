# Changelog

All notable changes to `@realstamp/verify` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] — 2026-05-19

### Changed

- **Default `timeoutMs` raised from 10s → 30s.** Generous enough to absorb a Supabase Edge cold start through the edge proxy without surfacing as `request_timeout`. Stable Node servers can tighten by passing `{ timeoutMs: 5000 }` to the constructor.
- **`fetch` is now resolved lazily at call time** instead of being captured at constructor time. Next.js (and other frameworks) patch `globalThis.fetch` at runtime for caching/revalidation; capturing eagerly held a stale reference. Explicit `opts.fetch` is still respected when provided.
- README significantly expanded: 60-second cURL smoke-test, rate-limit + credentials section, `cryptoVerified` vs `valid` rule of thumb, error-handling worked example.
- Repo polish: SECURITY.md (private disclosure channel), CONTRIBUTING.md (no-runtime-deps stance, branch + PR rules), `.github/ISSUE_TEMPLATE/bug_report.yml` (structured bug intake) + `config.yml` (route security to private, route API key requests to security@realstamp.app).
- Removed "indemnification" language from the open-core section (hostage to E&O insurance before we have it).

### Fixed

- README claimed the default `baseUrl` was `realstamp.app` while the binary defaulted to the bare Supabase URL. Both now consistently document the Supabase default, with the `realstamp.app/functions/v1/*` branded URL flagged as the upcoming `v0.2` default once the edge proxy fully propagates.

### Notes

- No source API changes — all v0.1.0 exports work identically. Patch-bump per semver.
- The Cloudflare Pages reverse-proxy at `https://realstamp.app/functions/v1/*` is shipped in the main realstamp repo; once it's live in production, `v0.2` will flip the SDK's default `baseUrl` to use it. Both URLs continue to work in parallel.

## [0.1.0] — 2026-05-19

### Added — initial public release

- `RealStampClient` — primary HTTP client with:
  - `verifyStamp({ sdJwt | shareLinkId | pulseToken }, { strictRekor? })` — verifies a credential via any of the three lookup paths; returns a typed discriminated union on `verificationMethod`.
  - `getRecentRevocations({ limit?, since? })` — recent revocations feed.
  - `getRevocationStatus(stampId)` — live status of a single stamp.
  - `getRecentImpersonationClaims({ limit?, since?, status? })` — recent impersonation claims feed.
  - `getImpersonationClaim(claimId)` — single claim by ID.
  - `subscribeToEvents({ webhookUrl, eventTypes, label }, { accessToken })` — register a webhook subscription. Webhook secret returned once.
  - `unsubscribeFromEvents(id, { accessToken })` — cancel a subscription.
- `verifyWebhookSignature(body, header, secret)` — constant-time HMAC-SHA256 signature verification. Accepts bare hex or `sha256=` prefixed headers. Exported from `@realstamp/verify/webhooks`.
- `parseWebhookPayload(body)` — type-safe parse of a webhook body into a `WebhookEvent` discriminated union.
- `RealStampError` + `isRealStampError(err)` — typed error class with stable `code` field and structured `payload`.
- Full TypeScript types for every public API shape, including `VerifyResult`, `PublicStamp`, `TrustContext`, `SdJwtPayload`, `Disclosure`, `RevocationListItem`, `ImpersonationClaim`, `RevocationWebhookEvent`, `ImpersonationClaimWebhookEvent`.
- Dual ESM + CJS distribution with `.d.ts` types.
- Zero runtime dependencies; uses native `fetch` and `globalThis.crypto.subtle`.

### Notes

- `valid` is the canonical trust verdict — true only when the credential is signature-valid AND not revoked. Prior beta versions exposed signature-only validity; v0.1.0 is the stable contract going forward.
- `strict_rekor` is off by default. Pass `{ strictRekor: true }` to additionally verify Rekor inclusion at request time (fail-closed on Rekor outage).
- The default revocation-list URL used by RealStamp's `api-verify` is RealStamp-served and fail-soft. Verifiers who want offline verification can fetch the JWS directly from <https://realstamp.app/.well-known/revocation-list/current.jws> and validate it against the JWKS at <https://realstamp.app/.well-known/jwks.json>.
- Webhook payloads broadcast by impersonation events include a verbatim legal disclaimer. **Always read `event.disclaimer` before acting on a claim.** RealStamp delivers signed signals, not verified findings.

### Roadmap

- `verifySdJwtOffline(sdJwt, { trustRoots })` — pure-WebCrypto local verification with no HTTP call. Targeting v0.2.
- `getTrustRoots()` — convenience fetcher for JWKS + OIDC + revocation list. Targeting v0.2.
- `listStamps({ apiKey })` — API-key-authenticated stamp listing. Targeting v0.3.
