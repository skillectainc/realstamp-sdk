/**
 * @realstamp/verify — Type definitions
 *
 * Mirrors the response shapes of the public RealStamp endpoints:
 *   - POST /functions/v1/api-verify
 *   - GET  /functions/v1/revocations-api/recent
 *   - GET  /functions/v1/revocations-api/status/:stamp_id
 *   - POST /functions/v1/revocations-api/subscribe
 *   - DELETE /functions/v1/revocations-api/subscribe/:id
 *   - GET  /functions/v1/impersonation-api/recent
 *   - GET  /functions/v1/impersonation-api/claim/:id
 *   - POST /functions/v1/impersonation-api/subscribe
 *
 * Public response fields are received in snake_case from the API and exposed
 * to TypeScript consumers in camelCase. The client handles the mapping.
 */

export type StampStatus =
  | 'active'
  | 'disputed'
  | 'withdrawn'
  | 'resolved_valid'
  | 'resolved_invalid';

export type AttestationState =
  | 'single_signed'
  | 'pending_cosigners'
  | 'fully_signed'
  | 'partially_signed';

export type ContentType =
  | 'text'
  | 'email'
  | 'photo'
  | 'video'
  | 'image'
  | 'audio'
  | 'post'
  | 'ai_drafted';

export type RevocationReason =
  | 'voluntary_withdrawal'
  | 'deepfake_impersonation'
  | 'mistaken_attribution'
  | 'content_replacement'
  | 'security_compromise'
  | 'other';

export type ImpersonationClaimType =
  | 'likeness_deepfake'
  | 'voice_clone'
  | 'identity_impersonation'
  | 'misattribution'
  | 'unauthorized_likeness'
  | 'other';

export type ImpersonationClaimStatus =
  | 'active'
  | 'rescinded'
  | 'disputed'
  | 'resolved_valid'
  | 'resolved_invalid';

export type VerificationMethod = 'sd_jwt' | 'share_link_lookup' | 'legacy_token_lookup';
export type EventType = 'revocation' | 'impersonation_claim';

/** Computed live status of a stamp, returned alongside verify responses. */
export interface CurrentStatus {
  status: StampStatus;
  attestationState: AttestationState;
  disputeCount: number;
  revocationReason: RevocationReason | null;
  revokedAt: string | null;
}

interface VerifyResultBase {
  /** True only when the credential is signature-valid AND not revoked. */
  valid: boolean;
  /** True when the signature was cryptographically verified, regardless of revocation. */
  cryptoVerified: boolean;
  /** True when the credential has been retracted by the creator. */
  isRevoked: boolean;
  /** True if Rekor inclusion was strictly checked (opt-in). */
  strictRekor: boolean;
  /** Live DB-backed status; null if the credential could not be looked up. */
  currentStatus: CurrentStatus | null;
  /** Reason the stamp was revoked, when applicable. */
  revocationReason: RevocationReason | null;
  /** Timestamp of revocation in ISO 8601, when applicable. */
  revokedAt: string | null;
  /** Failure reason code, present only when valid is false due to crypto failure. */
  reason?: string;
  /** How the caller authenticated to this endpoint ("anonymous" | "api_key" | "user_jwt"). */
  authenticatedVia?: string;
}

/** Verify result from the SD-JWT lookup path (`sd_jwt` body). */
export interface SdJwtVerifyResult extends VerifyResultBase {
  verificationMethod: 'sd_jwt';
  kid?: string;
  payload?: SdJwtPayload;
  disclosures?: Disclosure[];
}

/** Verify result from the share-link lookup path (`share_link_id` body). */
export interface ShareLinkVerifyResult extends VerifyResultBase {
  verificationMethod: 'share_link_lookup';
  stamp?: PublicStamp;
  trustContext?: TrustContext;
}

/** Verify result from the legacy pulse-token lookup path (`pulse_token` body). */
export interface LegacyTokenVerifyResult extends VerifyResultBase {
  verificationMethod: 'legacy_token_lookup';
  stamp?: PublicStamp;
  trustContext?: TrustContext;
}

export type VerifyResult =
  | SdJwtVerifyResult
  | ShareLinkVerifyResult
  | LegacyTokenVerifyResult;

/** SD-JWT credential payload claims. */
export interface SdJwtPayload {
  iss: string;
  iat: number;
  exp: number;
  stampId: string;
  contentHash: string;
  isVerified: boolean;
  status: StampStatus;
  attestationState: AttestationState;
  cosignerCountSigned: number;
  requireCosigners: number;
  /** Hash algorithm for the selective-disclosure entries. */
  sdAlg: 'sha-256';
  /** Sorted array of base64url-encoded SHA-256 hashes of each disclosure. */
  sdHashes: string[];
  /** Pass-through of any additional selectively-disclosed claim included by the issuer. */
  [k: string]: unknown;
}

