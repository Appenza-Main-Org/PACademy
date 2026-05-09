# Contract: `ErrorCodes` registry (Shared.Contracts)

**Project**: `PACademy.Shared.Contracts`
**Source file (target)**: `backend/src/Shared/PACademy.Shared.Contracts/ErrorCodes.cs`
**Consumed by**: every module's exception path + the SPA's error-mapping table

```csharp
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
```

## Companion type — `ApiError`

```csharp
namespace PACademy.Shared.Contracts;

/// <summary>
/// Cross-module problem-details shape. Every error response from any module's controllers
/// serialises to this. Inspired by RFC 7807 but tailored to the platform.
/// </summary>
public sealed record ApiError(
    string Code,
    string Message,
    int Status,
    IReadOnlyDictionary<string, IReadOnlyList<string>>? Errors = null,
    string? Detail = null);
```

## Versioning policy

- **Adding** a code is non-breaking (frontend may map to a generic error fallback until it adds the entry).
- **Renaming** a code is breaking and requires a coordinated PR that updates both backend constants AND the SPA's `frontend/src/shared/api/errors.ts` mapping in the same merge.
- **Removing** a code is forbidden — old SPA versions might still emit it. Mark unused codes with `[Obsolete]` and remove only in a major version.

## How the SPA consumes this

The SPA's error-handling layer (`frontend/src/shared/api/errors.ts`) imports the canonical Arabic message for each code from a static map. When the backend returns `{"code":"REFERENCE_KEY_TAKEN", ...}`, the SPA renders the matching message. Any unknown code falls back to the generic Arabic "حدث خطأ غير متوقع" message and logs to the browser console for triage.
