namespace PACademy.Modules.Committees.Application.Dtos;

public sealed record CommitteeDto(
    Guid Id,
    Guid CycleId,
    string Key,
    string NameAr,
    string? NameEn,
    Guid? ChairUserId,
    int DailyCapacity,
    string Status,
    IReadOnlyList<CommitteeMemberDto> Members,
    IReadOnlyList<string> Specializations,
    string RowVersion);

public sealed record CommitteeMemberDto(
    Guid UserId,
    string Role,
    DateTime AddedAt);

public sealed record CommitteeDateBindingDto(
    Guid CommitteeId,
    string BoundDate,
    int Capacity,
    string RowVersion);

public sealed record CreateCommitteeRequest(
    Guid CycleId,
    string Key,
    string NameAr,
    string? NameEn,
    Guid? ChairUserId,
    int DailyCapacity,
    IReadOnlyList<string> Specializations);

public sealed record UpdateCommitteeRequest(
    string? NameAr,
    string? NameEn,
    Guid? ChairUserId,
    int? DailyCapacity,
    string? Status,
    string RowVersion);

public sealed record AddCommitteeMemberRequest(Guid UserId, string Role);

public sealed record ArchiveCommitteeRequest(string? Reason);

public sealed record UpsertDateBindingRequest(int Capacity, string? RowVersion);
