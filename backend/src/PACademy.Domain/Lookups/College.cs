namespace PACademy.Domain.Lookups;

public enum CollegeType { Public, Private, Azhar }

public sealed class College : LookupBase
{
    public string NameAr { get; private set; } = string.Empty;
    public Guid GovernorateId { get; private set; }
    public CollegeType Type { get; private set; }

    private College() { }

    public static College Create(
        string key, string nameAr, Guid governorateId, CollegeType type,
        int sortOrder = 0, bool demoOrigin = false)
    {
        return new College
        {
            Id = Guid.NewGuid(),
            Key = key,
            NameAr = nameAr,
            GovernorateId = governorateId,
            Type = type,
            SortOrder = sortOrder,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            DemoOrigin = demoOrigin,
        };
    }

    public void Update(string? nameAr, Guid? governorateId, CollegeType? type, int? sortOrder, bool? isActive)
    {
        if (nameAr is not null) NameAr = nameAr;
        if (governorateId.HasValue) GovernorateId = governorateId.Value;
        if (type.HasValue) Type = type.Value;
        if (sortOrder.HasValue) SortOrder = sortOrder.Value;
        if (isActive.HasValue) IsActive = isActive.Value;
    }
}
