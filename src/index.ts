/**
 * @realstamp/verify
 *
 * Official SDK for verifying RealStamp credentials, querying revocations and
 * impersonation claims, and subscribing to webhook events.
 *
 * Quickstart:
 *
 *   import { RealStampClient } from '@realstamp/verify';
 *
 *   const client = new RealStampClient();
 *   const result = await client.verifyStamp({ shareLinkId: 'abc123def456' });
 *   if (result.valid) console.log('verified');
 *   if (result.isRevoked) console.log('revoked:', result.revocationReason);
 *
 * For webhook signature verification, import from the dedicated sub-path:
 *
 *   import { verifyWebhookSignature, parseWebhookPayload } from '@realstamp/verify/webhooks';
 *
 * Source: https://github.com/emiliacarp/realstamp-sdk
 * Docs:   https://realstamp.app/docs/revocations-api
 * Apache-2.0
 */

export { RealStampClient } from './client.js';
export type { VerifyInput } from './client.js';
export { RealStampError, isRealStampError } from './errors.js';
export {
  verifyWebhookSignature,
  parseWebhookPayload,
} from './webhooks.js';
export type {
  AttestationState,
  ClientOptions,
  ContentType,
  CurrentStatus,
  Disclosure,
  EventType,
  ImpersonationClaim,
  ImpersonationClaimStatus,
  ImpersonationClaimType,
  ImpersonationClaimWebhookEvent,
  LegacyTokenVerifyResult,
  PublicStamp,
  RevocationListItem,
  RevocationReason,
  RevocationStatus,
  RevocationWebhookEvent,
  SdJwtPayload,
  SdJwtVerifyResult,
  ShareLinkVerifyResult,
  StampStatus,
  SubscribeOptions,
  SubscriptionResponse,
  TrustContext,
  VerificationMethod,
  VerifyResult,
  WebhookEvent,
} from './types.js';
