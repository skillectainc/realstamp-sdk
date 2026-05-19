import { describe, expect, it } from 'vitest';
import { parseWebhookPayload, verifyWebhookSignature } from '../src/webhooks.js';
import { hmacSha256Hex } from '../src/utils.js';

const SECRET = 'whsec_test_5f3a2b1c8d9e7f4a6b5c2d1e';

const REVOCATION_BODY = JSON.stringify({
  event_type: 'revocation',
  version: '2026-05-19T05:17:23Z',
  revocation_list_url: 'https://realstamp.app/.well-known/revocation-list/current.jws',
  jws_sha256: 'abc123def456',
  revoked_count: 1,
  ts: '2026-05-19T05:17:23Z',
});

const IMPERSONATION_BODY = JSON.stringify({
  event_type: 'impersonation_claim',
  version: '2026-05-19T05:20:00Z',
  claim_id: '11111111-2222-3333-4444-555555555555',
  claim_type: 'likeness_deepfake',
  claimant: {
    display_name: 'Emilia',
    verified_creator_id: '1aad33fc-e2bf-4083-9d7b-efd2aff94f28',
    active_claims: 1,
    rescinded_claims: 0,
  },
  accused: {
    url: 'https://example.com/fake',
    platform: 'instagram',
  },
  claim_note_preview: 'This is a deepfake of me',
  attestations: {
    good_faith: true,
    not_parody: true,
    has_authority: true,
  },
  anchor: { rekor_uuid: null, rekor_index: null },
  filed_at: '2026-05-19T05:20:00Z',
  status: 'active',
  disclaimer: 'This is a creator\'s signed claim, not a verified finding.',
});

describe('verifyWebhookSignature', () => {
  it('accepts a valid bare hex signature', async () => {
    const sig = await hmacSha256Hex(SECRET, REVOCATION_BODY);
    const ok = await verifyWebhookSignature(REVOCATION_BODY, sig, SECRET);
    expect(ok).toBe(true);
  });

  it('accepts a sha256= prefixed signature', async () => {
    const sig = await hmacSha256Hex(SECRET, REVOCATION_BODY);
    const ok = await verifyWebhookSignature(REVOCATION_BODY, `sha256=${sig}`, SECRET);
    expect(ok).toBe(true);
  });

  it('is case-insensitive on the hex digits', async () => {
    const sig = await hmacSha256Hex(SECRET, REVOCATION_BODY);
    const ok = await verifyWebhookSignature(REVOCATION_BODY, sig.toUpperCase(), SECRET);
    expect(ok).toBe(true);
  });

  it('rejects when the body has been tampered', async () => {
    const sig = await hmacSha256Hex(SECRET, REVOCATION_BODY);
    const tampered = REVOCATION_BODY.replace('1', '999');
    const ok = await verifyWebhookSignature(tampered, sig, SECRET);
    expect(ok).toBe(false);
  });

  it('rejects when signed with a different secret', async () => {
    const sig = await hmacSha256Hex('wrong_secret', REVOCATION_BODY);
    const ok = await verifyWebhookSignature(REVOCATION_BODY, sig, SECRET);
    expect(ok).toBe(false);
  });

  it('rejects empty / missing signature', async () => {
    expect(await verifyWebhookSignature(REVOCATION_BODY, '', SECRET)).toBe(false);
    expect(await verifyWebhookSignature(REVOCATION_BODY, null, SECRET)).toBe(false);
    expect(await verifyWebhookSignature(REVOCATION_BODY, undefined, SECRET)).toBe(false);
  });

  it('rejects non-hex signatures', async () => {
    expect(await verifyWebhookSignature(REVOCATION_BODY, 'not-a-hex-string', SECRET)).toBe(false);
    expect(await verifyWebhookSignature(REVOCATION_BODY, 'sha256=not-hex', SECRET)).toBe(false);
  });

  it('works with Uint8Array bodies', async () => {
    const bodyBytes = new TextEncoder().encode(REVOCATION_BODY);
    const sig = await hmacSha256Hex(SECRET, bodyBytes);
    const ok = await verifyWebhookSignature(bodyBytes, sig, SECRET);
    expect(ok).toBe(true);
  });
});

describe('parseWebhookPayload', () => {
  it('parses a revocation event', () => {
    const event = parseWebhookPayload(REVOCATION_BODY);
    expect(event.event_type).toBe('revocation');
    if (event.event_type === 'revocation') {
      expect(event.revoked_count).toBe(1);
      expect(event.revocation_list_url).toContain('current.jws');
    }
  });

  it('parses an impersonation_claim event', () => {
    const event = parseWebhookPayload(IMPERSONATION_BODY);
    expect(event.event_type).toBe('impersonation_claim');
    if (event.event_type === 'impersonation_claim') {
      expect(event.claim_type).toBe('likeness_deepfake');
      expect(event.attestations.good_faith).toBe(true);
      expect(event.disclaimer.length).toBeGreaterThan(0);
    }
  });

  it('throws on invalid JSON', () => {
    expect(() => parseWebhookPayload('not json{')).toThrow(/not valid JSON/);
  });

  it('throws on unrecognized event_type', () => {
    const body = JSON.stringify({ event_type: 'something_else' });
    expect(() => parseWebhookPayload(body)).toThrow(/unrecognized event_type/);
  });
});
