# @realstamp/verify

> Official TypeScript SDK for verifying [RealStamp](https://realstamp.app) credentials, querying live revocation and impersonation feeds, and subscribing to webhook events.

[![npm version](https://img.shields.io/npm/v/@realstamp/verify.svg)](https://www.npmjs.com/package/@realstamp/verify)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

RealStamp is the cryptographic trust layer for the AI provenance era. When a creator stamps content, the credential is signed by a hardware-bound platform authenticator, packaged as an SD-JWT, anchored to [Sigstore Rekor](https://www.sigstore.dev/), and verifiable independently of RealStamp's servers. When a creator revokes a credential or files an impersonation claim, the signal broadcasts to every subscribed platform within minutes.

This SDK is the developer on-ramp. Four lines of code to verify a stamp on your platform; one webhook subscription to stay in sync with revocations and creator claims.

---

## Install

```bash
npm install @realstamp/verify
```

Requires Node 20+, modern browsers, Deno, Bun, or Cloudflare Workers. Zero runtime dependencies.

## 60-second smoke test (no install required)

Before installing, you can confirm a credential is verifiable with a single `curl`:

```bash
curl -sX POST \
  https://hldoychlnejsmxvuxsri.supabase.co/functions/v1/api-verify \
  -H 'content-type: application/json' \
  -d '{"shareLinkId":"abc123def456"}'
```

(Replace `abc123def456` with a real 12-character share-link ID from any RealStamp credential.)

## Quickstart

```ts
import { RealStampClient } from '@realstamp/verify';

const client = new RealStampClient();

const result = await client.verifyStamp({ shareLinkId: 'abc123def456' });

if (result.valid) {
  // Trust the credential. Render the verified badge.
} else if (result.isRevoked) {
  console.warn('REVOKED:', result.revocationReason, 'on', result.revokedAt);
  // Render a "withdrawn by creator" warning instead of the badge.
} else {
  console.warn('Invalid:', result.reason ?? 'unknown');
}
```

That's it. Same call signature works for SD-JWT credentials (`{ sdJwt }`), short share links (`{ shareLinkId }`), or legacy tokens (`{ pulseToken }`). The discriminated `verificationMethod` field tells you which path resolved.

### A note about `cryptoVerified` vs `valid`

The two flags answer different questions:

- **`valid`** — *should you trust this credential?* `true` only when the credential is both signature-valid AND not revoked.
- **`cryptoVerified`** — *did the cryptographic signature math check out, regardless of revocation state?*

For SD-JWT verification (`{ sdJwt }`), the SDK verifies the ES256 signature against the published JWKS, so `cryptoVerified` reflects the real outcome of that math. For share-link and legacy-token verification (`{ shareLinkId }` / `{ pulseToken }`), the SDK does a database lookup (the original SD-JWT is not sent over the wire), so `cryptoVerified` is always `false` even on active credentials. The DB lookup is still cryptographically anchored to the published revocation list, so `valid` remains the verdict you build UI on.

Rule of thumb: render trust UI off of `valid`. Inspect `cryptoVerified` only when you need to distinguish offline-verifiable credentials from server-attested ones.

---

## What you can do

| Use case | Method |
|---|---|
| Verify a stamp (single credential lookup) | `client.verifyStamp(input)` |
| List recent revocations across the platform | `client.getRecentRevocations()` |
| Check the live status of a stamp by ID | `client.getRevocationStatus(stampId)` |
| List recent impersonation claims | `client.getRecentImpersonationClaims()` |
| Get a single impersonation claim | `client.getImpersonationClaim(claimId)` |
| Subscribe a webhook for live broadcasts | `client.subscribeToEvents(opts, auth)` |
| Cancel a webhook subscription | `client.unsubscribeFromEvents(id, auth)` |
| Verify a webhook signature | `verifyWebhookSignature(body, header, secret)` |
| Parse a webhook payload to typed event | `parseWebhookPayload(body)` |

---

## Configuration

```ts
const client = new RealStampClient({
  baseUrl: 'https://hldoychlnejsmxvuxsri.supabase.co', // see the API host note below
  apiKey: process.env.REALSTAMP_API_KEY,  // optional, for API-key auth
  timeoutMs: 30_000,                      // per-request timeout (default 30s)
  fetch: customFetch,                     // optional custom fetch
  headers: { 'X-Tenant-Id': 'reuters' },  // optional default headers
});
```

All methods accept an optional `signal: AbortSignal` for cancellation.

### API host

`v0.1.x` ships pointing at the Supabase project that serves the RealStamp Edge Functions. A Cloudflare Pages reverse-proxy at `https://realstamp.app/functions/v1/*` is in place and will become the default in `v0.2`. If your environment requires a branded allowlist now, override the default explicitly:

```ts
const client = new RealStampClient({ baseUrl: 'https://realstamp.app' });
```

After `v0.2`, both URLs continue to work — only the default flips.

The `timeoutMs` default is `30_000` (30 seconds) — generous enough to absorb a Supabase Edge cold start on a Cloudflare Worker without surfacing as `request_timeout`. Tighten it if you're calling from a Node server with stable connectivity.

## Rate limits + credentials

Anonymous calls (no `apiKey`, no `accessToken`) are rate-limited at **60 requests per minute per IP** for verify endpoints. Anonymous integration is fine for low-volume verification (a single article page, a single Substack badge), but production-scale embedding needs an API key.

On a 429 you'll get a typed `RealStampError` with `code: 'rate_limited'` and a `retry_after_seconds` field on `err.payload`:

```ts
import { isRealStampError } from '@realstamp/verify';
try {
  await client.verifyStamp({ shareLinkId });
} catch (err) {
  if (isRealStampError(err) && err.code === 'rate_limited') {
    const retryAfter = (err.payload as { retry_after_seconds?: number })?.retry_after_seconds ?? 60;
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    // retry
  }
}
```

To request an API key (`rs_live_*` format) for higher-volume verify + listing endpoints, or an access token for webhook subscriptions, email **security@realstamp.app**. Self-serve key issuance is on the roadmap.

---

## Verification result

```ts
interface VerifyResult {
  valid: boolean;            // crypto-verified AND not revoked
  cryptoVerified: boolean;   // signature math checks out (independent of revocation)
  isRevoked: boolean;        // creator has withdrawn this stamp
  strictRekor: boolean;      // Rekor inclusion was strictly checked
  verificationMethod: 'sd_jwt' | 'share_link_lookup' | 'legacy_token_lookup';
  currentStatus: CurrentStatus | null; // live DB-backed status
  revocationReason: RevocationReason | null;
  revokedAt: string | null;
  reason?: string;           // crypto failure code, when valid is false
  // sd_jwt path adds:    kid, payload, disclosures
  // share_link / legacy: stamp, trustContext
}
```

`valid` is the one boolean to render UI off of. It's true only when both the signature math passes AND the creator has not withdrawn the credential. Treat the other flags as diagnostic detail.

---

## Strict Rekor verification

By default the SDK uses RealStamp's revocation list (fail-soft against the published list, fast and reliable). To additionally verify the credential's anchor entry is present in Sigstore Rekor at request time, opt in:

```ts
const result = await client.verifyStamp({ sdJwt }, { strictRekor: true });
```

Strict Rekor verification is fail-closed — if Rekor is unreachable, the call returns `valid: false, reason: 'rekor_unreachable'`. Use this only when your application can tolerate a brief Rekor outage causing verification failures.

---

## Webhooks

When you subscribe a webhook URL, RealStamp posts signed JSON events whenever a new revocation list is published or an impersonation claim is filed. The `webhookSecret` returned at subscription time is shown ONCE — store it securely.

```ts
import { verifyWebhookSignature, parseWebhookPayload } from '@realstamp/verify/webhooks';

// In your webhook handler (Express, Hono, Cloudflare Workers, etc.):
app.post('/webhooks/realstamp', async (req, res) => {
  const rawBody = await readRawBody(req); // do NOT use req.body if it's already JSON-parsed
  const ok = await verifyWebhookSignature(
    rawBody,
    req.headers['x-realstamp-signature'],
    process.env.REALSTAMP_WEBHOOK_SECRET!,
  );
  if (!ok) return res.status(401).send('invalid signature');

  const event = parseWebhookPayload(rawBody);
  if (event.event_type === 'revocation') {
    await invalidateCacheForVersion(event.version);
  } else if (event.event_type === 'impersonation_claim') {
    // Note: this is a SIGNED CLAIM, NOT a verified finding.
    // See event.disclaimer for the verbatim legal disclaimer.
    await reviewClaim(event.claim_id);
  }

  res.status(200).send('ok');
});
```

### Subscription example

```ts
const sub = await client.subscribeToEvents(
  {
    webhookUrl: 'https://reuters.example.com/webhooks/realstamp',
    eventTypes: ['revocation', 'impersonation_claim'],
    label: 'Production webhook',
  },
  { accessToken: userJwt },
);

console.log('Subscription ID:', sub.id);
console.log('Secret (store securely):', sub.webhookSecret);
```

---

## Error handling

All non-2xx responses and transport failures throw a `RealStampError`. Inspect the `code` for stable error identifiers:

```ts
import { isRealStampError } from '@realstamp/verify';

try {
  const result = await client.verifyStamp({ shareLinkId: 'maybe-bad' });
} catch (err) {
  if (isRealStampError(err)) {
    switch (err.code) {
      case 'stamp_not_found':
        // Share link does not resolve to any stamp
        break;
      case 'bad_share_link_id':
        // Format check failed before lookup
        break;
      case 'rate_limited':
        // Back off; check err.payload for retry_after
        break;
      case 'request_timeout':
      case 'network_error':
        // Transport failure, retry with backoff
        break;
      default:
        console.error('RealStamp error:', err.code, err.payload);
    }
  }
}
```

---

## Identity & trust roots

The SDK assumes RealStamp's published JWKS and revocation list are the canonical trust roots. They live at:

- JWKS: <https://realstamp.app/.well-known/jwks.json>
- OIDC discovery: <https://realstamp.app/.well-known/openid-configuration>
- Revocation list (signed JWS): see VERIFICATION.md

For verifiers who want to verify SD-JWT credentials entirely offline (no calls to `api-verify`), see the [Verification Protocol](https://realstamp.app/VERIFICATION.md) — every step is implementation-ready, and a future SDK release will ship `verifySdJwtOffline()` that wraps it.

---

## Open standard, commercial cloud

This SDK is Apache-2.0. The verification protocol, the JWKS rotation tooling, and the reference verifier are open and stable. RealStamp's commercial product is the hosted signing infrastructure, the revocation broadcast service, and enterprise SLAs — sold to platforms that integrate this SDK and need a backed counterparty.

Source: <https://github.com/emiliacarp/realstamp-sdk>
Issues: <https://github.com/emiliacarp/realstamp-sdk/issues>

---

## License

Apache License, Version 2.0 — see [LICENSE](LICENSE).
