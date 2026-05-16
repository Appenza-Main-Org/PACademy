namespace PACademy.Modules.Grades.Application.Dtos;

public sealed record GradeRowDto(
    Guid Id,
    int Seat,
    string? SeatingNumber,
    string Nid,
    string Name,
    string Kind,
    string Branch,
    string School,
    string Region,
    decimal Total,
    decimal ImportMax,
    decimal? OverrideMax,
    DateTime? LastEditedAt,
    Guid? LastEditedBy,
    string Status,
    IReadOnlyList<GradeAdjustmentDto> Log,
    string RowVersion);

public sealed record GradeAdjustmentDto(
    Guid Id,
    string Reason,
    string? Note,
    decimal Amount,
    Guid AddedBy,
    DateTime AddedAt,
    bool IsActive,
    string RowVersion);

public sealed record PaginatedGradesResult(
    IReadOnlyList<GradeRowDto> Rows,
    int Total);

public sealed record AddAdjustmentRequest(
    string Reason,
    string? Note,
    decimal Amount,
    bool IsActive);

public sealed record UpdateOverrideMaxRequest(decimal? OverrideMax);

public sealed record ImportedGradeRowDto(
    int Seat,
    string Nid,
    string Name,
    string Kind,
    string Branch,
    string School,
    string Region,
    decimal Total,
    string Status);

public sealed record StageImportRequest(
    string Kind,
    decimal MaxDegree,
    IReadOnlyList<ImportedGradeRowDto> Rows);

public sealed record StagedImportResult(
    Guid StageId,
    int NewRowCount,
    IReadOnlyList<ImportDuplicateRowDto> Duplicates,
    IReadOnlyList<ImportSkipBucketDto> Skipped);

public sealed record ImportDuplicateRowDto(
    string NationalId,
    string Name,
    string Kind,
    int SeatExisting,
    int SeatIncoming,
    decimal MaxDegree,
    bool HasChanges,
    IReadOnlyList<string> ChangedFields,
    ImportSnapshotDto Existing,
    ImportSnapshotDto Incoming,
    decimal AdjustmentSum,
    int AdjustmentCount);

public sealed record ImportSnapshotDto(
    decimal Total,
    string Branch,
    string School,
    string Region,
    string Status);

public sealed record ImportSkipBucketDto(
    string Reason,
    string Label,
    int Count,
    string Tone,
    IReadOnlyList<ImportSkipRowDto> Rows);

public sealed record ImportSkipRowDto(int Row, string Detail);

public sealed record CommitImportRequest(
    Guid StageId,
    IReadOnlyDictionary<string, string> Resolutions); // nid → ACCEPT|REJECT

public sealed record CommittedImportDto(
    int Inserted,
    int Replaced,
    int Kept,
    IReadOnlyList<DeactivatedAdjustmentDto> Deactivated,
    IReadOnlyList<ImportSkipBucketDto> Skipped);

public sealed record DeactivatedAdjustmentDto(
    string NationalId,
    string Name,
    decimal AdjustmentSum);

public sealed record NormalisedRowDto(
    string? NationalId,
    string? SeatingNumber,
    string? NameAr,
    string? Gender,
    string? Track,
    int? GraduationYear,
    decimal? TotalGrade,
    decimal? MaxGrade,
    int SourceRowIndex);

public sealed record RunImportPreflightRequest(
    IReadOnlyList<NormalisedRowDto> Rows,
    int GraduationYear);

public sealed record ImportReportDto(
    ImportReportTotalsDto Totals,
    IReadOnlyList<ImportReportGroupDto> Groups);

public sealed record ImportReportTotalsDto(
    int Received,
    int Imported,
    int Skipped,
    int Failed);

public sealed record ImportReportGroupDto(
    string Code,
    string LabelAr,
    IReadOnlyList<ImportFailureRowDto> Rows,
    IReadOnlyList<string> AvailableActions);

public sealed record ImportFailureRowDto(
    string? NationalId,
    string? SeatingNumber,
    string? NameAr,
    decimal? TotalGrade,
    int SourceRowIndex,
    string? Detail);

public sealed record RunImportCommitRequest(
    IReadOnlyList<NormalisedRowDto> Rows,
    int GraduationYear,
    IReadOnlyDictionary<string, string> PerGroupActions); // code → action

public sealed record ImportCommitResultDto(int InsertedCount, int FailedCount);

public sealed record ListPaginatedRequest(
    int Page,
    int PageSize,
    string? Search,
    string? SortKey,
    string? SortDirection);

public sealed record ExportRequest(
    string? Search,
    string? SortKey,
    string? SortDirection);
