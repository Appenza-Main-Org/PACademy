/**
 * Thrown when the server returns HTTP 409 with a ROW_VERSION_CONFLICT body.
 * The client should refetch the entity and surface a diff to the user.
 */
export class RowVersionConflictError extends Error {
  readonly code = 'ROW_VERSION_CONFLICT' as const;

  constructor(
    public readonly entityType: string,
    public readonly entityId: string,
    public readonly currentRowVersion: string,
    public readonly messageAr: string,
    public readonly messageEn: string,
  ) {
    super(messageEn);
    this.name = 'RowVersionConflictError';
  }
}

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

/** Normalise any caught value into a typed ApiError or RowVersionConflictError. */
export function normaliseError(err: unknown): ApiError | RowVersionConflictError {
  if (err instanceof RowVersionConflictError) return err;
  if (err instanceof ApiError) return err;

  if (
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    typeof (err as { response?: unknown }).response === 'object'
  ) {
    const res = (err as { response: { status?: unknown; data?: { code?: unknown; messageAr?: unknown; messageEn?: unknown; message?: unknown; errors?: unknown; currentRowVersion?: unknown; entityType?: unknown; entityId?: unknown } } }).response;
    const status = typeof res.status === 'number' ? res.status : 0;
    const data = res.data ?? {};
    const code = typeof data.code === 'string' ? data.code : 'UNKNOWN';

    if (status === 409 && code === 'ROW_VERSION_CONFLICT') {
      return new RowVersionConflictError(
        typeof data.entityType === 'string' ? data.entityType : 'Unknown',
        typeof data.entityId === 'string' ? data.entityId : '',
        typeof data.currentRowVersion === 'string' ? data.currentRowVersion : '',
        typeof data.messageAr === 'string' ? data.messageAr : 'تم التعديل من قبل مستخدم آخر',
        typeof data.messageEn === 'string' ? data.messageEn : 'Conflict: record modified by another user.',
      );
    }

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
