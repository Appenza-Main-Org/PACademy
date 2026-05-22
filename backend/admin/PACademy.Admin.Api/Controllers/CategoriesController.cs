using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using PACademy.Admin.Api.Modules.Admissions;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("api/admin/categories")]
public sealed class CategoriesController(CategoriesService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> List([FromQuery] bool includeDeleted, CancellationToken ct) =>
        Ok(await service.ListAsync(includeDeleted, ct));

    [HttpGet("{key}")]
    public async Task<ActionResult<JsonObject?>> Get(string key, CancellationToken ct)
    {
        var category = await service.GetByKeyAsync(key, ct);
        return category is null ? NotFound() : Ok(category);
    }

    [HttpPatch("{key}")]
    public async Task<ActionResult<JsonObject>> Update(string key, [FromBody] JsonObject patch, CancellationToken ct) =>
        Ok(await service.UpdateAsync(key, patch, ct));

    [HttpGet("{key}/dependencies")]
    public async Task<ActionResult<object>> Dependencies(string key, CancellationToken ct) =>
        Ok(await service.DependenciesAsync(key, ct));

    [HttpPost("{key}/soft-delete")]
    public async Task<ActionResult<JsonObject>> SoftDelete(string key, CancellationToken ct) =>
        Ok(await service.SoftDeleteAsync(key, ct));

    [HttpPost("{key}/restore")]
    public async Task<ActionResult<JsonObject?>> Restore(string key, CancellationToken ct)
    {
        var category = await service.GetByKeyAsync(key, ct);
        return category is null ? NotFound() : Ok(category);
    }

    [HttpPost("{key}/preview-rule-change")]
    public async Task<ActionResult<object>> PreviewRuleChange(string key, [FromBody] JsonObject? body, CancellationToken ct) =>
        Ok(await service.PreviewRuleChangeAsync(key, body, ct));

    [HttpPatch("{key}/conditions")]
    public async Task<ActionResult<JsonObject>> UpdateConditions(string key, [FromBody] JsonObject body, CancellationToken ct)
    {
        var patch = new JsonObject { ["expandedConditions"] = body["conditions"]?.DeepClone() ?? body.DeepClone() };
        return Ok(await service.UpdateAsync(key, patch, ct));
    }
}
