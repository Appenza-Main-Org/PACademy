namespace PACademy.Domain.Lookups;

public sealed class Job : SimpleLookupBase
{
    private Job() { }

    public static Job Create(
        string key, string labelAr, string? labelEn = null,
        int sortOrder = 0, bool isSystem = false, bool demoOrigin = false)
    {
        return new Job
        {
            Id = Guid.NewGuid(),
            Key = key,
            LabelAr = labelAr,
            LabelEn = labelEn,
            SortOrder = sortOrder,
            IsActive = true,
            IsSystem = isSystem,
            CreatedAt = DateTime.UtcNow,
            DemoOrigin = demoOrigin,
        };
    }

    public void Update(string? labelAr, string? labelEn, int? sortOrder, bool? isActive)
        => UpdateBase(labelAr, labelEn, sortOrder, isActive);
}
