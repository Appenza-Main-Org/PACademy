namespace PACademy.Admin.Api.Modules.Reports.Dtos;

public sealed class ReportsFiltersDto
{
    public string? CycleId { get; init; }
    public DateOnly? DateFrom { get; init; }
    public DateOnly? DateTo { get; init; }
    public int? AgeMin { get; init; }
    public int? AgeMax { get; init; }
    public string? CategoryKey { get; init; }
    public string? ApplicantType { get; init; }
    public string? Gender { get; init; }
    public string? CommitteeId { get; init; }
    public string? SpecializationCode { get; init; }
    public string? PaymentStatus { get; init; }
    public int? StoppedAtStage { get; init; }
}

public sealed record AggregateRowDto(
    string DimensionKey,
    string DimensionLabelAr,
    int Total,
    int Paid,
    int Unpaid,
    double Percentage);

public sealed record ApplicantReportRowDto(
    string Id,
    string NationalId,
    string NameAr,
    string Gender,
    int? Age,
    string CategoryLabelAr,
    string ApplicantTypeLabelAr,
    string SpecializationLabelAr,
    string CommitteeLabelAr,
    int CurrentStage,
    string CurrentStageLabelAr,
    string PaymentStatus,
    DateTimeOffset SubmittedAt,
    DateTimeOffset? LastActivityAt);

public sealed record StuckApplicantRowDto(
    string Id,
    string NationalId,
    string NameAr,
    int StoppedAtStage,
    string StoppedAtStageLabelAr,
    DateTimeOffset LastActivityAt,
    int StaleDays,
    string CategoryLabelAr,
    string CommitteeLabelAr,
    string PaymentStatus);

public sealed record MissingReferenceDto(string Kind, string Id, string RequestedFrom);

public sealed record DataAvailabilityTotalsDto(
    int ApplicantsInCycle,
    int PaidApplicants,
    int CommitteesConfigured,
    int SpecializationsConfigured);

public sealed record DataAvailabilityReportDto(
    bool Ok,
    string CycleId,
    bool CycleExists,
    string CycleStatus,
    DataAvailabilityTotalsDto Totals,
    IReadOnlyList<MissingReferenceDto> MissingReferences,
    int AppliedFiltersMatchCount,
    DateTimeOffset GeneratedAt);

public sealed record StageFunnelDto(
    int StageIndex,
    string StageLabel,
    int Count,
    double PercentOfTotal,
    int StaleCount);

public sealed record ReportPageDto<T>(
    IReadOnlyList<T> Data,
    int Total,
    int Page,
    int PageSize,
    int TotalPages);

public sealed record ReportsExportRequest(
    ReportsFiltersDto Filters,
    string Format,
    string Report,
    string Title);
