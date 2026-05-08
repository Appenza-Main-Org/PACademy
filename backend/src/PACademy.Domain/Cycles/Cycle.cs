using PACademy.Domain.Audit;
using PACademy.Domain.Common;

namespace PACademy.Domain.Cycles;

public sealed class Cycle : AggregateRoot<Guid>, IAuditableWrite, ISoftDeletable
{
    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public CycleStatus Status { get; private set; }
    public DateTime? OpenDate { get; private set; }
    public DateTime? CloseDate { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public Guid CreatedBy { get; private set; }
    public bool Archived { get; private set; }
    public DateTime? ArchivedAt { get; private set; }
    public bool DemoOrigin { get; private set; }

    private Cycle() { }

    public static Cycle Create(string name, Guid createdBy, bool demoOrigin = false)
    {
        return new Cycle
        {
            Id = Guid.NewGuid(),
            Name = name,
            Status = CycleStatus.Draft,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CreatedBy = createdBy,
            DemoOrigin = demoOrigin,
        };
    }
}
