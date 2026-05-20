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
  | 'PUBLISH_NOT_ALLOWED'
  // Lookup Management Module — see docs/DB_CONSTRAINTS.md §10.
  | 'CIRCULAR_HIERARCHY'
  | 'PARENT_HAS_CHILDREN'
  | 'SELF_PARENT'
  | 'DUPLICATE_CODE'
  | 'DUPLICATE_MAPPING'
  | 'INVALID_DATE_RANGE'
  | 'IN_USE'
  // Admission Setup — Application Settings (global master data).
  // See docs/DB_CONSTRAINTS.md §11.
  | 'DUPLICATE_YEAR'
  | 'OVERLAPPING_PERIOD'
  | 'AGE_NOT_POSITIVE'
  | 'AGE_RANGE_INVALID'
  | 'AGE_REFERENCE_AFTER_START'
  | 'PERCENTAGE_OUT_OF_RANGE'
  | 'GRADE_MODE_MISMATCH'
  | 'GENDER_REQUIRED'
  | 'GRAD_YEAR_REQUIRED'
  | 'SPECIALIZATION_NOT_MAPPED'
  | 'CATEGORY_HAS_ACTIVE_YEARS'
  // Admission Setup — Exam Schedule (per-category calendar).
  // See docs/DB_CONSTRAINTS.md §12.
  | 'DUPLICATE_DATE'
  | 'DATE_OUT_OF_CYCLE_WINDOW'
  | 'CATEGORY_NOT_ACTIVE'
  // Admission Setup — Committee × Day Bindings.
  // See docs/DB_CONSTRAINTS.md §13. Note: PERCENTAGE_OUT_OF_RANGE is
  // re-used (already in this union under §11).
  | 'DUPLICATE_BINDING'
  | 'CAPACITY_NOT_POSITIVE'
  | 'GRADE_RANGE_INVERTED'
  | 'TAGDIR_GRADE_NOT_FOUND'
  | 'MODE_MISMATCH'
  | 'DAY_NOT_WORKING'
  | 'COMMITTEE_WRONG_CATEGORY'
  // Committee instances — `/admin/committees` and the wizard committees step.
  | 'COMMITTEE_INSTANCE_DUPLICATE'
  | 'COMMITTEE_INSTANCE_HAS_BOOKINGS'
  | 'COMMITTEE_INSTANCE_DAY_PASSED'
  // Transfer-day reservation flow — destination doesn't have enough free
  // seats to absorb the incoming reservation. Payload lists every (committee,
  // category) row that fails so the UI can render the capacity-bump popup.
  | 'RESERVATIONS_OVER_DESTINATION_CAPACITY';

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

/** Account-inactive error — admin-create NID flow. Thrown by `authService.login`
 *  when the resolved user has `accountStatus = 'inactive'`. */
export class AccountInactiveError extends Error {
  readonly code = 'ACCOUNT_INACTIVE' as const;
  constructor(public readonly userId: string, message?: string) {
    super(message ?? 'الحساب غير نشط. تواصل مع إدارة المنظومة لإعادة التفعيل.');
    this.name = 'AccountInactiveError';
  }
}

export function isAccountInactiveError(err: unknown): err is AccountInactiveError {
  return err instanceof AccountInactiveError;
}

/** Self-deactivation guard error — admin-create NID flow. Thrown by
 *  `usersService.setAccountStatus` when an actor attempts to deactivate
 *  their own account or the last super_admin. */
export class StatusChangeBlockedError extends Error {
  readonly code = 'STATUS_CHANGE_BLOCKED' as const;
  constructor(
    public readonly reason: 'self_deactivation' | 'last_super_admin',
    message?: string,
  ) {
    super(message ?? 'تعذّر تغيير حالة الحساب');
    this.name = 'StatusChangeBlockedError';
  }
}

export function isStatusChangeBlockedError(err: unknown): err is StatusChangeBlockedError {
  return err instanceof StatusChangeBlockedError;
}
