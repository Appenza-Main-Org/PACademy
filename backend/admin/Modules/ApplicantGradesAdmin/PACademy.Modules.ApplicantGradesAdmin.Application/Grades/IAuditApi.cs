namespace PACademy.Modules.ApplicantGradesAdmin.Application.Grades;

public enum AuditOutcome
{
    Success,
    Failure,
}

public interface IAuditApi
{
    Task RecordAsync(
        string action,
        string entityType,
        string actorId,
        string entityId,
        AuditOutcome outcome,
        string source,
        CancellationToken ct);
}
