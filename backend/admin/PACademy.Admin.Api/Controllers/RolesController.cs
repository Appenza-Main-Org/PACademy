using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using PACademy.Admin.Api.Modules.Identity;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("api/roles")]
public sealed class RolesController(RolesService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> List([FromQuery] bool includeDeleted, CancellationToken ct) =>
        Ok(await service.ListAsync(includeDeleted, ct));

    [HttpGet("{id}")]
    public async Task<ActionResult<JsonObject?>> Get(string id, CancellationToken ct)
    {
        var role = await service.GetByIdAsync(id, ct);
        return role is null ? NotFound() : Ok(role);
    }

    [HttpPost]
    public async Task<ActionResult<JsonObject>> Create([FromBody] JsonObject payload, CancellationToken ct) =>
        Ok(await service.CreateAsync(payload, ct));

    [HttpPatch("{id}")]
    public async Task<ActionResult<JsonObject>> Update(string id, [FromBody] JsonObject patch, CancellationToken ct) =>
        Ok(await service.UpdateAsync(id, patch, ct));

    [HttpGet("{id}/dependencies")]
    public async Task<ActionResult<object>> Dependencies(string id, CancellationToken ct) =>
        Ok(await service.DependenciesAsync(id, ct));

    [HttpPost("{id}/soft-delete")]
    public async Task<ActionResult<JsonObject>> SoftDelete(string id, CancellationToken ct) =>
        Ok(await service.UpdateAsync(id, new JsonObject { ["deletedAt"] = DateTimeOffset.UtcNow }, ct));

    [HttpPost("{id}/restore")]
    public async Task<ActionResult<JsonObject>> Restore(string id, CancellationToken ct) =>
        Ok(await service.UpdateAsync(id, new JsonObject { ["deletedAt"] = null }, ct));
}
