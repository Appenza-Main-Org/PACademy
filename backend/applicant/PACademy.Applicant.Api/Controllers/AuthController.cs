using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PACademy.Modules.IdentityApplicant.Application.Auth;
using PACademy.Shared.Contracts;

namespace PACademy.Applicant.Api.Controllers;

/// <summary>
/// Applicant auth surface — NID + mobile direct lookup, no OTP.
///
/// Routes (matching <c>frontend/src/features/auth/api/auth.service.ts</c>):
///   POST /api/auth/login   → AuthUserDto + JWT
///   GET  /api/auth/me      → AuthUserDto (current applicant)
///   POST /api/auth/logout  → { ok: true }
/// </summary>
[ApiController]
[Route("api/auth")]
public sealed class AuthController(LoginUseCase login, GetMeUseCase getMe) : ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest body, CancellationToken ct)
    {
        var (ok, errorCode) = await login.ExecuteAsync(body, ct);

        if (errorCode == ErrorCodes.InvalidCredentials)
        {
            return Unauthorized(new
            {
                code = ErrorCodes.InvalidCredentials,
                message = "بيانات الدخول غير صحيحة. تأكد من الرقم القومي ورقم المحمول.",
            });
        }

        return Ok(ok);
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");
        if (!Guid.TryParse(sub, out var applicantId)) return Unauthorized();

        var me = await getMe.ExecuteAsync(applicantId, ct);
        return me is null ? Unauthorized() : Ok(me);
    }

    [HttpPost("logout")]
    [AllowAnonymous]
    public IActionResult Logout() => Ok(new { ok = true });
}
