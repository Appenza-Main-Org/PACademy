namespace PACademy.Modules.Identity.Application.Authorization;

public sealed class PermissionEvaluator : IPermissionEvaluator
{
    public bool Has(IReadOnlyList<string> userPermissions, string required)
    {
        // 1. super-admin wildcard
        if (userPermissions.Contains("*")) return true;

        // 2. exact match
        if (userPermissions.Contains(required)) return true;

        // 3. resource wildcard: 'committees:*' matches 'committees:view', etc.
        var colonIndex = required.IndexOf(':');
        if (colonIndex < 0) return false;
        var resourcePrefix = required[..(colonIndex + 1)] + "*";
        return userPermissions.Contains(resourcePrefix);
    }
}
