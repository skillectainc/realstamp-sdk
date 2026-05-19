/**
 * Webhook helpers — verify HMAC-SHA256 signatures on incoming RealStamp
 * webhook events and parse the payload into a typed discriminated union.
 *
 * Import from `@realstamp/verify/webhooks` to avoid pulling in the HTTP client:
 *
 *   import { verifyWebhookSignature, parseWebhookPayload } from '@realstamp/verify/webhooks';
 *
 *   const ok = await verifyWebhookSignature(rawBody, req.headers['x-realstamp-signature'], secret);
 *   if (!ok) throw new Error('invalid signature');
 *   const event = parseWebhookPayload(rawBody);
 *   if (event.event_type === 'revocation') { ... }
 */

import { constantTimeEqual, hmacSha256Hex } from './utils.js';
import type {
  ImpersonationClaimWebhookEvent,
  RevocationWebhookEvent,
  WebhookEvent,
} from './types.js';

export type { WebhookEvent, RevocationWebhookEvent, ImpersonationClaimWebhookEvent };

/**
 * Verify a webhook signature header against the raw request body and your
 * subscription's `webhookSecret`. Returns true only when the HMAC-SHA256
 * matches in constant time.
 *
 * The header value may be either:
 *   - The bare hex digest, e.g. `1a2b3c...`
 *   - The Stripe-style scheme prefix, e.g. `sha256=1a2b3c...`
 */
export async function verifyWebhookSignature(
  rawBody: string | Uint8Array,
  signatureHeader: string | null | undefined,
  webhookSecret: string,
): Promise<boolean> {
  if (!signatureHeader || !webhookSecret) return false;
  const provided = parseSignatureHeader(signatureHeader);
  if (!provided) return false;
  const expected = await hmacSha256Hex(webhookSecret, rawBody);
  return constantTimeEqual(provided.toLowerCase(), expected.toLowerCase());
}

/**
 * Parse the raw webhook body into a typed discriminated union. Throws on
 * invalid JSON or unrecognized `event_type`. ALWAYS verify the signature
 * before parsing.
 */
export function parseWebhookPayload(rawBody: string | Uint8Array): WebhookEvent {
  const text =
    typeof rawBody === 'string' ? rawBody : new TextDecoder().decode(rawBody);
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch (err) {
    throw new Error(
      `parseWebhookPayload: body is not valid JSON (${(err as Error).message})`,
    );
  }
  if (!obj || typeof obj !== 'object') {
    throw new Error('parseWebhookPayload: body is not a JSON object');
  }
  const eventType = (obj as { event_type?: unknown }).event_type;
  if (eventType === 'revocation') {
    return obj as RevocationWebhookEvent;
  }
  if (eventType === 'impersonation_claim') {
    return obj as ImpersonationClaimWebhookEvent;
  }
  throw new Error(
    `parseWebhookPayload: unrecognized event_type ${JSON.stringify(eventType)}`,
  );
}

function parseSignatureHeader(header: string): string | null {
  const trimmed = header.trim();
  if (!trimmed) return null;
  // Stripe-style: sha256=<hex>
  if (trimmed.toLowerCase().startsWith('sha256=')) {
    const hex = trimmed.slice('sha256='.length).trim();
    return /^[0-9a-fA-F]+$/.test(hex) ? hex : null;
  }
  // Bare hex
  if (/^[0-9a-fA-F]+$/.test(trimmed)) return trimmed;
  return null;
}
