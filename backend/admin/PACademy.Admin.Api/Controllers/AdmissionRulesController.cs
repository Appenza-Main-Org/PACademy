using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using PACademy.Admin.Api.Modules.Admissions;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("api/admission-rules")]
public sealed class AdmissionRulesController(AdmissionRulesService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> List([FromQuery] string cycleId, CancellationToken ct) =>
        Ok(await service.ListForCycleAsync(cycleId, ct));

    [HttpGet("{cycleId}/current")]
    public async Task<ActionResult<JsonObject?>> Current(string cycleId, CancellationToken ct) =>
        Ok(await service.CurrentAsync(cycleId, ct));

    [HttpPost]
    public async Task<ActionResult<JsonObject>> Save([FromBody] JsonObject payload, CancellationToken ct) =>
        Ok(await service.SaveAsync(payload, ct));
}
