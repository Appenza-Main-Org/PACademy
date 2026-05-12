namespace PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;

public sealed record MergeSplitRuleDto(
    Guid Id,
    Guid CycleId,
    string Type,
    IReadOnlyList<Guid> SourceCommitteeIds,
    IReadOnlyList<Guid> TargetCommitteeIds,
    string? Reason,
    DateTime EffectiveAt,
    string Status,
    DateTime? AppliedAt,
    Guid? AppliedBy,
    DateTime? CancelledAt,
    Guid? CancelledBy,
    string? CancelReason,
    DateTime CreatedAt,
    Guid CreatedBy,
    string RowVersion);

public sealed record CreateMergeSplitRuleRequest(
    string Type,
    IReadOnlyList<Guid> SourceCommitteeIds,
    IReadOnlyList<Guid> TargetCommitteeIds,
    DateTime EffectiveAt,
    string? Reason = null);

public sealed record UpdateMergeSplitRuleRequest(
    IReadOnlyList<Guid> SourceCommitteeIds,
    IReadOnlyList<Guid> TargetCommitteeIds,
    DateTime? EffectiveAt,
    string? Reason,
    string RowVersion);

public sealed record CancelMergeSplitRuleRequest(string? Reason, string RowVersion);

public sealed record ApplyMergeSplitRuleRequest(string ConfirmPreviewHash, string RowVersion);

public sealed record MergeSplitPreviewDto(
    IReadOnlyList<ApplicantMoveDto> ApplicantsMoved,
    IReadOnlyList<CapacityChangeDto> CapacityChanges,
    IReadOnlyList<string> BrokenReferences,
    string PreviewHash);

public sealed record ApplicantMoveDto(Guid ApplicantId, Guid FromCommitteeId, Guid ToCommitteeId);
public sealed record CapacityChangeDto(Guid CommitteeId, int Before, int After);

public sealed record ApplyResultDto(bool Applied, int ApplicantsMoved, long DurationMs);
