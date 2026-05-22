using System.Text;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.Identity;
using PACademy.Shared.Audit;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("")]
public sealed class AuthController(IIdentityDbContext db, IAuditSink auditSink) : ControllerBase
{
    [HttpPost("api/auth/login")]
    [HttpPost("api/auth/login/verify-otp")]
    public async Task<ActionResult<object>> Login([FromBody] JsonObject body, CancellationToken ct)
    {
        var nationalId = ReadString(body, "nationalId") ?? ReadString(body, "username");
        var mobile = ReadString(body, "mobileNumber") ?? ReadString(body, "mobile") ?? ReadString(body, "password");
        var requestedRole = ReadString(body, "role");
        if (!IsNationalId(nationalId))
        {
            return UnprocessableEntity(new ApiErrorEnvelope(
                ErrorCodes.ValidationFailed,
                Errors: new Dictionary<string, string[]> { ["nationalId"] = ["الرقم القومي يجب أن يكون 14 رقماً"] },
                Message: "تحقق من البيانات المدخلة"));
        }
        if (!IsMobile(mobile))
        {
            return UnprocessableEntity(new ApiErrorEnvelope(
                ErrorCodes.ValidationFailed,
                Errors: new Dictionary<string, string[]> { ["mobile"] = ["رقم المحمول غير صحيح"] },
                Message: "تحقق من البيانات المدخلة"));
        }

        var userRow = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.NationalId == nationalId, ct);
        if (userRow is null)
        {
            return Unauthorized(new ApiErrorEnvelope("AUTH_INVALID", Message: "بيانات الدخول غير صحيحة"));
        }

        var userJson = IdentityJson.Parse(userRow.PayloadJson);
        var registeredMobile = IdentityJson.StringProp(userJson, "mobileNumber");
        if (!SameDigits(registeredMobile, mobile))
        {
            return Unauthorized(new ApiErrorEnvelope("AUTH_INVALID", Message: "بيانات الدخول غير صحيحة"));
        }
        if (userRow.AccountStatus != "active")
        {
            return StatusCode(StatusCodes.Status403Forbidden, new ApiErrorEnvelope(
                "ACCOUNT_INACTIVE",
                Message: "الحساب غير مفعّل",
                Payload: new { userId = userRow.Id }));
        }
        if (!string.IsNullOrWhiteSpace(requestedRole) && requestedRole != userRow.Role)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new ApiErrorEnvelope(
                ErrorCodes.Forbidden,
                Message: "هذا الحساب غير مصرح له بالدخول إلى التطبيق المحدد"));
        }

        var roleRow = await db.Roles.AsNoTracking().FirstOrDefaultAsync(x => x.Key == userRow.Role, ct)
            ?? throw new EntityNotFoundException("الدور غير موجود");
        var roleJson = IdentityJson.Parse(roleRow.PayloadJson);
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
        await auditSink.EmitAsync(new AuditEntry(
            $"AUD-AUTH-{Guid.NewGuid():N}",
            "auth",
            "login",
            "users",
            userRow.Id,
            userRow.Id,
            userRow.FullArabicName,
            $"تسجيل دخول · {roleRow.LabelAr}",
            DateTimeOffset.UtcNow), ct);
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
    public async Task<ActionResult<IReadOnlyList<object>>> LockedUsers(CancellationToken ct)
    {
        var users = await db.Users.AsNoTracking().Where(x => x.AccountStatus == "locked").ToListAsync(ct);
        return Ok(users.Select(user =>
        {
            var payload = IdentityJson.Parse(user.PayloadJson);
            return new
            {
                userId = user.Id,
                name = user.FullArabicName,
                role = user.Role,
                reason = payload["lockReason"]?.GetValue<string>() ?? "تجاوز محاولات الدخول",
                lockedAt = payload["lockedAt"]?.GetValue<string>() ?? user.UpdatedAt.ToString("O"),
                unlocksAt = payload["unlocksAt"]?.GetValue<string?>()
            };
        }).ToList());
    }

    [HttpPost("api/auth/lock-policy/unlock")]
    public async Task<ActionResult<object>> Unlock([FromBody] JsonObject body, CancellationToken ct)
    {
        var userId = body["userId"]?.GetValue<string>() ?? throw new FluentValidation.ValidationException("userId مطلوب");
        var user = await db.Users.FirstOrDefaultAsync(x => x.Id == userId, ct)
            ?? throw new EntityNotFoundException("المستخدم غير موجود");
        var payload = IdentityJson.Parse(user.PayloadJson);
        payload["accountStatus"] = "active";
        payload["status"] = "active";
        payload["active"] = true;
        payload["unlockedAt"] = DateTimeOffset.UtcNow.ToString("O");
        payload["unlockReason"] = body["reason"]?.DeepClone();
        payload.Remove("lockedAt");
        payload.Remove("unlocksAt");
        payload.Remove("lockReason");
        user.AccountStatus = "active";
        user.PayloadJson = payload.ToJsonString(IdentityJson.Options);
        user.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        await auditSink.EmitAsync(new AuditEntry(
            $"AUD-AUTH-{Guid.NewGuid():N}",
            "auth",
            "account_unlocked",
            "users",
            user.Id,
            "system",
            "النظام",
            $"فتح قفل المستخدم · {user.FullArabicName}",
            DateTimeOffset.UtcNow), ct);
        return Ok(new { ok = true, userId = user.Id });
    }

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

    private static string? ReadString(JsonObject body, string key)
    {
        return body.TryGetPropertyValue(key, out var node) ? node?.GetValue<string>()?.Trim() : null;
    }

    private static bool IsNationalId(string? value) =>
        value is { Length: 14 } && value.All(char.IsDigit);

    private static bool IsMobile(string? value) =>
        value is { Length: 11 } &&
        value.StartsWith("01", StringComparison.Ordinal) &&
        value.All(char.IsDigit);

    private static bool SameDigits(string? left, string? right) =>
        !string.IsNullOrWhiteSpace(left) &&
        !string.IsNullOrWhiteSpace(right) &&
        new string(left.Where(char.IsDigit).ToArray()) == new string(right.Where(char.IsDigit).ToArray());
}
