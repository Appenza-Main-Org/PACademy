namespace PACademy.Contracts.Admin.Lookups;

public sealed record RelationshipDto(
    Guid Id, string Key, string NameAr, int Degree, string Side,
    int SortOrder, bool IsActive, bool Archived, DateTime? ArchivedAt, DateTime CreatedAt);

public sealed record CreateRelationshipRequest(
    string Key, string NameAr, int Degree, string Side, int? SortOrder);

public sealed record UpdateRelationshipRequest(
    string? NameAr, int? Degree, string? Side, int? SortOrder, bool? IsActive);
