using Microsoft.AspNetCore.Http;
using PACademy.Modules.Identity.Application;
using PACademy.Shared.Contracts;
using System.Security.Claims;

namespace PACademy.Modules.Identity.Infrastructure;

internal sealed class HttpContextCurrentUser(IHttpContextAccessor httpContextAccessor)
    : ICurrentUser, ICurrentActor
{
    private ClaimsPrincipal? Principal => httpContextAccessor.HttpContext?.User;

    public Guid Id
    {
        get
        {
            var value = Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
            return Guid.TryParse(value, out var id) ? id : Guid.Empty;
        }
    }

    public string Name =>
        Principal?.FindFirstValue(ClaimTypes.Name) ?? string.Empty;

    public string IpAddress =>
        httpContextAccessor.HttpContext?.Connection.RemoteIpAddress?.ToString() ?? string.Empty;

    public string Role =>
        Principal?.FindFirstValue(ClaimTypes.Role) ?? string.Empty;

    public IReadOnlyList<string> Apps
    {
        get
        {
            var role = Role;
            return string.IsNullOrEmpty(role)
                ? Array.Empty<string>()
                : Application.RoleApps.ForRole(role);
        }
    }

    public bool IsAuthenticated =>
        Principal?.Identity?.IsAuthenticated ?? false;
}
