# Contract: `IAuditApi`

**Project**: `PACademy.Shared.Audit.Public`
**Source file (target)**: `backend/src/Shared/Audit/PACademy.Shared.Audit.Public/IAuditApi.cs`
**Consumed by**: every module that emits audit rows — `Identity.Application` (login/logout), `Admissions.Application` (cycle/category/applicant/admission-rule writes), `ReferenceData.Application` (lookup CRUD), `Workflows.Application` (publish/archive)

```csharp
namespace PACademy.Shared.Audit.Public;

/// <summary>
/// Cross-module write surface for the audit log. Lives in Shared/Audit because every module's writes
/// emit audit rows — placing it under Modules/Identity/ would invert the dependency graph.
/// DI-only — never exposed over HTTP (FR-M05).
///
/// Multi-context atomic writes are handled by CrossModuleUnitOfWork (host helper). The single-context
/// path (most CRUD endpoints — Audit + the writing module's own context) auto-attaches via the UoW.
/// </summary>
public interface IAuditApi
{
    /// <summary>
    /// Records a single audit row. Caller is responsible for opening the CrossModuleUnitOfWork that
    /// binds AuditDbContext to the same SqlTransaction as the writing module's context. Failing to do
    /// so will silently break atomicity — the audit row commits separately from the business write.
    ///
    /// All-or-nothing semantics (FR-D06): if the host's surrounding transaction rolls back, the audit
    /// row is rolled back too. There is no scenario in phase 5 where a business write succeeds without
    /// its audit row, or vice versa.
    /// </summary>
    Task RecordAsync(
        AuditAction action,
        string targetType,
        Guid targetId,
        string targetLabel,
        AuditOutcome outcome,
        string? beforeJson,
        string? afterJson,
        CancellationToken ct = default);
}

public enum AuditAction
{
    Login,
    Logout,
    Create,
    Update,
    Archive,
    Delete,
    View,
    Export,
}

public enum AuditOutcome
{
    Success,
    ValidationFailed,
    PermissionDenied,
    NotFound,
    Conflict,
    ServerError,
}
```

## Behaviour notes

- `targetType` is a free-form string identifying the aggregate type (`"cycle"`, `"applicant"`, `"category"`, `"reference-data"`, `"workflow"`, `"system-user"`). Used by the SPA's audit-log filter and by analytics queries.
- `targetId` is the aggregate's `Id` (always a `Guid`).
- `targetLabel` is a human-readable identifier (e.g. cycle name, applicant national ID, category Arabic label) — NOT a stable identifier; cosmetic only.
- `beforeJson` / `afterJson` carry the diff for `Update` actions. `null` for `Create`, `Delete`, `Login`. The shapes are domain-specific and consumed only by audit-log readers in the SPA.
- The actor (`UserId` column) is filled in by the implementation from `IIdentityApi.GetCurrentUserAsync()` — callers don't pass it.
- The implementation runs inside `CrossModuleUnitOfWork.Use<AuditDbContext>()` whenever the host opens a UoW; otherwise it uses the DI-injected `AuditDbContext` (single-context audit-only paths — rare).

## Why a write surface in Shared

Audit is the only Shared concern with a write API. Read-only public APIs (`IIdentityApi`, `IAdmissionsApi`, …) are queries; Audit is unavoidably a write because every module needs to record actions, and writes to a single shared table belong to a single owner. Putting Audit inside any specific module would invert the dependency graph. (See research.md R0.7 for the alternatives considered.)
