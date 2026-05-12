namespace PACademy.Domain.Lookups;

public sealed class MaritalStatus : SimpleLookupBase
{
    private MaritalStatus() { }

    public static MaritalStatus Create(
        string key, string labelAr, string? labelEn = null,
        int sortOrder = 0, bool isSystem = false, bool demoOrigin = false)
    {
        return new MaritalStatus
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
