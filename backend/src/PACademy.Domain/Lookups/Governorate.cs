namespace PACademy.Domain.Lookups;

public enum GovernorateRegion { Cairo, Delta, Canal, Upper, Frontier }

public sealed class Governorate : LookupBase
{
    public string NameAr { get; private set; } = string.Empty;
    public string NameEn { get; private set; } = string.Empty;
    public GovernorateRegion Region { get; private set; }

    private Governorate() { }

    public static Governorate Create(
        string key, string nameAr, string nameEn, GovernorateRegion region,
        int sortOrder = 0, bool demoOrigin = false)
    {
        return new Governorate
        {
            Id = Guid.NewGuid(),
            Key = key,
            NameAr = nameAr,
            NameEn = nameEn,
            Region = region,
            SortOrder = sortOrder,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            DemoOrigin = demoOrigin,
        };
    }

    public void Update(string? nameAr, string? nameEn, GovernorateRegion? region, int? sortOrder, bool? isActive)
    {
        if (nameAr is not null) NameAr = nameAr;
        if (nameEn is not null) NameEn = nameEn;
        if (region.HasValue) Region = region.Value;
        if (sortOrder.HasValue) SortOrder = sortOrder.Value;
        if (isActive.HasValue) IsActive = isActive.Value;
    }
}
