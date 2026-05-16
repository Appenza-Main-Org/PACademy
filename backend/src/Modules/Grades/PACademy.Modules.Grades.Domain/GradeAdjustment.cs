namespace PACademy.Modules.Grades.Domain;

public sealed class GradeAdjustment
{
    public Guid Id { get; private set; }
    public Guid GradeRowId { get; private set; }
    public AdjustmentReason Reason { get; private set; }
    public string? Note { get; private set; }
    public decimal Amount { get; private set; }
    public Guid AddedBy { get; private set; }
    public DateTime AddedAt { get; private set; }
    public bool IsActive { get; private set; }
    public byte[] RowVersion { get; private set; } = [];

    private GradeAdjustment() { }

    public static GradeAdjustment Create(
        Guid gradeRowId,
        AdjustmentReason reason,
        string? note,
        decimal amount,
        bool isActive,
        Guid addedBy)
        => new()
        {
            Id = Guid.NewGuid(),
            GradeRowId = gradeRowId,
            Reason = reason,
            Note = note,
            Amount = amount,
            AddedBy = addedBy,
            AddedAt = DateTime.UtcNow,
            IsActive = isActive,
        };

    internal void Toggle() => IsActive = !IsActive;
    internal void Deactivate() => IsActive = false;
}
