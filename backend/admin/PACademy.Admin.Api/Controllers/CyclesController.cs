using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using PACademy.Admin.Api.Modules.Admissions;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("api/cycles")]
public sealed class CyclesController(CyclesService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> List([FromQuery] bool includeDeleted, CancellationToken ct) =>
        Ok(await service.ListAsync(includeDeleted, ct));

    [HttpGet("active")]
    public async Task<ActionResult<JsonObject?>> Active(CancellationToken ct) =>
        Ok(await service.GetActiveAsync(ct));

    [HttpGet("{id}")]
    public async Task<ActionResult<JsonObject?>> Get(string id, CancellationToken ct)
    {
        var cycle = await service.GetByIdAsync(id, ct);
        return cycle is null ? NotFound() : Ok(cycle);
    }

    [HttpPost]
    public async Task<ActionResult<JsonObject>> Create([FromBody] JsonObject input, CancellationToken ct) =>
        Ok(await service.CreateAsync(input, ct));

    [HttpPatch("{id}")]
    public async Task<ActionResult<JsonObject>> Update(string id, [FromBody] JsonObject patch, CancellationToken ct) =>
        Ok(await service.UpdateAsync(id, patch, ct));

    [HttpPost("{id}/activate")]
    public async Task<ActionResult<JsonObject>> Activate(string id, [FromQuery] bool swap, CancellationToken ct) =>
        Ok(await service.ActivateAsync(id, swap, ct));

    [HttpPost("{id}/set-active")]
    public async Task<ActionResult<JsonObject>> SetActive(string id, CancellationToken ct) =>
        Ok(await service.ActivateAsync(id, swap: true, ct));

    [HttpPost("{id}/clone")]
    public async Task<ActionResult<JsonObject>> Clone(string id, CancellationToken ct)
    {
        var source = await service.GetByIdAsync(id, ct);
        if (source is null) return NotFound();
        var clone = AdmissionJson.Clone(source);
        clone["id"] = $"{id}-COPY-{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";
        clone["nameAr"] = $"{clone["nameAr"]?.GetValue<string>() ?? "دورة"} - نسخة";
        clone["isActive"] = false;
        clone["status"] = "draft";
        return Ok(await service.CreateAsync(clone, ct));
    }

    [HttpPost("{id}/transition")]
    public async Task<ActionResult<JsonObject>> Transition(string id, [FromBody] JsonObject body, CancellationToken ct) =>
        Ok(await service.TransitionAsync(id, body["status"]?.GetValue<string>() ?? "draft", ct));

    [HttpPost("{id}/close")]
    public async Task<ActionResult<JsonObject>> Close(string id, CancellationToken ct) =>
        Ok(await service.TransitionAsync(id, "closed", ct));

    [HttpPost("{id}/extend")]
    public async Task<ActionResult<JsonObject>> Extend(string id, [FromBody] JsonObject body, CancellationToken ct)
    {
        var patch = new JsonObject
        {
            ["closeDate"] = body["newCloseDate"]?.DeepClone(),
            ["status"] = "extended"
        };
        return Ok(await service.UpdateAsync(id, patch, ct));
    }

    [HttpPost("{id}/archive")]
    public async Task<ActionResult<JsonObject>> Archive(string id, CancellationToken ct) =>
        Ok(await service.TransitionAsync(id, "archived", ct));

    [HttpDelete("{id}")]
    public async Task<ActionResult<object>> Delete(string id, CancellationToken ct) =>
        Ok(await service.DeleteAsync(id, ct));

    [HttpGet("{id}/dependencies")]
    public async Task<ActionResult<object>> Dependencies(string id, CancellationToken ct) =>
        Ok(await service.DependenciesAsync(id, ct));

    [HttpPost("{id}/soft-delete")]
    public async Task<ActionResult<object>> SoftDelete(string id, CancellationToken ct) =>
        Ok(await service.SoftDeleteAsync(id, ct));

    [HttpPost("{id}/restore")]
    public async Task<ActionResult<JsonObject>> Restore(string id, CancellationToken ct)
    {
        var patch = new JsonObject
        {
            ["deletedAt"] = null,
            ["deletedBy"] = null,
            ["deleteReason"] = null
        };
        return Ok(await service.UpdateAsync(id, patch, ct));
    }

    [HttpPatch("{id}/categories/{key}")]
    public async Task<ActionResult<JsonObject>> UpdateCategory(string id, string key, [FromBody] JsonObject patch, CancellationToken ct) =>
        Ok(await service.UpdateCategoryAsync(id, key, patch, ct));

    [HttpPatch("{id}/categories/{key}/conditions")]
    public async Task<ActionResult<JsonObject>> UpdateCategoryConditions(string id, string key, [FromBody] JsonObject patch, CancellationToken ct) =>
        Ok(await service.UpdateCategoryAsync(id, key, new JsonObject { ["conditionOverrides"] = patch }, ct));
}
