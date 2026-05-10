namespace PACademy.Contracts.Admin.Lookups;

public sealed record NationalityDto(
    Guid Id, string Key, string NameAr, string NameEn, string IsoCode,
    int SortOrder, bool IsActive, bool Archived, DateTime? ArchivedAt, DateTime CreatedAt);

public sealed record CreateNationalityRequest(
    string Key, string NameAr, string NameEn, string IsoCode, int? SortOrder);

public sealed record UpdateNationalityRequest(
    string? NameAr, string? NameEn, string? IsoCode, int? SortOrder, bool? IsActive);
