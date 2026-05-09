namespace PACademy.Shared.Audit.Domain;

public sealed class AuditEntry
{
    public Guid Id { get; private set; }
    public Guid ActorId { get; private set; }
    public string ActorName { get; private set; } = string.Empty;
    public string ActorIp { get; private set; } = string.Empty;
    public AuditAction Action { get; private set; }
    public string TargetType { get; private set; } = string.Empty;
    public Guid TargetId { get; private set; }
    public string TargetLabel { get; private set; } = string.Empty;
    public AuditOutcome Outcome { get; private set; }
    public string? BeforeJson { get; private set; }
    public string? AfterJson { get; private set; }
    /// <summary>Self-referencing FK for bulk-op children (plan research §9).</summary>
    public Guid? BatchId { get; private set; }
    public AuditEntry? Batch { get; private set; }
    public IReadOnlyCollection<AuditEntry> Children { get; private set; } = [];
    public DateTime OccurredAt { get; private set; }
    public bool DemoOrigin { get; private set; }

    private AuditEntry() { }

    public static AuditEntry Create(
        Guid actorId, string actorName, string actorIp,
        AuditAction action, string targetType, Guid targetId, string targetLabel,
        AuditOutcome outcome,
        string? beforeJson = null, string? afterJson = null,
        Guid? batchId = null, bool demoOrigin = false)
    {
        return new AuditEntry
        {
            Id = Guid.NewGuid(),
            ActorId = actorId,
            ActorName = actorName,
            ActorIp = actorIp,
            Action = action,
            TargetType = targetType,
            TargetId = targetId,
            TargetLabel = targetLabel,
            Outcome = outcome,
            BeforeJson = beforeJson,
            AfterJson = afterJson,
            BatchId = batchId,
            OccurredAt = DateTime.UtcNow,
            DemoOrigin = demoOrigin,
        };
    }
}
