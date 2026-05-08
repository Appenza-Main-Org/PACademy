namespace PACademy.Domain.Audit;

public enum AuditOutcome
{
    Success = 1,
    Failure = 2,
    PermissionDenied = 3,
    ValidationError = 4,
}
