namespace PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;

public sealed record CommitteeScoreThresholdDto(
    Guid CycleId,
    Guid CommitteeId,
    int Min,
    int Max,
    DateTime UpdatedAt,
    Guid UpdatedBy,
    string RowVersion);

public sealed record UpsertScoreThresholdRequest(int Min, int Max, string? RowVersion = null);
