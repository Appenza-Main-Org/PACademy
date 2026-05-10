using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Security.Claims;
using System.Text.Encodings.Web;

namespace PACademy.Api.Tests.Fixtures;

/// <summary>
/// Test authentication handler — bypasses cookie auth and injects a fake admin
/// user so integration tests don't need to round-trip through /auth/login
/// (which doesn't exist until Phase 4 / US2).
///
/// Headers:
///   X-Test-User-Id    — Guid of the actor (defaults to a fixed test guid)
///   X-Test-User-Name  — display name (defaults to "Test Admin")
///   X-Test-User-Apps  — comma-separated app keys (defaults to "admin")
/// </summary>
public sealed class TestAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "Test";
    public static readonly Guid DefaultTestUserId = Guid.Parse("00000000-0000-0000-0000-000000000001");

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var userIdRaw = Request.Headers["X-Test-User-Id"].ToString();
        if (!Guid.TryParse(userIdRaw, out var userId)) userId = DefaultTestUserId;

        var userName = Request.Headers["X-Test-User-Name"].ToString();
        if (string.IsNullOrEmpty(userName)) userName = "Test Admin";

        var appsHeader = Request.Headers["X-Test-User-Apps"].ToString();
        var apps = string.IsNullOrEmpty(appsHeader)
            ? new[] { "admin" }
            : appsHeader.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Name, userName),
            // Grant super-admin wildcard by default so tests bypass permission checks.
            new("permissions", "*"),
        };
        foreach (var app in apps)
        {
            claims.Add(new Claim("apps", app));
        }

        // X-Test-Role header injects a ClaimTypes.Role claim so integration tests
        // can exercise Role:xxx policies without going through /auth/login.
        var roleHeader = Request.Headers["X-Test-Role"].ToString();
        if (!string.IsNullOrEmpty(roleHeader))
            claims.Add(new Claim(ClaimTypes.Role, roleHeader));

        // X-Test-Permissions overrides the default wildcard with specific permissions.
        var permsHeader = Request.Headers["X-Test-Permissions"].ToString();
        if (!string.IsNullOrEmpty(permsHeader))
        {
            claims.RemoveAll(c => c.Type == "permissions");
            foreach (var perm in permsHeader.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                claims.Add(new Claim("permissions", perm));
        }

        var identity = new ClaimsIdentity(claims, SchemeName);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, SchemeName);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
