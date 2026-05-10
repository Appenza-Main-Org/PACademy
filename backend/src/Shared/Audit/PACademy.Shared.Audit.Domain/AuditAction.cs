namespace PACademy.Shared.Audit.Domain;

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
    Archive = 11,
    View = 12,
    Export = 13,

    // Spec 007 — Auth + RBAC
    RequestOtp = 14,
    VerifyOtpSuccess = 15,
    VerifyOtpFailed = 16,
    AccountLocked = 17,
    LockoutAutoCleared = 18,
    ManualUnlock = 19,
    LockPolicyUpdated = 20,
    OfficerLookedUp = 21,
}
