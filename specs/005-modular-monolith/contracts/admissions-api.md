# Contract: `IAdmissionsApi`

**Project**: `PACademy.Modules.Admissions.Public`
**Source file (target)**: `backend/src/Modules/Admissions/PACademy.Modules.Admissions.Public/IAdmissionsApi.cs`
**Consumed by**: `Workflows.Application` (publish-workflow validates category exists + cycle is active)

```csharp
namespace PACademy.Modules.Admissions.Public;

/// <summary>
/// Read-only intra-process surface for Admissions. DI-only — never exposed over HTTP (FR-M05).
/// </summary>
public interface IAdmissionsApi
{
    /// <summary>
    /// Returns the single Active cycle, or null if no cycle is currently Active.
    /// At most one Active cycle exists per (Year, Cohort) — see admissions invariant in data-model.md.
    /// Other modules call this when they need to scope work to "the current intake."
    /// </summary>
    Task<CycleSummaryDto?> GetActiveCycleAsync(CancellationToken ct = default);

    /// <summary>
    /// Returns the category by its immutable RFP key (one of the 7 spec keys), or null if archived/unknown.
    /// Used by Workflows to validate that a publish target's CategoryKey is real before persisting.
    /// </summary>
    Task<CategorySummaryDto?> GetCategoryByKeyAsync(string key, CancellationToken ct = default);
}

public sealed record CycleSummaryDto(
    Guid Id,
    string NameAr,
    int Year,
    string Cohort,
    DateTime OpenDate,
    DateTime CloseDate);

public sealed record CategorySummaryDto(
    Guid Id,
    string Key,
    string NameAr,
    bool IsActive,
    bool IsSpec);
```

## Behaviour notes

- `GetActiveCycleAsync` returns `null` (not throws) when no cycle is Active. Callers decide how to handle the gap (typically: 422 with a Arabic error when the SPA tries to start an applicant flow before a cycle is open).
- `GetCategoryByKeyAsync(key)` accepts only the 7 RFP keys (`officers_general`, `officers_specialized`, `postgraduate`, `institute_officers_training`, `institute_traffic`, `institute_guarding`, `special_units`). Unknown keys return `null`.
- The "active cycle" cache lifetime is per-request — no static caching at the public-API level.

## Why no Applicant lookups?

Phase 5 doesn't expose applicant data via the public API. The applicant aggregate is large, has 30+ fields, and is consumed by exactly one set of controllers (Admissions admin). When phase 6+ modules need to read applicant data (e.g. Committees scoring an applicant), the contract will grow with a `GetApplicantSummaryAsync(Guid id)` method — but only when a real consumer arrives.
