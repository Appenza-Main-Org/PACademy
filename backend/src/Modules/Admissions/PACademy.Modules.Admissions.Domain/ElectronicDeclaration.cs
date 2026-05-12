namespace PACademy.Modules.Admissions.Domain;

/// <summary>
/// Step 15 wizard entity — electronic declaration shown to applicants on Stage 9.
/// Versioned: each save creates a new version. Only one version per cycle may
/// be published at a time (invariant enforced by use case + DB constraint).
/// </summary>
public sealed class ElectronicDeclaration
{
    public Guid Id { get; private set; }
    public Guid CycleId { get; private set; }
    public string BodyAr { get; private set; } = string.Empty;
    public int Version { get; private set; }
    public DateTime EffectiveFrom { get; private set; }
    public DateTime? PublishedAt { get; private set; }
    public bool IsArchived { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public Guid CreatedBy { get; private set; }
    public byte[] RowVersion { get; private set; } = [];

    private ElectronicDeclaration() { }

    public static ElectronicDeclaration CreateDraft(
        Guid cycleId,
        string bodyAr,
        DateTime effectiveFrom,
        Guid createdBy,
        int version = 1)
    {
        if (string.IsNullOrWhiteSpace(bodyAr))
            throw new ArgumentException("نص الإقرار لا يمكن أن يكون فارغاً");
        return new ElectronicDeclaration
        {
            Id = Guid.NewGuid(),
            CycleId = cycleId,
            BodyAr = bodyAr,
            Version = version,
            EffectiveFrom = effectiveFrom,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy,
        };
    }

    public void Update(string? bodyAr, DateTime? effectiveFrom)
    {
        if (PublishedAt.HasValue)
            throw new InvalidOperationException("لا يمكن تعديل إقرار منشور");
        if (bodyAr is not null)
        {
            if (string.IsNullOrWhiteSpace(bodyAr))
                throw new ArgumentException("نص الإقرار لا يمكن أن يكون فارغاً");
            BodyAr = bodyAr;
        }
        if (effectiveFrom.HasValue) EffectiveFrom = effectiveFrom.Value;
    }

    public void Publish()
    {
        if (IsArchived)
            throw new InvalidOperationException("لا يمكن نشر إقرار مؤرشف");
        PublishedAt = DateTime.UtcNow;
    }

    public void Unpublish()
    {
        PublishedAt = null;
    }

    public void Archive()
    {
        if (PublishedAt.HasValue)
            throw new InvalidOperationException("لا يمكن أرشفة الإقرار المنشور حالياً");
        IsArchived = true;
    }
}
