namespace PACademy.Domain.Lookups;

public enum CaseSeverity { Low, Medium, High }

public sealed class CaseType : LookupBase
{
    public string NameAr { get; private set; } = string.Empty;
    public CaseSeverity Severity { get; private set; }
    public bool BlocksApplication { get; private set; }

    private CaseType() { }

    public static CaseType Create(
        string key, string nameAr, CaseSeverity severity, bool blocksApplication,
        int sortOrder = 0, bool demoOrigin = false)
    {
        return new CaseType
        {
            Id = Guid.NewGuid(),
            Key = key,
            NameAr = nameAr,
            Severity = severity,
            BlocksApplication = blocksApplication,
            SortOrder = sortOrder,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            DemoOrigin = demoOrigin,
        };
    }

    public void Update(string? nameAr, CaseSeverity? severity, bool? blocksApplication, int? sortOrder, bool? isActive)
    {
        if (nameAr is not null) NameAr = nameAr;
        if (severity.HasValue) Severity = severity.Value;
        if (blocksApplication.HasValue) BlocksApplication = blocksApplication.Value;
        if (sortOrder.HasValue) SortOrder = sortOrder.Value;
        if (isActive.HasValue) IsActive = isActive.Value;
    }
}
