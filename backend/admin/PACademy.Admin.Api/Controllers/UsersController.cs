using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using PACademy.Admin.Api.Modules.Identity;

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
    public async Task<ActionResult<JsonObject>> Status(string id, [FromBody] JsonObject body, CancellationToken ct) =>
        Ok(await service.UpdateAsync(id, new JsonObject { ["accountStatus"] = body["status"]?.DeepClone() ?? body["next"]?.DeepClone() ?? "active" }, ct));

    [HttpPost("{id}/deactivate")]
    public async Task<ActionResult<JsonObject>> Deactivate(string id, CancellationToken ct) =>
        Ok(await service.UpdateAsync(id, new JsonObject { ["accountStatus"] = "inactive" }, ct));

    [HttpPost("{id}/reset-2fa")]
    public ActionResult<object> Reset2Fa(string id) => Ok(new { ok = true });

    [HttpPost("bulk-assign")]
    public ActionResult<object> BulkAssign() => Ok(new { updated = 0 });

    [HttpPost("bulk-import")]
    public ActionResult<object> BulkImport() => Ok(new { created = 0, updated = 0, skipped = 0, errors = Array.Empty<object>() });

    [HttpPost("from-template")]
    public ActionResult<object> FromTemplate([FromBody] JsonObject body) => Ok(body);

    [HttpGet("{id}/activity")]
    public async Task<ActionResult<IReadOnlyList<object>>> Activity(string id, CancellationToken ct) =>
        Ok(await service.ActivityAsync(id, ct));
}
