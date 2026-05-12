namespace PACademy.Modules.Admissions.Domain;

/// <summary>
/// Step 7 wizard entity — an exam type assigned to a cycle, with ordering and fee.
/// </summary>
public sealed class CycleExam
{
    public Guid Id { get; private set; }
    public Guid CycleId { get; private set; }
    public string ExamTypeKey { get; private set; } = string.Empty;
    public Guid? CategoryId { get; private set; }
    public int Order { get; private set; }
    public bool IsRequired { get; private set; }
    public decimal? FeeEgp { get; private set; }
    public bool IsArchived { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public Guid CreatedBy { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public byte[] RowVersion { get; private set; } = [];

    private CycleExam() { }

    public static CycleExam Create(
        Guid cycleId,
        string examTypeKey,
        int order,
        bool isRequired,
        Guid createdBy,
        Guid? categoryId = null,
        decimal? feeEgp = null)
    {
        if (string.IsNullOrWhiteSpace(examTypeKey))
            throw new ArgumentException("مفتاح نوع الاختبار مطلوب");
        if (feeEgp.HasValue && feeEgp.Value < 0)
            throw new ArgumentException("الرسوم لا يمكن أن تكون سالبة");
        var now = DateTime.UtcNow;
        return new CycleExam
        {
            Id = Guid.NewGuid(),
            CycleId = cycleId,
            ExamTypeKey = examTypeKey,
            CategoryId = categoryId,
            Order = order,
            IsRequired = isRequired,
            FeeEgp = feeEgp,
            CreatedAt = now,
            CreatedBy = createdBy,
            UpdatedAt = now,
        };
    }

    public void Update(int? order, bool? isRequired, decimal? feeEgp)
    {
        if (order.HasValue) Order = order.Value;
        if (isRequired.HasValue) IsRequired = isRequired.Value;
        if (feeEgp.HasValue)
        {
            if (feeEgp.Value < 0)
                throw new ArgumentException("الرسوم لا يمكن أن تكون سالبة");
            FeeEgp = feeEgp.Value;
        }
        UpdatedAt = DateTime.UtcNow;
    }

    public void Archive() { IsArchived = true; UpdatedAt = DateTime.UtcNow; }
    public void Restore() { IsArchived = false; UpdatedAt = DateTime.UtcNow; }
}
