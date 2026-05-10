namespace PACademy.Domain.Lookups;

public sealed class Faculty : SimpleLookupBase
{
    public Guid UniversityId { get; private set; }

    private Faculty() { }

    public static Faculty Create(
        string key, string labelAr, Guid universityId, string? labelEn = null,
        int sortOrder = 0, bool isSystem = false, bool demoOrigin = false)
    {
        return new Faculty
        {
            Id = Guid.NewGuid(),
            Key = key, LabelAr = labelAr, LabelEn = labelEn,
            UniversityId = universityId,
            SortOrder = sortOrder, IsActive = true, IsSystem = isSystem,
            CreatedAt = DateTime.UtcNow, DemoOrigin = demoOrigin,
        };
    }

    public void Update(string? labelAr, string? labelEn, Guid? universityId, int? sortOrder, bool? isActive)
    {
        UpdateBase(labelAr, labelEn, sortOrder, isActive);
        if (universityId.HasValue) UniversityId = universityId.Value;
    }
}
