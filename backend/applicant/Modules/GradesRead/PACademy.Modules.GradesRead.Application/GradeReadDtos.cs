namespace PACademy.Modules.GradesRead.Application;

public sealed record GradeAdjustmentReadDto(
    Guid Id,
    string Reason,
    string ReasonLabel,
    string Note,
    decimal Amount,
    string By,
    string When,
    bool IsActive);

public sealed record GradeRowReadDto(
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
    IReadOnlyList<GradeAdjustmentReadDto> Log,
    decimal EffectiveGrade,
    bool HasAdjustment,
    int AdjustmentCount,
    string? LatestAdjustmentReason);
