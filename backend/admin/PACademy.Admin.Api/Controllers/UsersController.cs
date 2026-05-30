using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using PACademy.Admin.Api.Infrastructure;
using PACademy.Admin.Api.Modules.Identity;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("api/users")]
public sealed class UsersController(UsersService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> List(CancellationToken ct) =>
        Ok(await service.ListAsync(ct));

    [HttpGet("{id}")]
    public async Task<ActionResult<JsonObject?>> Get(string id, CancellationToken ct)
    {
        var user = await service.GetByIdAsync(id, ct);
        return user is null ? NotFound() : Ok(user);
    }

    [HttpPost]
    public async Task<ActionResult<JsonObject>> Create([FromBody] JsonObject payload, CancellationToken ct) =>
        Ok(await service.CreateAsync(payload, ct));

    [HttpPatch("{id}")]
    public async Task<ActionResult<JsonObject>> Update(string id, [FromBody] JsonObject patch, CancellationToken ct) =>
        Ok(await service.UpdateAsync(id, patch, ct));

    [HttpPost("{id}/status")]
    [RequireBearerAuth]
    public async Task<ActionResult<JsonObject>> Status(string id, [FromBody] JsonObject body, CancellationToken ct) =>
        Ok(await service.UpdateAsync(id, new JsonObject { ["accountStatus"] = body["status"]?.DeepClone() ?? body["next"]?.DeepClone() ?? "active" }, ct));

    [HttpGet("{id}/status")]
    [RequireBearerAuth]
    public async Task<ActionResult<object>> GetStatus(string id, CancellationToken ct)
    {
        var user = await service.GetByIdAsync(id, ct);
        if (user is null) return NotFound(new ApiErrorEnvelope(ErrorCodes.NotFound, Message: "المستخدم غير موجود"));
        return Ok(new
        {
            id,
            status = user["accountStatus"]?.GetValue<string?>() ?? user["status"]?.GetValue<string?>() ?? "active"
        });
    }

    [HttpPost("{id}/deactivate")]
    public async Task<ActionResult<JsonObject>> Deactivate(string id, CancellationToken ct) =>
        Ok(await service.UpdateAsync(id, new JsonObject { ["accountStatus"] = "inactive" }, ct));

    [HttpPost("{id}/reset-2fa")]
    public async Task<ActionResult<object>> Reset2Fa(string id, CancellationToken ct) =>
        Ok(await service.Reset2FaAsync(id, ct));

    [HttpPost("bulk-assign")]
    public async Task<ActionResult<object>> BulkAssign([FromBody] JsonObject body, CancellationToken ct) =>
        Ok(await service.BulkAssignAsync(body, ct));

    [HttpPost("bulk-import")]
    public async Task<ActionResult<object>> BulkImport([FromBody] JsonArray rows, CancellationToken ct) =>
        Ok(await service.BulkImportAsync(rows, ct));

    [HttpPost("from-template")]
    public ActionResult<object> FromTemplate([FromBody] JsonObject body) => Ok(body);

    [HttpGet("{id}/activity")]
    public async Task<ActionResult<IReadOnlyList<object>>> Activity(string id, CancellationToken ct) =>
        Ok(await service.ActivityAsync(id, ct));

    /// <summary>Self-service password change. The caller may only change their own password.</summary>
    [HttpPost("{id}/password")]
    [RequireBearerAuth]
    public async Task<ActionResult<object>> ChangePassword(string id, [FromBody] JsonObject body, CancellationToken ct)
    {
        var actor = AuthActor.FromRequest(Request);
        if (actor is null)
            return Unauthorized(new ApiErrorEnvelope("UNAUTHENTICATED", Message: "يتطلب تسجيل الدخول"));
        if (!actor.IsSuperAdmin && !string.Equals(actor.UserId, id, StringComparison.Ordinal))
            return StatusCode(StatusCodes.Status403Forbidden, new ApiErrorEnvelope(
                "FORBIDDEN", Message: "لا يمكنك تغيير كلمة مرور مستخدم آخر"));

        var currentPassword = body["currentPassword"]?.GetValue<string>() ?? "";
        var newPassword = body["newPassword"]?.GetValue<string>() ?? "";
        return Ok(await service.ChangePasswordAsync(id, currentPassword, newPassword, ct));
    }

    /// <summary>Super-admin password reset. Sets the supplied password or generates one.</summary>
    [HttpPost("{id}/password/reset")]
    [RequireBearerAuth]
    public async Task<ActionResult<object>> ResetPassword(string id, [FromBody] JsonObject? body, CancellationToken ct)
    {
        var actor = AuthActor.FromRequest(Request);
        if (actor is null)
            return Unauthorized(new ApiErrorEnvelope("UNAUTHENTICATED", Message: "يتطلب تسجيل الدخول"));
        if (!actor.IsSuperAdmin)
            return StatusCode(StatusCodes.Status403Forbidden, new ApiErrorEnvelope(
                "FORBIDDEN", Message: "إعادة تعيين كلمة المرور مقصورة على مدير النظام الرئيسي"));

        var newPassword = body?["newPassword"]?.GetValue<string>();
        return Ok(await service.ResetPasswordAsync(id, newPassword, ct));
    }
}
