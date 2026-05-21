using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using PACademy.Admin.Api.Modules.Lookups;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("api/lookups")]
public sealed class LookupsController(LookupsService service) : ControllerBase
{
    [HttpGet("{key}")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> List(
        string key,
        [FromQuery] bool? isActive,
        [FromQuery] string? search,
        CancellationToken ct)
    {
        return Ok(await service.ListAsync(key, isActive, search, ct));
    }

    [HttpPost("{key}")]
    public async Task<ActionResult<JsonObject>> Create(string key, [FromBody] JsonObject input, CancellationToken ct)
    {
        var created = await service.CreateAsync(key, input, ct);
        return Created($"/api/lookups/{Uri.EscapeDataString(key)}/{Uri.EscapeDataString(created["code"]?.GetValue<string>() ?? string.Empty)}", created);
    }

    [HttpPatch("{key}/{code}")]
    public async Task<ActionResult<JsonObject>> Update(string key, string code, [FromBody] JsonObject patch, CancellationToken ct)
    {
        return Ok(await service.UpdateAsync(key, code, patch, ct));
    }

    [HttpDelete("{key}/{code}")]
    public async Task<ActionResult<DeleteLookupRowResult>> Delete(string key, string code, CancellationToken ct)
    {
        return Ok(await service.DeleteAsync(key, code, ct));
    }
}
