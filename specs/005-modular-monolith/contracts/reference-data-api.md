# Contract: `IReferenceDataApi`

**Project**: `PACademy.Modules.ReferenceData.Public`
**Source file (target)**: `backend/src/Modules/ReferenceData/PACademy.Modules.ReferenceData.Public/IReferenceDataApi.cs`
**Consumed by**: `Admissions.Application` (eligibility checks, applicant-form dropdowns); future phases — `Investigations.Application` (case-types), `Medical.Application` (station-key lookups)

```csharp
namespace PACademy.Modules.ReferenceData.Public;

/// <summary>
/// Read-only intra-process surface for ReferenceData. DI-only — never exposed over HTTP (FR-M05).
/// Admin CRUD (Create/Update/Archive) lives behind the module's controllers in PACademy.Api;
/// this interface is for consumer modules only.
/// </summary>
public interface IReferenceDataApi
{
    /// <summary>
    /// Returns all non-archived rows for a category, sorted by SortOrder ASC then NameAr ASC.
    /// Categories: governorate, specialization, rank, college, qualification, nationality, relationship, case-type.
    /// Throws ArgumentException for unknown categories (caller bug — frontend never sends a bad value).
    /// </summary>
    Task<IReadOnlyList<ReferenceDataItemDto>> ListByCategoryAsync(
        string category,
        CancellationToken ct = default);

    /// <summary>
    /// Looks up a single row by (category, key). Returns null when the key is archived or doesn't exist.
    /// Used by validators that need to confirm the value the user picked is still active.
    /// </summary>
    Task<ReferenceDataItemDto?> FindByKeyAsync(
        string category,
        string key,
        CancellationToken ct = default);
}

public sealed record ReferenceDataItemDto(
    Guid Id,
    string Category,
    string Key,
    string NameAr,
    string? NameEn,
    string? Metadata,
    int SortOrder,
    bool IsActive);
```

## Behaviour notes

- `Metadata` is the raw JSON string carrying per-category extras (e.g. `{"region":"delta"}` for governorates, `{"isoCode":"EG"}` for nationalities). The consumer module deserialises if it cares. Most consumers just need `Key` and `NameAr` for dropdowns.
- The `IsActive` flag on `ReferenceDataItemDto` is always `true` for results from `ListByCategoryAsync` — archived rows are filtered out. The flag is included on the DTO for future consumers that want explicit awareness.
- Frontend SPAs continue to read via the existing `GET /reference-data?category=…` HTTP endpoint, which is implemented by a controller in `PACademy.Api/Controllers/` that calls into `ReferenceData.Application` — **not** through `IReferenceDataApi` (FR-M05 forbids public APIs over HTTP). The two paths share the same use case underneath.
