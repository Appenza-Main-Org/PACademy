using System.Text;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.Identity;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("")]
public sealed class AuthController(IIdentityDbContext db) : ControllerBase
{
    [HttpPost("api/auth/login")]
    [HttpPost("api/auth/login/verify-otp")]
    public async Task<ActionResult<object>> Login([FromBody] JsonObject body, CancellationToken ct)
    {
        var role = body["role"]?.GetValue<string>() ?? "super_admin";
        var roleRow = await db.Roles.AsNoTracking().FirstOrDefaultAsync(x => x.Key == role, ct)
            ?? await db.Roles.AsNoTracking().FirstAsync(ct);
        var userRow = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Role == roleRow.Key, ct)
            ?? await db.Users.AsNoTracking().FirstAsync(ct);
        var roleJson = IdentityJson.Parse(roleRow.PayloadJson);
        var userJson = IdentityJson.Parse(userRow.PayloadJson);
        var authUser = new JsonObject
        {
            ["id"] = userRow.Id,
            ["name"] = userRow.FullArabicName,
            ["role"] = roleRow.Key,
            ["roleLabel"] = roleRow.LabelAr,
            ["apps"] = roleJson["apps"]?.DeepClone() ?? new JsonArray("admin"),
            ["permissions"] = roleJson["permissions"]?.DeepClone() ?? new JsonArray(),
            ["loggedInAt"] = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        };
        var token = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{userRow.Id}:{roleRow.Key}:{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}"));
        authUser["token"] = token;
        return Ok(authUser);
    }

    [HttpPost("api/auth/login/request-otp")]
    public ActionResult<object> RequestOtp([FromBody] JsonObject body) => Ok(new
    {
        pendingId = $"OTP-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
        username = body["username"]?.GetValue<string>() ?? "admin",
        role = body["role"]?.GetValue<string>() ?? "super_admin",
        otpDevice = "•••• 4521",
        expiresAt = DateTimeOffset.UtcNow.AddMinutes(5).ToUnixTimeMilliseconds(),
        devCode = "000000"
    });

    [HttpPost("api/auth/logout")]
    public ActionResult<object> Logout() => Ok(new { ok = true });

    [HttpGet("api/auth/me")]
    public async Task<ActionResult<object>> Me(CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().FirstAsync(ct);
        return Ok(new { id = user.Id, name = user.FullArabicName, role = user.Role });
    }

    [HttpGet("api/auth/lock-policy")]
    public ActionResult<object> LockPolicy() => Ok(new { lockDurationMinutes = 30 });

    [HttpPatch("api/auth/lock-policy")]
    public ActionResult<object> UpdateLockPolicy([FromBody] JsonObject body) => Ok(body);

    [HttpGet("api/auth/lock-policy/locked-users")]
    public ActionResult<IReadOnlyList<object>> LockedUsers() => Ok(Array.Empty<object>());

    [HttpPost("api/auth/lock-policy/unlock")]
    public ActionResult<object> Unlock() => Ok(new { ok = true });

    [HttpGet("v1/officers/lookup")]
    public async Task<ActionResult<object>> LookupOfficer([FromQuery] string? nationalId, [FromQuery] string? nid, [FromQuery] string? code, CancellationToken ct)
    {
        var resolvedNid = nationalId ?? nid;
        if (string.IsNullOrWhiteSpace(resolvedNid)) return BadRequest(new ApiErrorEnvelope("INVALID_NID", Message: "الرقم القومي مطلوب"));
        var query = db.Officers.AsNoTracking().Where(x => x.NationalId == resolvedNid);
        if (!string.IsNullOrWhiteSpace(code)) query = query.Where(x => x.OfficerCode == code);
        var officer = await query.FirstOrDefaultAsync(ct);
        if (officer is null) throw new EntityNotFoundException("لم يتم العثور على بيانات بهذا الرقم القومي");
        return Ok(new
        {
            officer.NationalId,
            officer.FullArabicName,
            officer.OfficerCode,
            officer.MobileNumber,
            officer.UserType
        });
    }
}
