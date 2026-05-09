namespace PACademy.Modules.Admissions.Domain;

public sealed class Category
{
    public Guid Id { get; private set; }
    public string Key { get; private set; } = string.Empty;
    public string NameAr { get; private set; } = string.Empty;
    public string? NameEn { get; private set; }
    public string? Description { get; private set; }
    public string ConditionsJson { get; private set; } = "{}";
    public string RequiredTestsJson { get; private set; } = "[]";
    public string ProceduresJson { get; private set; } = "[]";
    public int SortOrder { get; private set; }
    public bool IsActive { get; private set; }
    public bool IsSpec { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public bool Archived { get; private set; }
    public DateTime? ArchivedAt { get; private set; }
    public bool DemoOrigin { get; private set; }

    private Category() { }

    public static Category Create(
        string key,
        string nameAr,
        Guid createdBy,
        string? nameEn = null,
        string? description = null,
        string? conditionsJson = null,
        string? requiredTestsJson = null,
        string? proceduresJson = null,
        int sortOrder = 0,
        bool isSpec = false,
        bool demoOrigin = false)
    {
        return new Category
        {
            Id = Guid.NewGuid(),
            Key = key,
            NameAr = nameAr,
            NameEn = nameEn,
            Description = description,
            ConditionsJson = conditionsJson ?? "{}",
            RequiredTestsJson = requiredTestsJson ?? "[]",
            ProceduresJson = proceduresJson ?? "[]",
            SortOrder = sortOrder,
            IsActive = true,
            IsSpec = isSpec,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            DemoOrigin = demoOrigin,
        };
    }

    public void Update(
        string? nameAr,
        string? nameEn,
        string? description,
        string? conditionsJson,
        string? requiredTestsJson,
        string? proceduresJson,
        int? sortOrder,
        bool? isActive)
    {
        if (nameAr is not null && !IsSpec) NameAr = nameAr;
        if (nameEn is not null) NameEn = nameEn;
        if (description is not null) Description = description;
        if (conditionsJson is not null) ConditionsJson = conditionsJson;
        if (requiredTestsJson is not null) RequiredTestsJson = requiredTestsJson;
        if (proceduresJson is not null) ProceduresJson = proceduresJson;
        if (sortOrder is not null) SortOrder = sortOrder.Value;
        if (isActive is not null && !IsSpec) IsActive = isActive.Value;
        UpdatedAt = DateTime.UtcNow;
    }
}
