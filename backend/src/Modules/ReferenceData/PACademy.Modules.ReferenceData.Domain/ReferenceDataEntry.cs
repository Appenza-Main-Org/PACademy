namespace PACademy.Modules.ReferenceData.Domain;

public sealed class ReferenceDataEntry
{
    public Guid Id { get; private set; }
    public string Category { get; private set; } = string.Empty;
    public string Key { get; private set; } = string.Empty;
    public string NameAr { get; private set; } = string.Empty;
    public string? NameEn { get; private set; }
    public string? Metadata { get; private set; }
    public int SortOrder { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public bool Archived { get; private set; }
    public DateTime? ArchivedAt { get; private set; }
    public bool DemoOrigin { get; private set; }

    private ReferenceDataEntry() { }

    public static ReferenceDataEntry Create(
        string category,
        string key,
        string nameAr,
        string? nameEn = null,
        string? metadata = null,
        int sortOrder = 0,
        bool demoOrigin = false)
    {
        return new ReferenceDataEntry
        {
            Id = Guid.NewGuid(),
            Category = category,
            Key = key,
            NameAr = nameAr,
            NameEn = nameEn,
            Metadata = metadata,
            SortOrder = sortOrder,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            DemoOrigin = demoOrigin,
        };
    }

    public void Update(
        string? nameAr,
        string? nameEn,
        string? metadata,
        int? sortOrder,
        bool? isActive)
    {
        if (nameAr is not null) NameAr = nameAr;
        if (nameEn is not null) NameEn = nameEn;
        if (metadata is not null) Metadata = metadata;
        if (sortOrder is not null) SortOrder = sortOrder.Value;
        if (isActive is not null) IsActive = isActive.Value;
    }

    public void Archive()
    {
        Archived = true;
        ArchivedAt = DateTime.UtcNow;
        IsActive = false;
    }
}
