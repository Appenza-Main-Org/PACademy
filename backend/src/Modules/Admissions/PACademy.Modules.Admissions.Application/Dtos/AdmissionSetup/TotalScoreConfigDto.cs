namespace PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;

public sealed record TotalScoreComponentDto(string ExamKey, int Weight, int? MinimumPassingScore);

public sealed record TotalScoreConfigDto(
    Guid Id,
    Guid CycleId,
    string ApplicantStream,
    IReadOnlyList<TotalScoreComponentDto> Components,
    int TotalScoreOutOf,
    DateTime UpdatedAt,
    Guid UpdatedBy,
    string RowVersion);

public sealed record UpsertTotalScoreConfigRequest(
    IReadOnlyList<TotalScoreComponentDto> Components,
    int TotalScoreOutOf,
    string? RowVersion = null);
