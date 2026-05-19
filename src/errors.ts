/**
 * Typed error thrown by RealStampClient methods on any non-successful response
 * or transport failure. Always inspect `code` first; `payload` carries the raw
 * server response when available for advanced debugging.
 */
export class RealStampError extends Error {
  public readonly code: string;
  public readonly status?: number;
  public readonly payload?: unknown;

  constructor(code: string, message: string, opts: { status?: number; payload?: unknown } = {}) {
    super(message);
    this.name = 'RealStampError';
    this.code = code;
    if (opts.status !== undefined) this.status = opts.status;
    if (opts.payload !== undefined) this.payload = opts.payload;
  }
}

/** Type guard for RealStampError. */
export function isRealStampError(err: unknown): err is RealStampError {
  return err instanceof RealStampError;
}
