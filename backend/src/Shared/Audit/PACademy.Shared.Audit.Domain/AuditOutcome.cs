namespace PACademy.Shared.Audit.Domain;

public enum AuditOutcome
{
    Success = 1,
    Failure = 2,
    PermissionDenied = 3,
    ValidationError = 4,
    NotFound = 5,
    Conflict = 6,
    ServerError = 7,
}
