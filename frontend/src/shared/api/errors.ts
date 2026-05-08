/** Typed error returned by every apiClient response interceptor rejection. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Normalise any caught value into a typed ApiError. */
export function normaliseError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;

  if (
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    typeof (err as { response?: unknown }).response === 'object'
  ) {
    const res = (err as { response: { status?: unknown; data?: { code?: unknown; message?: unknown; errors?: unknown } } }).response;
    const status = typeof res.status === 'number' ? res.status : 0;
    const data = res.data ?? {};
    const code = typeof data.code === 'string' ? data.code : 'UNKNOWN';
    const message = typeof data.message === 'string' ? data.message : String(err);
    const fieldErrors =
      typeof data.errors === 'object' && data.errors !== null
        ? (data.errors as Record<string, string[]>)
        : {};
    return new ApiError(status, code, message, fieldErrors);
  }

  const message = err instanceof Error ? err.message : String(err);
  return new ApiError(0, 'CLIENT_ERROR', message);
}
