/**
 * snake_case → camelCase normalizers for API responses. Keeps the public type
 * surface clean and shields consumers from server-side naming churn.
 */

import type {
  AttestationState,
  ContentType,
  CurrentStatus,
  Disclosure,
  ImpersonationClaim,
  ImpersonationClaimStatus,
  ImpersonationClaimType,
  LegacyTokenVerifyResult,
  PublicStamp,
  RevocationListItem,
  RevocationReason,
  RevocationStatus,
  SdJwtPayload,
  SdJwtVerifyResult,
  ShareLinkVerifyResult,
  StampStatus,
  SubscriptionResponse,
  TrustContext,
  VerifyResult,
  EventType,
} from './types.js';

type Json = Record<string, unknown>;

export interface RawVerifyResponse {
  valid?: boolean;
  crypto_verified?: boolean;
  is_revoked?: boolean;
  verification_method?: 'sd_jwt' | 'share_link_lookup' | 'legacy_token_lookup';
  strict_rekor?: boolean;
  current_status?: {
    status?: StampStatus;
    attestation_state?: AttestationState;
    dispute_count?: number;
    revocation_reason?: RevocationReason | null;
    revoked_at?: string | null;
  } | null;
  revocation_reason?: RevocationReason | null;
  revoked_at?: string | null;
  reason?: string;
  authenticated_via?: string;
  kid?: string;
  payload?: Json;
  disclosures?: Json[];
  stamp?: Json;
  trust_context?: Json;
}

export function normalizeVerifyResponse(raw: RawVerifyResponse): VerifyResult {
  const verificationMethod = raw.verification_method ?? 'sd_jwt';
  const base = {
    valid: raw.valid === true,
    cryptoVerified: raw.crypto_verified === true,
    isRevoked: raw.is_revoked === true,
    strictRekor: raw.strict_rekor === true,
    currentStatus: normalizeCurrentStatus(raw.current_status),
    revocationReason: raw.revocation_reason ?? null,
    revokedAt: raw.revoked_at ?? null,
    reason: raw.reason,
    authenticatedVia: raw.authenticated_via,
  };

  if (verificationMethod === 'sd_jwt') {
    return {
      ...base,
      verificationMethod: 'sd_jwt',
      kid: raw.kid,
      payload: raw.payload ? normalizeSdJwtPayload(raw.payload) : undefined,
      disclosures: raw.disclosures ? raw.disclosures.map(normalizeDisclosure) : undefined,
    } satisfies SdJwtVerifyResult;
  }

  if (verificationMethod === 'share_link_lookup') {
    return {
      ...base,
      verificationMethod: 'share_link_lookup',
      stamp: raw.stamp ? normalizePublicStamp(raw.stamp) : undefined,
      trustContext: raw.trust_context ? normalizeTrustContext(raw.trust_context) : undefined,
    } satisfies ShareLinkVerifyResult;
  }

  return {
    ...base,
    verificationMethod: 'legacy_token_lookup',
    stamp: raw.stamp ? normalizePublicStamp(raw.stamp) : undefined,
    trustContext: raw.trust_context ? normalizeTrustContext(raw.trust_context) : undefined,
  } satisfies LegacyTokenVerifyResult;
}

function normalizeCurrentStatus(
  raw: RawVerifyResponse['current_status'] | undefined,
): CurrentStatus | null {
  if (!raw) return null;
  return {
    status: (raw.status ?? 'active') as StampStatus,
    attestationState: (raw.attestation_state ?? 'single_signed') as AttestationState,
    disputeCount: raw.dispute_count ?? 0,
    revocationReason: (raw.revocation_reason ?? null) as RevocationReason | null,
    revokedAt: raw.revoked_at ?? null,
  };
}

function normalizeSdJwtPayload(raw: Json): SdJwtPayload {
  const sd = (raw['_sd'] as string[] | undefined) ?? [];
  const sdAlg = (raw['_sd_alg'] as 'sha-256' | undefined) ?? 'sha-256';
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _sd, _sd_alg, stamp_id, content_hash, is_verified, attestation_state, cosigner_count_signed, require_cosigners, ...rest } = raw;
  return {
    iss: rest.iss as string,
    iat: rest.iat as number,
    exp: rest.exp as number,
    stampId: (stamp_id ?? rest['stampId']) as string,
    contentHash: (content_hash ?? rest['contentHash']) as string,
    isVerified: (is_verified ?? rest['isVerified']) as boolean,
    status: (rest.status ?? 'active') as StampStatus,
    attestationState: (attestation_state ?? 'single_signed') as AttestationState,
    cosignerCountSigned: (cosigner_count_signed ?? 0) as number,
    requireCosigners: (require_cosigners ?? 0) as number,
    sdAlg,
    sdHashes: sd,
    ...rest,
  };
}

function normalizeDisclosure(raw: Json): Disclosure {
  return {
    key: (raw['key'] ?? '') as string,
    value: raw['value'],
    salt: (raw['salt'] ?? '') as string,
    hash: (raw['hash'] ?? '') as string,
    raw: (raw['raw'] ?? raw['disclosure'] ?? '') as string,
  };
}

