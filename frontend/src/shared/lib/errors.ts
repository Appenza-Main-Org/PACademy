/**
 * Typed service errors — Gap F (admin-gaps).
 *
 * Each service that mutates state can throw a typed error so callers branch
 * on `err.code` instead of parsing strings. Real backend will mirror the
 * codes (and richer error envelopes when needed).
 */

export type ConflictCode =
  | 'ACTIVE_CYCLE_EXISTS'
  | 'CYCLE_ACTIVATION_INCOMPLETE'
  | 'EXAM_ORDER_DUPLICATE'
  | 'COMMITTEE_AT_CAPACITY'
  | 'NID_CYCLE_DUPLICATE'
  | 'PUBLISH_NOT_ALLOWED';

/** Generic conflict — a precondition rejected the mutation. */
export class ConflictError<TPayload = unknown> extends Error {
  readonly code = 'CONFLICT' as const;
  readonly conflictCode: ConflictCode;
  readonly payload: TPayload;

  constructor(conflictCode: ConflictCode, payload: TPayload, message?: string) {
    super(message ?? conflictCode);
    this.name = 'ConflictError';
    this.conflictCode = conflictCode;
    this.payload = payload;
  }
}

export function isConflictError(err: unknown): err is ConflictError {
  return err instanceof ConflictError;
}
