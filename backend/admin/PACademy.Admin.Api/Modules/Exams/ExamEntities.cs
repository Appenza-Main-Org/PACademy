using Microsoft.EntityFrameworkCore;
using PACademy.Shared.Persistence.ChangeTracking;

namespace PACademy.Admin.Api.Modules.Exams;

public sealed class ExamQuestionEntity : IChangeTracked
{
    public required string Id { get; set; }
    public required string Category { get; set; }
    public string? Classification { get; set; }
    public int Difficulty { get; set; }
    public required string Type { get; set; }
    public required string Text { get; set; }
    public int CorrectIndex { get; set; }
    public int TimeLimitSeconds { get; set; }
    public string? Notes { get; set; }
    public required string Status { get; set; }
    public int Version { get; set; }
    public string? ImageUrl { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
    public string? LastModifiedBy { get; set; }
    public string? SourceSystem { get; set; } = ChangeTrackingColumns.DefaultSourceSystem;
    public string? Checksum { get; set; }
    public List<ExamQuestionOptionEntity> Options { get; set; } = [];
    public List<ExamQuestionMatchingPairEntity> MatchingPairs { get; set; } = [];
}

public sealed class ExamQuestionOptionEntity
{
    public required string QuestionId { get; set; }
    public int OptionOrder { get; set; }
    public required string OptionText { get; set; }
}

public sealed class ExamQuestionMatchingPairEntity
{
    public required string QuestionId { get; set; }
    public int PairOrder { get; set; }
    public required string Prompt { get; set; }
    public required string MatchText { get; set; }
}

public sealed class ExamEntity : IChangeTracked
{
    public required string Id { get; set; }
    public required string NameAr { get; set; }
    public required string CycleId { get; set; }
    public string? CycleName { get; set; }
    public string? ScheduledFor { get; set; }
    public string? AccessStartAt { get; set; }
    public string? AccessEndAt { get; set; }
    public int? DurationMinutes { get; set; }
    public int? QuestionCount { get; set; }
    public bool? RandomSelection { get; set; }
    public bool? RandomQuestionOrder { get; set; }
    public string? DisplayMode { get; set; }
    public required string Status { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
    public string? LastModifiedBy { get; set; }
    public string? SourceSystem { get; set; } = ChangeTrackingColumns.DefaultSourceSystem;
    public string? Checksum { get; set; }
    public List<ExamRuleEntity> Rules { get; set; } = [];
    public List<ExamQuestionLinkEntity> QuestionLinks { get; set; } = [];
    public List<ExamAssignmentEntity> Assignments { get; set; } = [];
}

public sealed class ExamRuleEntity
{
    public required string ExamId { get; set; }
    public int RuleOrder { get; set; }
    public required string Category { get; set; }
    public int DifficultyMin { get; set; }
    public int DifficultyMax { get; set; }
    public int QuestionCount { get; set; }
    public int Minutes { get; set; }
}

public sealed class ExamQuestionLinkEntity
{
    public required string ExamId { get; set; }
    public int QuestionOrder { get; set; }
    public required string QuestionId { get; set; }
}

public sealed class ExamAssignmentEntity
{
    public required string ExamId { get; set; }
    public required string AssignmentKind { get; set; }
    public int AssignmentOrder { get; set; }
    public required string Value { get; set; }
}

public interface IExamsDbContext
{
    DbSet<ExamQuestionEntity> ExamQuestions { get; }
    DbSet<ExamQuestionOptionEntity> ExamQuestionOptions { get; }
    DbSet<ExamQuestionMatchingPairEntity> ExamQuestionMatchingPairs { get; }
    DbSet<ExamEntity> Exams { get; }
    DbSet<ExamRuleEntity> ExamRules { get; }
    DbSet<ExamQuestionLinkEntity> ExamQuestionLinks { get; }
    DbSet<ExamAssignmentEntity> ExamAssignments { get; }
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
