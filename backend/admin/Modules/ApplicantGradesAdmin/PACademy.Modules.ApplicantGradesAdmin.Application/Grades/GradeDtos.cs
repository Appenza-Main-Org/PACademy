namespace PACademy.Modules.ApplicantGradesAdmin.Application.Grades;

public sealed record GradeAdjustmentDto(
    Guid Id,
    string Reason,
    string ReasonLabel,
    string Note,
    decimal Amount,
    string By,
    string When,
    bool IsActive,
    bool? Fresh = null);

public sealed record GradeRowDto(
    int Seat,
    string? SeatingNumber,
    string Nid,
    string Name,
    string Kind,
    string Gender,
    string Branch,
    int? GraduationYear,
    string? SchoolCategoryCode,
    string School,
    string Region,
    string? ExamRound,
    decimal Total,
    decimal ImportMax,
    decimal? OverrideMax,
    string? LastEditedAt,
    string? LastEditedBy,
    DateTimeOffset? GradeChangedAt,
    decimal? PreviousGrade,
    string Status,
    IReadOnlyList<GradeAdjustmentDto> Log,
    decimal EffectiveGrade,
    bool HasAdjustment,
    int AdjustmentCount,
    string? LatestAdjustmentReason,
    string RowVersion);

public sealed record GradeListResult(IReadOnlyList<GradeRowDto> Rows, int Total);
public sealed record GradeListFilters(
    int? Page,
    int? PageSize,
    string? Search,
    string? Sort,
    string? Gender,
    string? Branch,
    int? GraduationYear,
    string? SchoolCategoryCode,
    bool? ChangedOnly);

public sealed record ImportedGradeRow(
    int Seat,
    string Nid,
    string Name,
    string Kind,
    string Branch,
    string School,
    string Region,
    decimal Total,
    string? SeatingNumber = null,
    string? Gender = null,
    int? GraduationYear = null,
    string? SchoolCategoryCode = null,
    string? ExamRound = null,
    decimal? MaxGrade = null);

public sealed record StageImportRequest(string Kind, decimal MaxDegree, IReadOnlyList<ImportedGradeRow> Rows);
public sealed record ChangedFieldDto(string Field, string Existing, string Incoming);
public sealed record ImportDuplicateRow(
    int RowIndex,
    string Nid,
    string Name,
    string ExistingName,
    IReadOnlyList<ChangedFieldDto> ChangedFields,
    decimal AdjustmentSum,
    int AdjustmentCount);
public sealed record ImportSkippedRow(int RowIndex, string Nid, string Name, decimal Total, string Reason, string ReasonCode);
public sealed record ImportStagedDto(int NewRows, IReadOnlyList<ImportDuplicateRow> Duplicates, IReadOnlyList<ImportSkippedRow> Skipped);
public sealed record StageImportResponse(bool Ok, Guid BatchId, ImportStagedDto Staged);
public sealed record ImportResolution(string Nid, string Action);
public sealed record CommitImportRequest(Guid BatchId, IReadOnlyList<ImportResolution> Resolutions);
public sealed record DeactivatedAdjustmentDto(string Nid, Guid AdjustmentId, string Reason, decimal Amount);
public sealed record CommitImportResponse(bool Ok, int Inserted, int Updated, IReadOnlyList<DeactivatedAdjustmentDto> DeactivatedAdjustments);

public sealed record NormalisedRow(
    int SourceRowIndex,
    string? NationalId,
    string? SeatingNumber,
    string? NameAr,
    string? Gender,
    string? Track,
    int? GraduationYear,
    decimal? TotalGrade,
    decimal? MaxGrade,
    string? SchoolCategory,
    string? ExamRound,
    string? SchoolName,
    string? RegionName);

public sealed record ImportValidationRule(
    string? SchoolCategory,
    IReadOnlyList<string> AllowedGenders,
    int? AgeMin,
    int? MaxAge,
    DateOnly? AgeReferenceDate);

public sealed record RunImportPreflightRequest(
    IReadOnlyList<NormalisedRow> Rows,
    int? GraduationYear,
    IReadOnlyList<ImportValidationRule>? ValidationRules = null);
public sealed record ImportIssueRow(int RowIndex, string? NationalId, string? Name, string? Message);
public sealed record ImportIssueGroup(string Code, string Label, IReadOnlyList<ImportIssueRow> Rows, IReadOnlyList<string> Actions);
public sealed record ImportTotals(int Received, int Imported, int Skipped, int Failed);
public sealed record ImportReport(ImportTotals Totals, IReadOnlyList<ImportIssueGroup> Groups);

public sealed record ExistingDiffDecision(string NationalId, string Action);
public sealed record UploadDuplicateDecision(string NationalId, string Action, int? SourceRowIndex);
public sealed record RunImportCommitRequest(
    IReadOnlyList<NormalisedRow> Rows,
    int GraduationYear,
    IReadOnlyList<string> SelectedSchoolCategories,
    IReadOnlyDictionary<string, decimal> MaxGradeByCategory,
    IReadOnlyDictionary<string, string> PerGroupActions,
    IReadOnlyList<ImportValidationRule>? ValidationRules = null,
    IReadOnlyList<ExistingDiffDecision>? ExistingDiffDecisions = null,
    IReadOnlyList<UploadDuplicateDecision>? UploadDuplicateDecisions = null);
public sealed record ImportCommitResult(int InsertedCount, int FailedCount, int AlreadyImportedCount);

public sealed record AddAdjustmentRequest(string Reason, string Note, decimal Amount, string? By = null, decimal? OverrideMax = null);
public sealed record ToggleAdjustmentRequest(bool IsActive);
public sealed record UpdateOverrideMaxRequest(decimal? OverrideMax);
public sealed record DeleteGradesRequest(IReadOnlyList<int> Seats);
