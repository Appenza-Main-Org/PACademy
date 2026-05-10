namespace PACademy.Domain.Lookups;

public enum QualificationLevel { Diploma, Bachelor, Master, Phd }

public sealed class Qualification : LookupBase
{
    public string NameAr { get; private set; } = string.Empty;
    public QualificationLevel Level { get; private set; }
    public bool FacultyRequired { get; private set; }

    private Qualification() { }

    public static Qualification Create(
        string key, string nameAr, QualificationLevel level, bool facultyRequired,
        int sortOrder = 0, bool demoOrigin = false)
    {
        return new Qualification
        {
            Id = Guid.NewGuid(),
            Key = key,
            NameAr = nameAr,
            Level = level,
            FacultyRequired = facultyRequired,
            SortOrder = sortOrder,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            DemoOrigin = demoOrigin,
        };
    }

    public void Update(string? nameAr, QualificationLevel? level, bool? facultyRequired, int? sortOrder, bool? isActive)
    {
        if (nameAr is not null) NameAr = nameAr;
        if (level.HasValue) Level = level.Value;
        if (facultyRequired.HasValue) FacultyRequired = facultyRequired.Value;
        if (sortOrder.HasValue) SortOrder = sortOrder.Value;
        if (isActive.HasValue) IsActive = isActive.Value;
    }
}
