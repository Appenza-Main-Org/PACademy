namespace PACademy.Shared.Contracts;

/// <summary>
/// Cross-module error-code registry. Every code is a stable English identifier that the SPA's i18n
/// layer maps to an Arabic message. Codes never change once shipped — adding a code is non-breaking;
/// renaming one is breaking and forces a coordinated frontend update.
/// </summary>
public static class ErrorCodes
{
    // ── Auth (spec 003) ──────────────────────────────────────────────────────
    public const string InvalidCredentials = "INVALID_CREDENTIALS";
    public const string CsrfInvalid = "CSRF_INVALID";
    public const string SessionExpired = "SESSION_EXPIRED";

    // ── Reference data (spec 004 FR-L) ───────────────────────────────────────
    public const string ReferenceKeyTaken = "REFERENCE_KEY_TAKEN";
    public const string ReferenceInUse = "REFERENCE_IN_USE";

    // ── Cycles (spec 004 FR-Y) ───────────────────────────────────────────────
    public const string InvalidCycleTransition = "INVALID_CYCLE_TRANSITION";
    public const string OverlappingActiveCycle = "OVERLAPPING_ACTIVE_CYCLE";
    public const string CycleHasApplicants = "CYCLE_HAS_APPLICANTS";
    public const string CycleClosed = "CYCLE_CLOSED";

    // ── Categories (spec 004 FR-K) ───────────────────────────────────────────
    public const string InvalidCategoryKey = "INVALID_CATEGORY_KEY";
    public const string CategoryKeyTaken = "CATEGORY_KEY_TAKEN";
    public const string CategoryIsSpec = "CATEGORY_IS_SPEC";
    public const string StaleAffectedCount = "STALE_AFFECTED_COUNT";

    // ── Admission rules (spec 004 FR-R) ──────────────────────────────────────
    public const string AdmissionRulesImmutable = "ADMISSION_RULES_IMMUTABLE";

    // ── Workflows (spec 004 FR-W) ────────────────────────────────────────────
    public const string WorkflowInUse = "WORKFLOW_IN_USE";
    public const string WorkflowInvalidStageOrder = "WORKFLOW_INVALID_STAGE_ORDER";

    // ── Cross-module (phase 5 — new) ─────────────────────────────────────────
    public const string ModuleBoundaryViolation = "MODULE_BOUNDARY_VIOLATION";
    public const string CrossModuleTransactionFailed = "CROSS_MODULE_TRANSACTION_FAILED";
}
