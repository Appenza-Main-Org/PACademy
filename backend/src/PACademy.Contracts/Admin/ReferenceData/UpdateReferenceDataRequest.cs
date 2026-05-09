namespace PACademy.Contracts.Admin.ReferenceData;

public sealed record UpdateReferenceDataRequest(
    string? NameAr,
    string? NameEn,
    string? Metadata,
    int? SortOrder,
    bool? IsActive);
