using FluentValidation;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using PACademy.Application.Auth;
using PACademy.Application.Common;
using PACademy.Contracts.Auth;
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
    ICurrentUser currentUser)
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
        if (!result.Succeeded)
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

        return Ok(new LoginResponse(
            result.UserId, result.NationalId, result.FullName, result.Role, result.Apps));
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        var sidClaim = User.FindFirstValue("sid");
        if (Guid.TryParse(sidClaim, out var sessionId))
        {
            await logout.ExecuteAsync(sessionId, ct);
        }

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