/** A disclosed SD-JWT claim revealed at verification time. */
export interface Disclosure {
  key: string;
  value: unknown;
  salt: string;
  hash: string;
  /** The raw base64url-encoded disclosure as it appeared on the wire. */
  raw: string;
}

/** Public projection of a stamp returned by share-link / legacy paths. */
export interface PublicStamp {
  id: string;
  pulseToken: string;
  contentHash: string;
  contentType: ContentType;
  status: StampStatus;
  attestationState: AttestationState;
  anchorId: string | null;
  createdAt: string;
  expiresAt: string | null;
  aiPercentage: number | null;
  chainIndex: number;
  c2paManifestUrl: string | null;
  shareLinkId: string | null;
  webauthnVerified: boolean;
  isPublicOnProfile: boolean;
  disputeCount: number;
  revocationReason: RevocationReason | null;
  revokedAt: string | null;
  prevHash: string | null;
  /** Constrained projection of file metadata; only file_name and file_size are exposed. */
  metadata: { fileName: string | null; fileSize: number | null } | null;
}

export interface TrustContext {
  stampId: string;
  creatorUserId: string;
  creatorTrustScore: number | null;
  status: StampStatus;
  disputeCount: number;
  anchorRekorUrl: string | null;
  c2paManifestUrl: string | null;
  aiPercentage: number | null;
  contentHash: string;
  chainIndex: number;
  createdAt: string;
}

/** Item in the `/revocations-api/recent` feed. */
export interface RevocationListItem {
  stampId: string;
  shareLinkId: string | null;
  contentType: ContentType;
  revocationReason: RevocationReason;
  revokedAt: string;
}

export interface RevocationStatus {
  stampId: string;
  status: StampStatus;
  revocationReason?: RevocationReason;
  revokedAt?: string;
}

/** Public projection of an impersonation claim. */
export interface ImpersonationClaim {
  id: string;
  accusedUrl: string;
  accusedPlatform: string;
  claimType: ImpersonationClaimType;
  claimNote: string | null;
  status: ImpersonationClaimStatus;
  claimantDisplayName: string;
  claimantVerified: boolean;
  claimantActiveCount: number;
  claimantRescindedCount: number;
  anchorRekorIndex: number | null;
  anchorRekorUuid: string | null;
  anchoredAt: string | null;
  rescindedAt: string | null;
  createdAt: string;
}

/** Webhook payload broadcast when a new revocation list version is published. */
export interface RevocationWebhookEvent {
  event_type: 'revocation';
  version: string;
  revocation_list_url: string;
  jws_sha256: string;
  revoked_count: number;
  ts: string;
}

/** Webhook payload broadcast when an impersonation claim is filed or rescinded. */
export interface ImpersonationClaimWebhookEvent {
  event_type: 'impersonation_claim';
  version: string;
  claim_id: string;
  claim_type: ImpersonationClaimType;
  claimant: {
    display_name: string;
    verified_creator_id: string;
    active_claims: number;
    rescinded_claims: number;
  };
  accused: {
    url: string;
    platform: string;
  };
  claim_note_preview: string;
  attestations: {
    good_faith: boolean;
    not_parody: boolean;
    has_authority: boolean;
  };
  anchor: {
    rekor_uuid: string | null;
    rekor_index: number | null;
  };
  filed_at: string;
  status: ImpersonationClaimStatus;
  /**
   * Verbatim legal disclaimer. ALWAYS read this before deciding how to act on
   * a claim. RealStamp delivers signed signals, not verified findings.
   */
  disclaimer: string;
}

export type WebhookEvent = RevocationWebhookEvent | ImpersonationClaimWebhookEvent;

/** Options accepted by `new RealStampClient()`. */
export interface ClientOptions {
  /** Base URL for the RealStamp service. Defaults to `https://realstamp.app`. */
  baseUrl?: string;
  /** Custom fetch implementation. Defaults to `globalThis.fetch`. */
  fetch?: typeof fetch;
  /** Default API key (`rs_live_*`) sent on requests that support API-key auth. */
  apiKey?: string;
  /** Default user access token (Supabase JWT) sent on authenticated requests. */
  accessToken?: string;
  /** Per-request timeout in milliseconds. Defaults to 10000. */
  timeoutMs?: number;
  /** Extra headers merged into every request. */
  headers?: Record<string, string>;
}

export interface SubscribeOptions {
  webhookUrl: string;
  eventTypes?: EventType[];
  label?: string;
}

export interface SubscriptionResponse {
  id: string;
  webhookSecret: string;
  webhookUrl: string;
  label?: string;
  eventTypes: EventType[];
  createdAt: string;
}

export interface RealStampErrorPayload {
  error: string;
  [k: string]: unknown;
}
