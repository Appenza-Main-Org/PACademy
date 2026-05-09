namespace PACademy.Contracts.Admin.ReferenceData;

public sealed record ReferenceDataDetailDto(
    Guid Id,
    string Category,
    string Key,
    string NameAr,
    string? NameEn,
    string? Metadata,
    int SortOrder,
    bool IsActive,
    bool Archived,
    DateTime CreatedAt,
    DateTime? ArchivedAt,
    bool DemoOrigin);
