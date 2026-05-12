namespace PACademy.Modules.Admissions.Domain;

public enum MergeSplitType { Merge, Split }
public enum MergeSplitStatus { Planned, Applied, Cancelled }

/// <summary>
/// Step 9 wizard entity — defines how committees should be merged or split.
/// Once applied the rule is immutable. Only planned rules can be cancelled.
/// </summary>
public sealed class CommitteeMergeSplitRule
{
    public Guid Id { get; private set; }
    public Guid CycleId { get; private set; }
    public MergeSplitType Type { get; private set; }
    /// <summary>JSON array of source committee Guids.</summary>
    public string SourceCommitteeIdsJson { get; private set; } = "[]";
    /// <summary>JSON array of target committee Guids.</summary>
    public string TargetCommitteeIdsJson { get; private set; } = "[]";
    public string? Reason { get; private set; }
    public DateTime EffectiveAt { get; private set; }
    public MergeSplitStatus Status { get; private set; }
    public DateTime? AppliedAt { get; private set; }
    public Guid? AppliedBy { get; private set; }
    public DateTime? CancelledAt { get; private set; }
    public Guid? CancelledBy { get; private set; }
    public string? CancelReason { get; private set; }
    public bool IsArchived { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public Guid CreatedBy { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public byte[] RowVersion { get; private set; } = [];

    private CommitteeMergeSplitRule() { }

    public static CommitteeMergeSplitRule Create(
        Guid cycleId,
        MergeSplitType type,
        IReadOnlyList<Guid> sourceCommitteeIds,
        IReadOnlyList<Guid> targetCommitteeIds,
        DateTime effectiveAt,
        Guid createdBy,
        string? reason = null)
    {
        ValidateShape(type, sourceCommitteeIds, targetCommitteeIds);
        var now = DateTime.UtcNow;
        return new CommitteeMergeSplitRule
        {
            Id = Guid.NewGuid(),
            CycleId = cycleId,
            Type = type,
            SourceCommitteeIdsJson = System.Text.Json.JsonSerializer.Serialize(sourceCommitteeIds),
            TargetCommitteeIdsJson = System.Text.Json.JsonSerializer.Serialize(targetCommitteeIds),
            EffectiveAt = effectiveAt,
            Status = MergeSplitStatus.Planned,
            Reason = reason,
            CreatedAt = now,
            CreatedBy = createdBy,
            UpdatedAt = now,
        };
    }

    public void UpdateShape(
        IReadOnlyList<Guid> sourceCommitteeIds,
        IReadOnlyList<Guid> targetCommitteeIds,
        DateTime? effectiveAt,
        string? reason)
    {
        if (Status != MergeSplitStatus.Planned)
            throw new InvalidOperationException("يمكن تعديل القواعد بحالة 'مخططة' فقط");
        ValidateShape(Type, sourceCommitteeIds, targetCommitteeIds);
        SourceCommitteeIdsJson = System.Text.Json.JsonSerializer.Serialize(sourceCommitteeIds);
        TargetCommitteeIdsJson = System.Text.Json.JsonSerializer.Serialize(targetCommitteeIds);
        if (effectiveAt.HasValue) EffectiveAt = effectiveAt.Value;
        if (reason is not null) Reason = reason;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Apply(Guid actorId)
    {
        if (Status != MergeSplitStatus.Planned)
            throw new InvalidOperationException("يمكن تطبيق القواعد بحالة 'مخططة' فقط");
        Status = MergeSplitStatus.Applied;
        AppliedAt = DateTime.UtcNow;
        AppliedBy = actorId;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Cancel(Guid actorId, string? cancelReason)
    {
        if (Status != MergeSplitStatus.Planned)
            throw new InvalidOperationException("يمكن إلغاء القواعد بحالة 'مخططة' فقط");
        Status = MergeSplitStatus.Cancelled;
        CancelledAt = DateTime.UtcNow;
        CancelledBy = actorId;
        CancelReason = cancelReason;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Archive()
    {
        if (Status == MergeSplitStatus.Applied)
            throw new InvalidOperationException("لا يمكن أرشفة قاعدة مطبقة");
        IsArchived = true;
        UpdatedAt = DateTime.UtcNow;
    }

    private static void ValidateShape(
        MergeSplitType type,
        IReadOnlyList<Guid> sourceCommitteeIds,
        IReadOnlyList<Guid> targetCommitteeIds)
    {
        if (type == MergeSplitType.Merge)
        {
            if (sourceCommitteeIds.Count < 2)
                throw new ArgumentException("يتطلب الدمج لجنتين مصدر على الأقل");
            if (targetCommitteeIds.Count != 1)
                throw new ArgumentException("يتطلب الدمج لجنة هدف واحدة فقط");
        }
        else
        {
            if (sourceCommitteeIds.Count != 1)
                throw new ArgumentException("يتطلب الفصل لجنة مصدر واحدة فقط");
            if (targetCommitteeIds.Count < 2)
                throw new ArgumentException("يتطلب الفصل لجنتين هدف على الأقل");
        }
    }
}
