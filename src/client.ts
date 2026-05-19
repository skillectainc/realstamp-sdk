/**
 * RealStampClient — primary entry point for verifying RealStamp credentials,
 * querying revocation and impersonation feeds, and managing webhook subscriptions.
 */

import { RealStampError } from './errors.js';
import {
  normalizeImpersonationClaim,
  normalizeRevocationListItem,
  normalizeRevocationStatus,
  normalizeSubscription,
  normalizeVerifyResponse,
  type RawVerifyResponse,
} from './normalize.js';
import type {
  ClientOptions,
  ImpersonationClaim,
  ImpersonationClaimStatus,
  RevocationListItem,
  RevocationStatus,
  SubscribeOptions,
  SubscriptionResponse,
  VerifyResult,
} from './types.js';

// Default points at the Supabase project that serves the RealStamp Edge Functions.
// Once api.realstamp.app is configured as a clean branded host, this default
// will shift in a future release. Override with `new RealStampClient({ baseUrl })`.
const DEFAULT_BASE_URL = 'https://hldoychlnejsmxvuxsri.supabase.co';
const DEFAULT_TIMEOUT_MS = 10_000;

export type VerifyInput =
  | { sdJwt: string }
  | { shareLinkId: string }
  | { pulseToken: string };

export class RealStampClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly defaultApiKey?: string;
  private readonly defaultAccessToken?: string;
  private readonly defaultTimeoutMs: number;
  private readonly defaultHeaders: Record<string, string>;

  constructor(opts: ClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    const f = opts.fetch ?? globalThis.fetch;
    if (!f) {
      throw new Error(
        '@realstamp/verify: globalThis.fetch is not available. Pass `opts.fetch` ' +
          'when constructing the client on environments without native fetch.',
      );
    }
    this.fetcher = f;
    if (opts.apiKey) this.defaultApiKey = opts.apiKey;
    if (opts.accessToken) this.defaultAccessToken = opts.accessToken;
    this.defaultTimeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.defaultHeaders = { ...opts.headers };
  }

  /**
   * Verify a RealStamp credential. Pass exactly one of `sdJwt`, `shareLinkId`,
   * or `pulseToken`. The returned `VerifyResult` is a discriminated union on
   * `verificationMethod`; check `result.valid` for the trust verdict.
   */
  async verifyStamp(
    input: VerifyInput,
    opts: { strictRekor?: boolean; apiKey?: string; signal?: AbortSignal } = {},
  ): Promise<VerifyResult> {
    const body: Record<string, string> = {};
    if ('sdJwt' in input) body['sd_jwt'] = input.sdJwt;
    else if ('shareLinkId' in input) body['share_link_id'] = input.shareLinkId;
    else if ('pulseToken' in input) body['pulse_token'] = input.pulseToken;
    else throw new Error('verifyStamp: input must include sdJwt, shareLinkId, or pulseToken');

    const url = `${this.baseUrl}/functions/v1/api-verify${opts.strictRekor ? '?strict_rekor=true' : ''}`;
    const raw = await this.fetchJson<RawVerifyResponse>(url, {
      method: 'POST',
      body: JSON.stringify(body),
      apiKey: opts.apiKey,
      signal: opts.signal,
    });
    return normalizeVerifyResponse(raw);
  }

  /**
   * Recent revocations across the platform, newest first.
   */
  async getRecentRevocations(
    opts: { limit?: number; since?: string; signal?: AbortSignal } = {},
  ): Promise<{ revocations: RevocationListItem[]; cursor?: string }> {
    const params = new URLSearchParams();
    if (opts.limit !== undefined) params.set('limit', String(opts.limit));
    if (opts.since) params.set('since', opts.since);
    const qs = params.toString();
    const url = `${this.baseUrl}/functions/v1/revocations-api/recent${qs ? '?' + qs : ''}`;
    const raw = await this.fetchJson<{
      revocations: Array<Record<string, unknown>>;
      cursor?: string;
    }>(url, { signal: opts.signal });
    return {
      revocations: (raw.revocations ?? []).map(normalizeRevocationListItem),
      cursor: raw.cursor,
    };
  }

  /** Current revocation status of a single stamp by ID. */
  async getRevocationStatus(
    stampId: string,
    opts: { signal?: AbortSignal } = {},
  ): Promise<RevocationStatus> {
    const url = `${this.baseUrl}/functions/v1/revocations-api/status/${encodeURIComponent(stampId)}`;
    const raw = await this.fetchJson<Record<string, unknown>>(url, { signal: opts.signal });
    return normalizeRevocationStatus(raw);
  }

  /** Recent impersonation claims across the platform, newest first. */
  async getRecentImpersonationClaims(
    opts: {
      limit?: number;
      since?: string;
      status?: ImpersonationClaimStatus | 'all';
      signal?: AbortSignal;
    } = {},
  ): Promise<{ claims: ImpersonationClaim[]; cursor?: string }> {
    const params = new URLSearchParams();
    if (opts.limit !== undefined) params.set('limit', String(opts.limit));
    if (opts.since) params.set('since', opts.since);
    if (opts.status) params.set('status', opts.status);
    const qs = params.toString();
    const url = `${this.baseUrl}/functions/v1/impersonation-api/recent${qs ? '?' + qs : ''}`;
    const raw = await this.fetchJson<{
      claims: Array<Record<string, unknown>>;
      cursor?: string;
    }>(url, { signal: opts.signal });
    return {
      claims: (raw.claims ?? []).map(normalizeImpersonationClaim),
      cursor: raw.cursor,
    };
  }

  /** Get a single impersonation claim by ID. */
  async getImpersonationClaim(
    claimId: string,
    opts: { signal?: AbortSignal } = {},
  ): Promise<ImpersonationClaim> {
    const url = `${this.baseUrl}/functions/v1/impersonation-api/claim/${encodeURIComponent(claimId)}`;
    const raw = await this.fetchJson<Record<string, unknown>>(url, { signal: opts.signal });
    return normalizeImpersonationClaim(raw);
  }

  /**
   * Subscribe a webhook URL to receive event broadcasts (revocations,
   * impersonation claims, or both). The returned `webhookSecret` is shown ONCE
   * and must be stored securely — it cannot be retrieved later. Use it with
   * `verifyWebhookSignature` (from `@realstamp/verify/webhooks`) to validate
   * incoming webhook payloads.
   */
  async subscribeToEvents(
    opts: SubscribeOptions,
    auth: { accessToken: string },
    requestOpts: { signal?: AbortSignal } = {},
  ): Promise<SubscriptionResponse> {
    const body: Record<string, unknown> = {
      webhook_url: opts.webhookUrl,
      event_types: opts.eventTypes ?? ['revocation'],
    };
    if (opts.label !== undefined) body['label'] = opts.label;
    const wantsImpersonation = (opts.eventTypes ?? ['revocation']).includes('impersonation_claim');
    const endpoint = wantsImpersonation
      ? '/functions/v1/impersonation-api/subscribe'
      : '/functions/v1/revocations-api/subscribe';
    const raw = await this.fetchJson<Record<string, unknown>>(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      body: JSON.stringify(body),
      accessToken: auth.accessToken,
      signal: requestOpts.signal,
    });
    return normalizeSubscription(raw);
  }

  /** Cancel a webhook subscription by ID. */
  async unsubscribeFromEvents(
    subscriptionId: string,
    auth: { accessToken: string },
    requestOpts: { signal?: AbortSignal } = {},
  ): Promise<void> {
    const url = `${this.baseUrl}/functions/v1/revocations-api/subscribe/${encodeURIComponent(subscriptionId)}`;
    await this.fetchJson<void>(url, {
      method: 'DELETE',
      accessToken: auth.accessToken,
      allow204: true,
      signal: requestOpts.signal,
    });
  }

  private async fetchJson<T>(
    url: string,
    opts: {
      method?: string;
      body?: string;
      apiKey?: string;
      accessToken?: string;
      allow204?: boolean;
      signal?: AbortSignal;
    } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...this.defaultHeaders,
    };
    const apiKey = opts.apiKey ?? this.defaultApiKey;
    const accessToken = opts.accessToken ?? this.defaultAccessToken;
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    else if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.defaultTimeoutMs);
    const signal = opts.signal
      ? mergeSignals(controller.signal, opts.signal)
      : controller.signal;

    let response: Response;
    try {
      const requestInit: RequestInit = {
        method: opts.method ?? 'GET',
        headers,
        signal,
      };
      if (opts.body !== undefined) requestInit.body = opts.body;
      response = await this.fetcher(url, requestInit);
    } catch (err) {
      const isAbort =
        err instanceof Error &&
        (err.name === 'AbortError' || /aborted|timeout/i.test(err.message));
      throw new RealStampError(
        isAbort ? 'request_timeout' : 'network_error',
        `Request to ${url} failed: ${(err as Error).message}`,
      );
    } finally {
      clearTimeout(timer);
    }

    if (opts.allow204 && response.status === 204) return undefined as T;

    const text = await response.text();
    let parsed: unknown = undefined;
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new RealStampError(
          'malformed_response',
          `Could not parse JSON from ${url} (status ${response.status})`,
          { status: response.status, payload: text },
        );
      }
    }

    if (!response.ok) {
      const code =
        (parsed && typeof parsed === 'object' && 'error' in parsed
          ? String((parsed as { error: unknown }).error)
          : null) ?? `http_${response.status}`;
      throw new RealStampError(code, `Request failed: ${code}`, {
        status: response.status,
        payload: parsed,
      });
    }

    return parsed as T;
  }
}

function mergeSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  if (a.aborted) return a;
  if (b.aborted) return b;
  const controller = new AbortController();
  const onAbort = (which: AbortSignal) => {
    controller.abort(which.reason);
  };
  a.addEventListener('abort', () => onAbort(a), { once: true });
  b.addEventListener('abort', () => onAbort(b), { once: true });
  return controller.signal;
}
