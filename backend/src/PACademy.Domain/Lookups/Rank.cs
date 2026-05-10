namespace PACademy.Domain.Lookups;

public enum ApplicableTo { Officer, Enlisted, Civilian }

public sealed class Rank : LookupBase
{
    public string NameAr { get; private set; } = string.Empty;
    public int Level { get; private set; }
    public ApplicableTo ApplicableTo { get; private set; }

    private Rank() { }

    public static Rank Create(
        string key, string nameAr, int level, ApplicableTo applicableTo,
        int sortOrder = 0, bool demoOrigin = false)
    {
        return new Rank
        {
            Id = Guid.NewGuid(),
            Key = key,
            NameAr = nameAr,
            Level = level,
            ApplicableTo = applicableTo,
            SortOrder = sortOrder,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            DemoOrigin = demoOrigin,
        };
    }

    public void Update(string? nameAr, int? level, ApplicableTo? applicableTo, int? sortOrder, bool? isActive)
    {
        if (nameAr is not null) NameAr = nameAr;
        if (level.HasValue) Level = level.Value;
        if (applicableTo.HasValue) ApplicableTo = applicableTo.Value;
        if (sortOrder.HasValue) SortOrder = sortOrder.Value;
        if (isActive.HasValue) IsActive = isActive.Value;
    }
}
