using PACademy.Modules.ApplicantGradesAdmin.Application.Grades;

namespace PACademy.Modules.ApplicantGradesAdmin.Infrastructure;

public sealed class NoopAuditApi : IAuditApi
{
    public Task RecordAsync(
        string action,
        string entityType,
        string actorId,
        string entityId,
        AuditOutcome outcome,
        string source,
        CancellationToken ct)
        => Task.CompletedTask;
}
