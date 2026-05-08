using PACademy.Domain.Audit;
using PACademy.Domain.Common;

namespace PACademy.Domain.AdmissionRules;

public sealed class AdmissionRule : AggregateRoot<Guid>, IAuditableWrite, ISoftDeletable
{
    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public string? RulesJson { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public Guid CreatedBy { get; private set; }
    public bool Archived { get; private set; }
    public DateTime? ArchivedAt { get; private set; }
    public bool DemoOrigin { get; private set; }

    private AdmissionRule() { }

    public static AdmissionRule Create(string name, Guid createdBy, bool demoOrigin = false)
    {
        return new AdmissionRule
        {
            Id = Guid.NewGuid(),
            Name = name,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CreatedBy = createdBy,
            DemoOrigin = demoOrigin,
        };
    }
}
