# Changelog

All notable changes to `@realstamp/verify` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
