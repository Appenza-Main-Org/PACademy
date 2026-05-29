using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Infrastructure;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class RequireBearerAuthAttribute : Attribute, IAsyncAuthorizationFilter
{
    public Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var authorization = context.HttpContext.Request.Headers.Authorization.ToString();
        if (!authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ||
            string.IsNullOrWhiteSpace(authorization["Bearer ".Length..]))
        {
            context.Result = new UnauthorizedObjectResult(new ApiErrorEnvelope(
                "AUTH_REQUIRED",
                Message: "يلزم تسجيل الدخول للوصول إلى هذا الإجراء"));
        }

        return Task.CompletedTask;
    }
}
