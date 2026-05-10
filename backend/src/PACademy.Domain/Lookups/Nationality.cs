namespace PACademy.Domain.Lookups;

public sealed class Nationality : LookupBase
{
    public string NameAr { get; private set; } = string.Empty;
    public string NameEn { get; private set; } = string.Empty;
    public string IsoCode { get; private set; } = string.Empty;

    private Nationality() { }

    public static Nationality Create(
        string key, string nameAr, string nameEn, string isoCode,
        int sortOrder = 0, bool demoOrigin = false)
    {
        return new Nationality
        {
            Id = Guid.NewGuid(),
            Key = key,
            NameAr = nameAr,
            NameEn = nameEn,
            IsoCode = isoCode,
            SortOrder = sortOrder,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            DemoOrigin = demoOrigin,
        };
    }

    public void Update(string? nameAr, string? nameEn, string? isoCode, int? sortOrder, bool? isActive)
    {
        if (nameAr is not null) NameAr = nameAr;
        if (nameEn is not null) NameEn = nameEn;
        if (isoCode is not null) IsoCode = isoCode;
        if (sortOrder.HasValue) SortOrder = sortOrder.Value;
        if (isActive.HasValue) IsActive = isActive.Value;
    }
}
