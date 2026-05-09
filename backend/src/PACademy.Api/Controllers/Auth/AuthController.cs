using FluentValidation;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using PACademy.Application.Audit;
using PACademy.Application.Auth;
using PACademy.Application.Common;
using PACademy.Application.Identity;
using PACademy.Contracts.Auth;
using PACademy.Domain.Audit;
using PACademy.Infrastructure.Identity;
using System.Security.Claims;

namespace PACademy.Api.Controllers.Auth;

[ApiController]
[Route("auth")]
public sealed class AuthController(
    LoginUseCase login,
    LogoutUseCase logout,
    GetMeUseCase getMe,
    IValidator<LoginRequest> validator,
    UserManager<SystemUser> userManager,
    SignInManager<SystemUser> signInManager,
    ICurrentUser currentUser,
    IAuditWriter audit,
    IPaDbContext db)
    : ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login(
        [FromBody] LoginRequest request,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            throw new ValidationException(validation.Errors);
        }

        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? string.Empty;
        var ua = Request.Headers.UserAgent.ToString();

        var result = await login.ExecuteAsync(request.NationalId, request.Password, ip, ua, ct);

        if (result.Outcome == AuthenticationOutcome.ArchivedOrDeactivated)
        {
            // FR-A09: audit the blocked attempt — identity known, access denied
            await audit.RecordAsync(
                AuditAction.Login, "user", Guid.Empty, request.NationalId,
                AuditOutcome.PermissionDenied, null, null, ct);
            await db.SaveChangesAsync(ct);
            return Unauthorized(new
            {
                code = "INVALID_CREDENTIALS",
                message = "بيانات الدخول غير صحيحة.",
            });
        }

        if (result.Outcome != AuthenticationOutcome.Success)
        {
            return Unauthorized(new
            {
                code = "INVALID_CREDENTIALS",
                message = "بيانات الدخول غير صحيحة.",
            });
        }

        var user = await userManager.FindByIdAsync(result.UserId.ToString())
            ?? throw new InvalidOperationException("Authenticated user vanished between AuthenticateAsync and SignInAsync.");

        var principal = await signInManager.CreateUserPrincipalAsync(user);
        var identity = (ClaimsIdentity)principal.Identity!;
        identity.AddClaim(new Claim("sid", result.SessionId.ToString()));
        identity.AddClaim(new Claim(ClaimTypes.Role, result.Role));
        foreach (var app in result.Apps)
        {
            identity.AddClaim(new Claim("apps", app));
        }

        await HttpContext.SignInAsync(IdentityConstants.ApplicationScheme, principal);

        // FR-A09: audit successful login
        await audit.RecordAsync(
            AuditAction.Login, "user", result.UserId, result.FullName,
            AuditOutcome.Success, null, null, ct);
        await db.SaveChangesAsync(ct);

        return Ok(new LoginResponse(
            result.UserId, result.NationalId, result.FullName, result.Role, result.Apps));
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        // FR-A08: revoke all sessions for the user (not just the current one)
        await logout.ExecuteAsync(currentUser.Id, ct);
        await HttpContext.SignOutAsync(IdentityConstants.ApplicationScheme);
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<MeResponse>> Me(CancellationToken ct)
    {
        var me = await getMe.ExecuteAsync(currentUser.Id, ct);
        return me is null ? Unauthorized() : Ok(me);
    }
}
