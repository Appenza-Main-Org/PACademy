using Microsoft.AspNetCore.Mvc;
using PACademy.Admin.Api.Modules.Lookups;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("api/lookups")]
public sealed class LookupAliasesController(LookupsService lookups) : ControllerBase
{
    [HttpGet("educationTypes")]
    public async Task<ActionResult<IReadOnlyList<object>>> EducationTypes([FromQuery] bool? active, CancellationToken ct)
    {
        var rows = await lookups.ListAsync("school-categories", active, null, ct);
        return Ok(rows.Select(x => new
        {
            id = x["code"]?.GetValue<string>(),
            key = x["code"]?.GetValue<string>(),
            labelAr = x["name"]?.GetValue<string>(),
            isActive = x["isActive"]?.GetValue<bool>() ?? true
        }).ToList());
    }
}
