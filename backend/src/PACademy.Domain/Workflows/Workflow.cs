using PACademy.Domain.Audit;
using PACademy.Domain.Common;

namespace PACademy.Domain.Workflows;

public sealed class Workflow : AggregateRoot<Guid>, IAuditableWrite, ISoftDeletable
{
    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public string? StepsJson { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public Guid CreatedBy { get; private set; }
    public bool Archived { get; private set; }
    public DateTime? ArchivedAt { get; private set; }
    public bool DemoOrigin { get; private set; }

    private Workflow() { }

    public static Workflow Create(string name, Guid createdBy, bool demoOrigin = false)
    {
        return new Workflow
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
