namespace PACademy.Modules.Grades.Domain;

public sealed class GradeRow
{
    public Guid Id { get; private set; }
    public int Seat { get; private set; }
    public string? SeatingNumber { get; private set; }
    public string Nid { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public GradeKind Kind { get; private set; }
    public string Branch { get; private set; } = string.Empty;
    public string School { get; private set; } = string.Empty;
    public string Region { get; private set; } = string.Empty;
    public decimal Total { get; private set; }
    public decimal ImportMax { get; private set; }
    public decimal? OverrideMax { get; private set; }
    public string Status { get; private set; } = string.Empty;
    public DateTime? LastEditedAt { get; private set; }
    public Guid? LastEditedBy { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public Guid CreatedBy { get; private set; }
    public byte[] RowVersion { get; private set; } = [];

    private readonly List<GradeAdjustment> _adjustments = [];
    public IReadOnlyList<GradeAdjustment> Adjustments => _adjustments;

    private GradeRow() { }

    public static GradeRow Create(
        int seat,
        string? seatingNumber,
        string nid,
        string name,
        GradeKind kind,
        string branch,
        string school,
        string region,
        decimal total,
        decimal importMax,
        string status,
        Guid createdBy)
    {
        if (string.IsNullOrWhiteSpace(nid)) throw new ArgumentException("الرقم القومي مطلوب");
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("الاسم مطلوب");
        if (importMax <= 0) throw new ArgumentException("الدرجة العظمى يجب أن تكون أكبر من صفر");
        if (total < 0) throw new ArgumentException("المجموع لا يمكن أن يكون سالباً");
        if (total > importMax) throw new ArgumentException("المجموع يتجاوز الدرجة العظمى");

        return new GradeRow
        {
            Id = Guid.NewGuid(),
            Seat = seat,
            SeatingNumber = seatingNumber,
            Nid = nid,
            Name = name,
            Kind = kind,
            Branch = branch ?? string.Empty,
            School = school ?? string.Empty,
            Region = region ?? string.Empty,
            Total = total,
            ImportMax = importMax,
            Status = status ?? string.Empty,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy,
        };
    }

    public void ReplaceFromImport(
        int seat,
        string name,
        GradeKind kind,
        string branch,
        string school,
        string region,
        decimal total,
        decimal importMax)
    {
        Seat = seat;
        Name = name;
        Kind = kind;
        Branch = branch ?? string.Empty;
        School = school ?? string.Empty;
        Region = region ?? string.Empty;
        Total = total;
        ImportMax = importMax;
    }

    public GradeAdjustment AddAdjustment(
        AdjustmentReason reason,
        string? note,
        decimal amount,
        bool isActive,
        Guid addedBy)
    {
        var adj = GradeAdjustment.Create(Id, reason, note, amount, isActive, addedBy);
        _adjustments.Add(adj);
        LastEditedAt = DateTime.UtcNow;
        LastEditedBy = addedBy;
        return adj;
    }

    public GradeAdjustment ToggleAdjustment(Guid adjustmentId, Guid actor)
    {
        var adj = _adjustments.FirstOrDefault(a => a.Id == adjustmentId)
            ?? throw new InvalidOperationException("التعديل غير موجود");
        adj.Toggle();
        LastEditedAt = DateTime.UtcNow;
        LastEditedBy = actor;
        return adj;
    }

    public void RemoveAdjustment(Guid adjustmentId, Guid actor)
    {
        var adj = _adjustments.FirstOrDefault(a => a.Id == adjustmentId)
            ?? throw new InvalidOperationException("التعديل غير موجود");
        _adjustments.Remove(adj);
        LastEditedAt = DateTime.UtcNow;
        LastEditedBy = actor;
    }

    public void SetOverrideMax(decimal? overrideMax, Guid actor)
    {
        if (overrideMax is not null && overrideMax.Value <= 0)
            throw new ArgumentException("الدرجة العظمى المعدّلة يجب أن تكون أكبر من صفر");
        OverrideMax = overrideMax;
        LastEditedAt = overrideMax is null ? null : DateTime.UtcNow;
        LastEditedBy = overrideMax is null ? null : actor;
    }

    public void DeactivateAllAdjustments(Guid actor)
    {
        foreach (var adj in _adjustments) adj.Deactivate();
        if (_adjustments.Count > 0)
        {
            LastEditedAt = DateTime.UtcNow;
            LastEditedBy = actor;
        }
    }
}
