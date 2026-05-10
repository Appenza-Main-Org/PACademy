namespace PACademy.Domain.Lookups;

public enum SpecialtyGender { Male, Female }

public sealed class Specialty : SimpleLookupBase
{
    public Guid SpecialtyTypeId { get; private set; }
    public SpecialtyGender? Gender { get; private set; }

    private Specialty() { }

    public static Specialty Create(
        string key, string labelAr, Guid specialtyTypeId,
        SpecialtyGender? gender = null, string? labelEn = null,
        int sortOrder = 0, bool isSystem = false, bool demoOrigin = false)
    {
        return new Specialty
        {
            Id = Guid.NewGuid(),
            Key = key, LabelAr = labelAr, LabelEn = labelEn,
            SpecialtyTypeId = specialtyTypeId, Gender = gender,
            SortOrder = sortOrder, IsActive = true, IsSystem = isSystem,
            CreatedAt = DateTime.UtcNow, DemoOrigin = demoOrigin,
        };
    }

    public void Update(
        string? labelAr, string? labelEn, Guid? specialtyTypeId,
        SpecialtyGender? gender, bool clearGender, int? sortOrder, bool? isActive)
    {
        UpdateBase(labelAr, labelEn, sortOrder, isActive);
        if (specialtyTypeId.HasValue) SpecialtyTypeId = specialtyTypeId.Value;
        if (clearGender) Gender = null;
        else if (gender.HasValue) Gender = gender.Value;
    }
}
