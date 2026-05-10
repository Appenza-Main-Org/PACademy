namespace PACademy.Modules.Identity.Application.Authorization;

public interface IPermissionEvaluator
{
    bool Has(IReadOnlyList<string> userPermissions, string required);
}
