namespace PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;

public sealed record CycleExamDto(
    Guid Id,
    Guid CycleId,
    string ExamTypeKey,
    Guid? CategoryId,
    int Order,
    bool IsRequired,
    decimal? FeeEgp,
    bool IsArchived,
    DateTime CreatedAt,
    Guid CreatedBy,
    string RowVersion);

public sealed record CreateCycleExamRequest(
    string ExamTypeKey,
    int Order,
    bool IsRequired,
    Guid? CategoryId = null,
    decimal? FeeEgp = null);

public sealed record UpdateCycleExamRequest(
    int? Order,
    bool? IsRequired,
    decimal? FeeEgp,
    string RowVersion);

public sealed record ReorderCycleExamsRequest(IReadOnlyList<Guid> OrderedIds);
