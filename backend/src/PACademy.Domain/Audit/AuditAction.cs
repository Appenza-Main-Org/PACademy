namespace PACademy.Domain.Audit;

public enum AuditAction
{
    Create = 1,
    Update = 2,
    Delete = 3,
    Activate = 4,
    Deactivate = 5,
    Login = 6,
    Logout = 7,
    BulkImport = 8,
    StatusChange = 9,
    PermissionDenied = 10,
}
