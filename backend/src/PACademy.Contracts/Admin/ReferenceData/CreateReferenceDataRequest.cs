namespace PACademy.Contracts.Admin.ReferenceData;

public sealed record CreateReferenceDataRequest(
    string Category,
    string Key,
    string NameAr,
    string? NameEn,
    string? Metadata,
    int? SortOrder);
