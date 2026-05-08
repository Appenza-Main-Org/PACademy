namespace PACademy.Domain.Identity;

/// <summary>
/// FR-005a: Prevents deactivation of the last active super-admin.
/// Pure domain rule — takes the current count and returns allow/deny with reason.
/// </summary>
public static class SuperAdminFloorPolicy
{
    public static PolicyResult Check(int activeSupAdminCount)
    {
        if (activeSupAdminCount <= 1)
            return PolicyResult.Deny("يجب أن يبقى مدير نظام رئيسي واحد على الأقل نشطاً.");

        return PolicyResult.Allow();
    }
}

public sealed class PolicyResult
{
    public bool IsAllowed { get; }
    public string? DenyReason { get; }

    private PolicyResult(bool isAllowed, string? denyReason)
    {
        IsAllowed = isAllowed;
        DenyReason = denyReason;
    }

    public static PolicyResult Allow() => new(true, null);
    public static PolicyResult Deny(string reason) => new(false, reason);
}