function normalizePublicStamp(raw: Json): PublicStamp {
  const metadataRaw = raw['metadata'] as Json | null | undefined;
  return {
    id: raw['id'] as string,
    pulseToken: raw['pulse_token'] as string,
    contentHash: raw['content_hash'] as string,
    contentType: raw['content_type'] as ContentType,
    status: raw['status'] as StampStatus,
    attestationState: raw['attestation_state'] as AttestationState,
    anchorId: (raw['anchor_id'] as string | null) ?? null,
    createdAt: raw['created_at'] as string,
    expiresAt: (raw['expires_at'] as string | null) ?? null,
    aiPercentage: (raw['ai_percentage'] as number | null) ?? null,
    chainIndex: (raw['chain_index'] as number) ?? 0,
    c2paManifestUrl: (raw['c2pa_manifest_url'] as string | null) ?? null,
    shareLinkId: (raw['share_link_id'] as string | null) ?? null,
    webauthnVerified: (raw['webauthn_verified'] as boolean) ?? false,
    isPublicOnProfile: (raw['is_public_on_profile'] as boolean) ?? false,
    disputeCount: (raw['dispute_count'] as number) ?? 0,
    revocationReason: (raw['revocation_reason'] as RevocationReason | null) ?? null,
    revokedAt: (raw['revoked_at'] as string | null) ?? null,
    prevHash: (raw['prev_hash'] as string | null) ?? null,
    metadata: metadataRaw
      ? {
          fileName: (metadataRaw['file_name'] as string | null) ?? null,
          fileSize: (metadataRaw['file_size'] as number | null) ?? null,
        }
      : null,
  };
}

function normalizeTrustContext(raw: Json): TrustContext {
  return {
    stampId: raw['stamp_id'] as string,
    creatorUserId: raw['creator_user_id'] as string,
    creatorTrustScore: (raw['creator_trust_score'] as number | null) ?? null,
    status: raw['status'] as StampStatus,
    disputeCount: (raw['dispute_count'] as number) ?? 0,
    anchorRekorUrl: (raw['anchor_rekor_url'] as string | null) ?? null,
    c2paManifestUrl: (raw['c2pa_manifest_url'] as string | null) ?? null,
    aiPercentage: (raw['ai_percentage'] as number | null) ?? null,
    contentHash: raw['content_hash'] as string,
    chainIndex: raw['chain_index'] as number,
    createdAt: raw['created_at'] as string,
  };
}

export function normalizeRevocationListItem(raw: Json): RevocationListItem {
  return {
    stampId: raw['stamp_id'] as string,
    shareLinkId: (raw['share_link_id'] as string | null) ?? null,
    contentType: raw['content_type'] as ContentType,
    revocationReason: raw['revocation_reason'] as RevocationReason,
    revokedAt: raw['revoked_at'] as string,
  };
}

export function normalizeRevocationStatus(raw: Json): RevocationStatus {
  const out: RevocationStatus = {
    stampId: raw['stamp_id'] as string,
    status: raw['status'] as StampStatus,
  };
  if (raw['revocation_reason']) out.revocationReason = raw['revocation_reason'] as RevocationReason;
  if (raw['revoked_at']) out.revokedAt = raw['revoked_at'] as string;
  return out;
}

export function normalizeImpersonationClaim(raw: Json): ImpersonationClaim {
  return {
    id: raw['id'] as string,
    accusedUrl: raw['accused_url'] as string,
    accusedPlatform: raw['accused_platform'] as string,
    claimType: raw['claim_type'] as ImpersonationClaimType,
    claimNote: (raw['claim_note'] as string | null) ?? null,
    status: raw['status'] as ImpersonationClaimStatus,
    claimantDisplayName: (raw['claimant_display_name'] as string) ?? '',
    claimantVerified: (raw['claimant_verified'] as boolean) ?? false,
    claimantActiveCount: (raw['claimant_active_count'] as number) ?? 0,
    claimantRescindedCount: (raw['claimant_rescinded_count'] as number) ?? 0,
    anchorRekorIndex: (raw['anchor_rekor_index'] as number | null) ?? null,
    anchorRekorUuid: (raw['anchor_rekor_uuid'] as string | null) ?? null,
    anchoredAt: (raw['anchored_at'] as string | null) ?? null,
    rescindedAt: (raw['rescinded_at'] as string | null) ?? null,
    createdAt: raw['created_at'] as string,
  };
}

export function normalizeSubscription(raw: Json): SubscriptionResponse {
  return {
    id: raw['id'] as string,
    webhookSecret: raw['webhook_secret'] as string,
    webhookUrl: raw['webhook_url'] as string,
    label: raw['label'] as string | undefined,
    eventTypes: (raw['event_types'] as EventType[]) ?? ['revocation'],
    createdAt: raw['created_at'] as string,
  };
}
