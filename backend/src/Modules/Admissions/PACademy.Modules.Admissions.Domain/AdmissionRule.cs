namespace PACademy.Modules.Admissions.Domain;

public sealed class AdmissionRule
{
    public Guid Id { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public Guid? CycleId { get; private set; }
    public int Version { get; private set; }
    public DateTime EffectiveAt { get; private set; }
    public Guid ChangedById { get; private set; }
    public string RulesJson { get; private set; } = "{}";
    public bool IsActive { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public Guid CreatedBy { get; private set; }
    public bool Archived { get; private set; }
    public DateTime? ArchivedAt { get; private set; }
    public bool DemoOrigin { get; private set; }

    private AdmissionRule() { }

    public static AdmissionRule Create(
        string name,
        Guid createdBy,
        Guid? cycleId = null,
        int version = 1,
        string? rulesJson = null,
        string? description = null,
        DateTime? effectiveAt = null,
        bool demoOrigin = false)
    {
        var now = DateTime.UtcNow;
        return new AdmissionRule
        {
            Id = Guid.NewGuid(),
            Name = name,
            Description = description,
            CycleId = cycleId,
            Version = version,
            EffectiveAt = effectiveAt ?? now,
            ChangedById = createdBy,
            RulesJson = rulesJson ?? "{}",
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now,
            CreatedBy = createdBy,
            DemoOrigin = demoOrigin,
        };
    }
}
