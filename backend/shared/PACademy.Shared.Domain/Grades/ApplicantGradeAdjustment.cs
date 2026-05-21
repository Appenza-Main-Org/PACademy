namespace PACademy.Shared.Domain.Grades;

public sealed class ApplicantGradeAdjustment
{
    private ApplicantGradeAdjustment() { }

    public Guid Id { get; private set; }
    public Guid ApplicantGradeId { get; private set; }
    public string Reason { get; private set; } = default!;
    public string ReasonLabel { get; private set; } = default!;
    public string Note { get; private set; } = default!;
    public decimal Amount { get; private set; }
    public string By { get; private set; } = default!;
    public string When { get; private set; } = default!;
    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public byte[] RowVersion { get; private set; } = default!;

    public static ApplicantGradeAdjustment Create(
        Guid applicantGradeId,
        string reason,
        string reasonLabel,
        string note,
        decimal amount,
        string by)
    {
        if (amount == 0) throw new ArgumentException("amount must not be zero", nameof(amount));
        var now = DateTimeOffset.UtcNow;
        return new ApplicantGradeAdjustment
        {
            Id = Guid.NewGuid(),
            ApplicantGradeId = applicantGradeId,
            Reason = reason,
            ReasonLabel = reasonLabel,
            Note = note.Trim(),
            Amount = amount,
            By = string.IsNullOrWhiteSpace(by) ? "مسؤول النظام" : by.Trim(),
            When = "الآن",
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now,
            RowVersion = [],
        };
    }

    public void SetActive(bool isActive)
    {
        IsActive = isActive;
        UpdatedAt = DateTimeOffset.UtcNow;
    }
}
