using Microsoft.AspNetCore.Http;
using PACademy.Application.Common;
using System.Security.Claims;

namespace PACademy.Infrastructure.Identity;

internal sealed class HttpContextCurrentUser(IHttpContextAccessor httpContextAccessor) : ICurrentUser
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

    public bool IsAuthenticated =>
        Principal?.Identity?.IsAuthenticated ?? false;
}
