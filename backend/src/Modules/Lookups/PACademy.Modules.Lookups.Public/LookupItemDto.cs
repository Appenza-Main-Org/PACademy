namespace PACademy.Modules.Lookups.Public;

/// <summary>
/// Wire-shape DTO for lookup rows, returned by AdminLookupsController and
/// consumed by sibling modules that need to read lookup values.
/// `Extras` is a raw JSON object string; consumers parse per type code.
/// </summary>
public sealed record LookupItemDto(
    Guid Id,
    string LookupTypeCode,
    string Code,
    string NameAr,
    string? NameEn,
    bool IsActive,
    int SortOrder,
    Guid? ParentId,
    DateOnly? StartDate,
    DateOnly? EndDate,
    string ExtrasJson,
    string? FacultyCode,
    DateTimeOffset? DeletedAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    string RowVersion);

public sealed record LookupItemTypeDto(
    string Code,
    string LabelAr,
    string CodePrefix,
    byte Padding,
    bool IsHierarchical,
    bool HasDates,
    bool HasExtras,
    string SectionKey,
    short SortInSection,
    bool IsAdminUi);
