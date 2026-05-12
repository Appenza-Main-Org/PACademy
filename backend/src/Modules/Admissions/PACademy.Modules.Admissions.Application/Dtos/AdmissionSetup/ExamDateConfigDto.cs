namespace PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;

public sealed record ExamDateConfigDto(
    Guid Id,
    Guid CycleId,
    DateTime FirstAvailableDate,
    IReadOnlyList<string> BookableDays,
    IReadOnlyList<string> BlackoutDates,
    DateTime UpdatedAt,
    Guid UpdatedBy,
    string RowVersion);

public sealed record UpsertExamDateConfigRequest(
    DateTime FirstAvailableDate,
    IReadOnlyList<string> BookableDays,
    IReadOnlyList<string> BlackoutDates,
    string? RowVersion = null);
