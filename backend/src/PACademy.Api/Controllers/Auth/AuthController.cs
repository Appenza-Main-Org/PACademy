using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using PACademy.Infrastructure.Identity;
using PACademy.Modules.Identity.Application;
using PACademy.Modules.Identity.Application.Auth;
using PACademy.Modules.Identity.Infrastructure.Otp;
using PACademy.Shared.Contracts;
using System.Security.Claims;

namespace PACademy.Api.Controllers.Auth;

[ApiController]
[Route("auth")]
public sealed class AuthController(
    LogoutUseCase logout,
    GetMeUseCase getMe,
    RequestOtpUseCase requestOtp,
    VerifyOtpUseCase verifyOtp,
    UserManager<SystemUser> userManager,
    SignInManager<SystemUser> signInManager,
    ICurrentUser currentUser,
    IWebHostEnvironment env)
    : ControllerBase
{
    // ─── Legacy single-step login — 410 GONE post-cutover (T467) ─────────────
    [HttpPost("login")]
    [AllowAnonymous]
    public IActionResult Login() =>
        StatusCode(StatusCodes.Status410Gone, new
        {
            code = ErrorCodes.Deprecated,
            message = "Use /auth/login/request-otp + /auth/login/verify-otp",
        });

    // ─── US1: Step 1 — Request OTP ──────────────────────────────────────────
    [HttpPost("login/request-otp")]
    [AllowAnonymous]
    public async Task<IActionResult> RequestOtp(
        [FromBody] RequestOtpRequest request,
        CancellationToken ct)
    {
        var (ok, errorCode, locked) = await requestOtp.ExecuteAsync(
            request.NationalId, request.Password, ct);

        if (errorCode == ErrorCodes.AccountLocked && locked is not null)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                code = ErrorCodes.AccountLocked,
                message = "الحساب موقوف. تواصل مع إدارة المنظومة لإعادة التفعيل.",
                payload = new { unlocksAt = locked.UnlocksAt, reason = locked.Reason },
            });
        }

        if (errorCode == ErrorCodes.InvalidCredentials)
        {
            return Unauthorized(new
            {
                code = ErrorCodes.InvalidCredentials,
                message = "بيانات الدخول غير صحيحة",
            });
        }

        if (ok is null) return BadRequest();

        return Ok(new
        {
            pendingId = ok.PendingId,
            otpDevice = ok.OtpDevice,
            otpExpiresAt = ok.OtpExpiresAt,
        });
    }

    // ─── US1: Step 2 — Verify OTP ───────────────────────────────────────────
    [HttpPost("login/verify-otp")]
    [AllowAnonymous]
    public async Task<IActionResult> VerifyOtp(
        [FromBody] VerifyOtpRequest request,
        CancellationToken ct)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? string.Empty;
        var ua = Request.Headers.UserAgent.ToString();

        var (ok, errorCode, remaining, locked) = await verifyOtp.ExecuteAsync(
            request.PendingId, request.Code, ip, ua, ct);

        if (errorCode == ErrorCodes.OtpReused)
            return BadRequest(new { code = ErrorCodes.OtpReused, message = "رمز التحقق مستخدم مسبقاً. أعد طلب رمز جديد." });

        if (errorCode == ErrorCodes.OtpExpired)
            return BadRequest(new { code = ErrorCodes.OtpExpired, message = "انتهت صلاحية رمز التحقق. أعد طلب رمز جديد." });

        if (errorCode == ErrorCodes.OtpMismatch)
            return BadRequest(new
            {
                code = ErrorCodes.OtpMismatch,
                message = "رمز التحقق غير صحيح",
                payload = new { remainingAttempts = remaining },
            });

        if (errorCode == ErrorCodes.AccountLocked && locked is not null)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                code = ErrorCodes.AccountLocked,
                message = "الحساب موقوف. تواصل مع إدارة المنظومة لإعادة التفعيل.",
                payload = new { unlocksAt = locked.UnlocksAt, reason = locked.Reason },
            });
        }

        if (ok is null) return BadRequest();

        // Issue the session cookie
        var user = await userManager.FindByIdAsync(ok.UserId.ToString());
        if (user is null) return Unauthorized();

        var principal = await signInManager.CreateUserPrincipalAsync(user);
        var identity = (ClaimsIdentity)principal.Identity!;
        identity.AddClaim(new Claim("sid", ok.SessionId.ToString()));
        identity.AddClaim(new Claim(ClaimTypes.Role, ok.Role));
        foreach (var app in ok.Apps)
            identity.AddClaim(new Claim("apps", app));
        foreach (var perm in ok.Permissions)
            identity.AddClaim(new Claim("permissions", perm));

        await HttpContext.SignInAsync(IdentityConstants.ApplicationScheme, principal);

        return Ok(new
        {
            userId = ok.UserId,
            nationalId = ok.NationalId,
            fullName = ok.FullName,
            role = ok.Role,
            roleLabel = ok.RoleLabel,
            unit = ok.Unit,
            apps = ok.Apps,
            permissions = ok.Permissions,
            token = string.Empty,
        });
    }

    // ─── Logout ──────────────────────────────────────────────────────────────
    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        await logout.ExecuteAsync(currentUser.Id, ct);
        await HttpContext.SignOutAsync(IdentityConstants.ApplicationScheme);
        return NoContent();
    }

    // ─── Me ──────────────────────────────────────────────────────────────────
    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var me = await getMe.ExecuteAsync(currentUser.Id, ct);
        if (me is null)
        {
            return Unauthorized(new
            {
                code = ErrorCodes.Unauthenticated,
                message = "Authentication required",
            });
        }

        return Ok(new
        {
            userId = me.UserId,
            nationalId = me.NationalId,
            fullName = me.FullName,
            role = me.Role,
            apps = me.Apps,
            permissions = me.Permissions,
        });
    }

    // ─── Dev-only OTP peek (demo helper) ─────────────────────────────────────
    // Exposes the OTP code dispatched by InMemoryOtpTransport so demo
    // walkthroughs don't have to scrape the API console. Returns 404 in any
    // environment other than Development / Testing — the real SMS transport
    // never populates the in-memory store, so production is safe by
    // construction, and we add the env guard as a second belt.
    [HttpGet("dev/otp-peek")]
    [AllowAnonymous]
    public IActionResult PeekOtp([FromQuery] string phoneTail)
    {
        if (env.EnvironmentName is not ("Development" or "Testing"))
            return NotFound();

        var code = InMemoryOtpTransport.PeekCode(phoneTail);
        return code is null ? NotFound() : Ok(new { code });
    }
}

public sealed record RequestOtpRequest(string NationalId, string Password);
public sealed record VerifyOtpRequest(Guid PendingId, string Code);
