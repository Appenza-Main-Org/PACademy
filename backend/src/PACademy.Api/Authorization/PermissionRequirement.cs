using Microsoft.AspNetCore.Authorization;
using PACademy.Modules.Identity.Application;
using PACademy.Modules.Identity.Application.Authorization;
using PACademy.Shared.Audit.Domain;
using PACademy.Shared.Audit.Public;

namespace PACademy.Api.Authorization;

public sealed record PermissionRequirement(string Required) : IAuthorizationRequirement;

public sealed class PermissionRequirementHandler(
    ICurrentUser currentUser,
    IPermissionEvaluator evaluator,
    IAuditApi audit)
    : AuthorizationHandler<PermissionRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context, PermissionRequirement requirement)
    {
        var permClaims = context.User.FindAll("permissions").Select(c => c.Value).ToList();

        if (evaluator.Has(permClaims, requirement.Required))
        {
            context.Succeed(requirement);
            return;
        }

        // Emit permission_denied audit
        var actorId = currentUser.Id;
        await audit.RecordAsync(
            AuditAction.PermissionDenied, "permission", actorId, requirement.Required,
            AuditOutcome.Failure);

        context.Fail();
    }
}
