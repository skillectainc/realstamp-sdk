/**
 * Cross-runtime utilities: base64url encoding, HMAC-SHA256 signing/verification,
 * SHA-256 hashing, and constant-time string comparison.
 *
 * Uses WebCrypto (globalThis.crypto.subtle), available in Node 20+, all modern
 * browsers, Deno, Bun, and Cloudflare Workers. No runtime dependencies.
 */

const textEncoder = new TextEncoder();

function getSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      '@realstamp/verify: globalThis.crypto.subtle is not available. ' +
        'Node 20+, modern browsers, Deno, Bun, and Cloudflare Workers are supported.',
    );
  }
  return subtle;
}

/** Encode raw bytes (or a string) as base64url, without padding. */
export function toBase64Url(input: Uint8Array | string): string {
  const bytes =
    typeof input === 'string' ? textEncoder.encode(input) : input;
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] as number);
  }
  const b64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(binary, 'binary').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decode a base64url string into raw bytes. Handles unpadded input. */
export function fromBase64Url(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const b64 = normalized + pad;
  const binary =
    typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Compute SHA-256 digest of a string, returned as lowercase hex. */
export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const data = typeof input === 'string' ? textEncoder.encode(input) : input;
  const subtle = getSubtle();
  const digest = await subtle.digest('SHA-256', data as BufferSource);
  return bytesToHex(new Uint8Array(digest));
}

/** Compute HMAC-SHA256 of a payload, returned as lowercase hex. */
export async function hmacSha256Hex(secret: string, payload: string | Uint8Array): Promise<string> {
  const subtle = getSubtle();
  const keyBytes = textEncoder.encode(secret);
  const dataBytes = typeof payload === 'string' ? textEncoder.encode(payload) : payload;
  const key = await subtle.importKey(
    'raw',
    keyBytes as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await subtle.sign('HMAC', key, dataBytes as BufferSource);
  return bytesToHex(new Uint8Array(signature));
}

/** Convert a Uint8Array to a lowercase hex string. */
export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] as number;
    out += (b < 16 ? '0' : '') + b.toString(16);
  }
  return out;
}

/** Convert a hex string to a Uint8Array. Throws on invalid input. */
export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex: odd length');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    const byte = Number.parseInt(hex.slice(i, i + 2), 16);
    if (Number.isNaN(byte)) throw new Error(`Invalid hex character at position ${i}`);
    out[i / 2] = byte;
  }
  return out;
}

/**
 * Constant-time string equality. Returns true only if both strings are the same
 * length and every character matches. Designed to resist timing side channels.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Decode the middle segment of an SD-JWT (the payload) without verifying the
 * signature. Use only for inspecting public claims; never trust untrusted
 * payloads for security decisions.
 */
export function decodeSdJwtPayload(sdJwt: string): Record<string, unknown> | null {
  // SD-JWT format: <header>.<payload>.<signature>~<disclosure>~...
  const head = sdJwt.split('~', 1)[0];
  if (!head) return null;
  const parts = head.split('.');
  if (parts.length !== 3) return null;
  try {
    const payloadBytes = fromBase64Url(parts[1] as string);
    const json = new TextDecoder().decode(payloadBytes);
    const obj = JSON.parse(json);
    return typeof obj === 'object' && obj !== null ? (obj as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
