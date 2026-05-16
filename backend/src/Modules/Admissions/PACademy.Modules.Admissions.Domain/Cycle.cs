namespace PACademy.Modules.Admissions.Domain;

public sealed class Cycle
{
    public Guid Id { get; private set; }
    public string NameAr { get; private set; } = string.Empty;
    public int Year { get; private set; }
    public string Cohort { get; private set; } = string.Empty;
    public CycleStatus Status { get; private set; }
    public DateTime OpenDate { get; private set; }
    public DateTime CloseDate { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public Guid CreatedBy { get; private set; }
    public bool Archived { get; private set; }
    public DateTime? ArchivedAt { get; private set; }
    public bool DemoOrigin { get; private set; }
    public string OpenCategoriesJson { get; private set; } = "{}";
    public string ConditionOverridesJson { get; private set; } = "{}";
    public byte[] RowVersion { get; private set; } = [];

    private Cycle() { }

    public static Cycle Create(
        string nameAr,
        int year,
        string cohort,
        DateTime openDate,
        DateTime closeDate,
        Guid createdBy,
        CycleStatus status = CycleStatus.Draft,
        bool demoOrigin = false)
    {
        return new Cycle
        {
            Id = Guid.NewGuid(),
            NameAr = nameAr,
            Year = year,
            Cohort = cohort,
            Status = status,
            OpenDate = openDate,
            CloseDate = closeDate,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CreatedBy = createdBy,
            DemoOrigin = demoOrigin,
        };
    }

    public void Update(
        string? nameAr,
        DateTime? openDate,
        DateTime? closeDate,
        string? openCategoriesJson,
        string? conditionOverridesJson)
    {
        if (nameAr is not null) NameAr = nameAr;
        if (openDate is not null) OpenDate = openDate.Value;
        if (closeDate is not null) CloseDate = closeDate.Value;
        if (openCategoriesJson is not null) OpenCategoriesJson = openCategoriesJson;
        if (conditionOverridesJson is not null) ConditionOverridesJson = conditionOverridesJson;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetStatus(CycleStatus newStatus)
    {
        Status = newStatus;
        UpdatedAt = DateTime.UtcNow;
        if (newStatus == CycleStatus.Archived)
        {
            Archived = true;
            ArchivedAt = DateTime.UtcNow;
        }
    }
}
