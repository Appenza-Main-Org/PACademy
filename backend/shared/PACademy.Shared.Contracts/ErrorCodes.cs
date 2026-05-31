namespace PACademy.Shared.Contracts;

/// <summary>
/// Single source of truth for typed error codes. String constants (not enums)
/// so they're immutable on the wire — the frontend already throws / matches
/// against these exact strings via <c>ConflictError</c> envelopes.
///
/// Never rename a constant after it ships; add new ones instead.
/// </summary>
public static class ErrorCodes
{
    // ── Shared / generic ────────────────────────────────────────────────
    public const string Conflict                = "CONFLICT";
    public const string DependencyBlocked       = "DEPENDENCY_BLOCKED";
    public const string ValidationFailed        = "VALIDATION_FAILED";
    public const string NotFound                = "NOT_FOUND";
    public const string Forbidden               = "FORBIDDEN";
    public const string InternalError           = "INTERNAL_ERROR";
    public const string ModuleBoundaryViolation = "MODULE_BOUNDARY_VIOLATION";

    // ── Auth ────────────────────────────────────────────────────────────
    public const string AccountLocked      = "ACCOUNT_LOCKED";
    public const string OtpMismatch        = "OTP_MISMATCH";
    public const string OtpExpired         = "OTP_EXPIRED";
    public const string OtpReused          = "OTP_REUSED";
    public const string InvalidCredentials = "INVALID_CREDENTIALS";

    // ── Admission cycles ────────────────────────────────────────────────
    public const string ActiveCycleExists         = "ACTIVE_CYCLE_EXISTS";
    public const string OverlappingActiveCycle    = "OVERLAPPING_ACTIVE_CYCLE";
    public const string NoActiveCycle             = "NO_ACTIVE_CYCLE";
    public const string CycleActivationIncomplete = "CYCLE_ACTIVATION_INCOMPLETE";

    // ── Applicants ──────────────────────────────────────────────────────
    public const string NidCycleDuplicate         = "NID_CYCLE_DUPLICATE";
    public const string GradeNidCycleDuplicate    = "GRADE_NID_CYCLE_DUPLICATE";
    public const string ApplicantIdentityMismatch = "APPLICANT_IDENTITY_MISMATCH";
    public const string DraftVersionConflict      = "DRAFT_VERSION_CONFLICT";

    // ── Committees / exams ──────────────────────────────────────────────
    public const string CommitteeAtCapacity = "COMMITTEE_AT_CAPACITY";
    public const string ExamOrderDuplicate  = "EXAM_ORDER_DUPLICATE";

    // ── Lookups ─────────────────────────────────────────────────────────
    public const string LookupCodeDuplicate = "LOOKUP_CODE_DUPLICATE";
    public const string LookupKeyUnknown    = "LOOKUP_KEY_UNKNOWN";
    public const string DuplicateCode       = "DUPLICATE_CODE";
    public const string InUse               = "IN_USE";

    // ── Data Exchange (تبادل البيانات) ──────────────────────────────────
    public const string DataExchangeUnknownDomain   = "DATA_EXCHANGE_UNKNOWN_DOMAIN";
    public const string DataExchangeInvalidWorkbook = "DATA_EXCHANGE_INVALID_WORKBOOK";
    public const string DataExchangeKeyDuplicate    = "DATA_EXCHANGE_KEY_DUPLICATE";
    public const string DataExchangeRowOutdated     = "DATA_EXCHANGE_ROW_OUTDATED";
    public const string DataExchangeVersionConflict = "DATA_EXCHANGE_VERSION_CONFLICT";
}
