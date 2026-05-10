namespace PACademy.Domain.Lookups;

public enum FacultyType { Civil, Military, Sciences }

public sealed class Specialization : LookupBase
{
    public string NameAr { get; private set; } = string.Empty;
    public string Code { get; private set; } = string.Empty;
    public FacultyType FacultyType { get; private set; }

    private Specialization() { }

    public static Specialization Create(
        string key, string nameAr, string code, FacultyType facultyType,
        int sortOrder = 0, bool demoOrigin = false)
    {
        return new Specialization
        {
            Id = Guid.NewGuid(),
            Key = key,
            NameAr = nameAr,
            Code = code,
            FacultyType = facultyType,
            SortOrder = sortOrder,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            DemoOrigin = demoOrigin,
        };
    }

    public void Update(string? nameAr, string? code, FacultyType? facultyType, int? sortOrder, bool? isActive)
    {
        if (nameAr is not null) NameAr = nameAr;
        if (code is not null) Code = code;
        if (facultyType.HasValue) FacultyType = facultyType.Value;
        if (sortOrder.HasValue) SortOrder = sortOrder.Value;
        if (isActive.HasValue) IsActive = isActive.Value;
    }
}
