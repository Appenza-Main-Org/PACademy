namespace PACademy.Modules.Lookups.Domain;

/// <summary>
/// Workhorse entity — single table holding every lookup row across all type codes.
/// Discriminator is <see cref="LookupTypeCode"/>; per-type extras are serialized
/// into <see cref="ExtrasJson"/>.
///
/// Invariants enforced at DB level via triggers + filtered unique index. The
/// domain only enforces basic shape (non-empty code/name; valid date range).
/// </summary>
public sealed class LookupItem
{
    private LookupItem() { }

    public Guid Id { get; private set; }
    public string LookupTypeCode { get; private set; } = string.Empty;
    public string Code { get; private set; } = string.Empty;
    public string NameAr { get; private set; } = string.Empty;
    public string? NameEn { get; private set; }
    public bool IsActive { get; private set; }
    public int SortOrder { get; private set; }
    public Guid? ParentId { get; private set; }
    public DateOnly? StartDate { get; private set; }
    public DateOnly? EndDate { get; private set; }
    public string ExtrasJson { get; private set; } = "{}";
    public string? FacultyCode { get; private set; }

    public DateTimeOffset? DeletedAt { get; private set; }
    public Guid? DeletedBy { get; private set; }
    public string? DeleteReason { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }
    public Guid CreatedBy { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public Guid UpdatedBy { get; private set; }

    public byte[] RowVersion { get; private set; } = Array.Empty<byte>();

    public static LookupItem Create(
        Guid id,
        string lookupTypeCode,
        string code,
        string nameAr,
        string? nameEn,
        int sortOrder,
        Guid? parentId,
        DateOnly? startDate,
        DateOnly? endDate,
        string extrasJson,
        string? facultyCode,
        Guid actorId,
        DateTimeOffset now)
    {
        if (string.IsNullOrWhiteSpace(lookupTypeCode))
            throw new ArgumentException("LookupTypeCode is required.", nameof(lookupTypeCode));
        if (string.IsNullOrWhiteSpace(code))
            throw new ArgumentException("Code is required.", nameof(code));
        if (string.IsNullOrWhiteSpace(nameAr))
            throw new ArgumentException("NameAr is required.", nameof(nameAr));
        if (startDate.HasValue && endDate.HasValue && startDate.Value > endDate.Value)
            throw new ArgumentException("StartDate must be on or before EndDate.");

        return new LookupItem
        {
            Id = id,
            LookupTypeCode = lookupTypeCode,
            Code = code,
            NameAr = nameAr,
            NameEn = nameEn,
            IsActive = true,
            SortOrder = sortOrder,
            ParentId = parentId,
            StartDate = startDate,
            EndDate = endDate,
            ExtrasJson = string.IsNullOrWhiteSpace(extrasJson) ? "{}" : extrasJson,
            FacultyCode = facultyCode,
            CreatedAt = now,
            CreatedBy = actorId,
            UpdatedAt = now,
            UpdatedBy = actorId,
        };
    }

    public void Update(
        string nameAr,
        string? nameEn,
        int sortOrder,
        Guid? parentId,
        DateOnly? startDate,
        DateOnly? endDate,
        string extrasJson,
        string? facultyCode,
        Guid actorId,
        DateTimeOffset now)
    {
        if (string.IsNullOrWhiteSpace(nameAr))
            throw new ArgumentException("NameAr is required.", nameof(nameAr));
        if (startDate.HasValue && endDate.HasValue && startDate.Value > endDate.Value)
            throw new ArgumentException("StartDate must be on or before EndDate.");
        if (parentId == Id)
            throw new ArgumentException("Parent cannot be self.", nameof(parentId));

        NameAr = nameAr;
        NameEn = nameEn;
        SortOrder = sortOrder;
        ParentId = parentId;
        StartDate = startDate;
        EndDate = endDate;
        ExtrasJson = string.IsNullOrWhiteSpace(extrasJson) ? "{}" : extrasJson;
        FacultyCode = facultyCode;
        UpdatedAt = now;
        UpdatedBy = actorId;
    }

    public void SetActive(bool isActive, Guid actorId, DateTimeOffset now)
    {
        IsActive = isActive;
        UpdatedAt = now;
        UpdatedBy = actorId;
    }

    public void SoftDelete(Guid actorId, string? reason, DateTimeOffset now)
    {
        if (DeletedAt.HasValue) return;
        DeletedAt = now;
        DeletedBy = actorId;
        DeleteReason = reason;
        UpdatedAt = now;
        UpdatedBy = actorId;
    }

    public void Restore(Guid actorId, DateTimeOffset now)
    {
        if (!DeletedAt.HasValue) return;
        DeletedAt = null;
        DeletedBy = null;
        DeleteReason = null;
        UpdatedAt = now;
        UpdatedBy = actorId;
    }
}
