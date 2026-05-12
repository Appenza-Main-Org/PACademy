namespace PACademy.Modules.Admissions.Domain;

/// <summary>
/// Step 10 wizard entity — acceptance score min/max per committee per cycle.
/// Upsert-only (no soft delete). Composite PK (CycleId, CommitteeId).
/// </summary>
public sealed class CommitteeScoreThreshold
{
    public Guid CycleId { get; private set; }
    public Guid CommitteeId { get; private set; }
    public int Min { get; private set; }
    public int Max { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public Guid UpdatedBy { get; private set; }
    public byte[] RowVersion { get; private set; } = [];

    private CommitteeScoreThreshold() { }

    public static CommitteeScoreThreshold Create(
        Guid cycleId,
        Guid committeeId,
        int min,
        int max,
        Guid updatedBy)
    {
        if (min > max)
            throw new ArgumentException("الحد الأدنى يجب أن يكون أقل من أو يساوي الحد الأقصى");
        if (min < 0 || max < 0)
            throw new ArgumentException("الدرجات لا يمكن أن تكون سالبة");
        return new CommitteeScoreThreshold
        {
            CycleId = cycleId,
            CommitteeId = committeeId,
            Min = min,
            Max = max,
            UpdatedAt = DateTime.UtcNow,
            UpdatedBy = updatedBy,
        };
    }

    public void Update(int min, int max, Guid updatedBy)
    {
        if (min > max)
            throw new ArgumentException("الحد الأدنى يجب أن يكون أقل من أو يساوي الحد الأقصى");
        if (min < 0 || max < 0)
            throw new ArgumentException("الدرجات لا يمكن أن تكون سالبة");
        Min = min;
        Max = max;
        UpdatedBy = updatedBy;
        UpdatedAt = DateTime.UtcNow;
    }
}
