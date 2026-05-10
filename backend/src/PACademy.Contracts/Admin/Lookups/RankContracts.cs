namespace PACademy.Contracts.Admin.Lookups;

public sealed record RankDto(
    Guid Id, string Key, string NameAr, int Level, string ApplicableTo,
    int SortOrder, bool IsActive, bool Archived, DateTime? ArchivedAt, DateTime CreatedAt);

public sealed record CreateRankRequest(
    string Key, string NameAr, int Level, string ApplicableTo, int? SortOrder);

public sealed record UpdateRankRequest(
    string? NameAr, int? Level, string? ApplicableTo, int? SortOrder, bool? IsActive);
