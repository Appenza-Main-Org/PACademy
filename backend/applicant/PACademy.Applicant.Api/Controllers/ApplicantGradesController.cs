using Microsoft.AspNetCore.Mvc;
using PACademy.Modules.GradesRead.Application;

namespace PACademy.Applicant.Api.Controllers;

[ApiController]
[Route("api/admin/applicant-grades")]
public sealed class ApplicantGradesController(FindGradeByNidReadUseCase findByNid) : ControllerBase
{
    [HttpGet("by-nid/{nid}")]
    public async Task<IActionResult> ByNid([FromRoute] string nid, [FromQuery] string? cycleId, CancellationToken ct)
        => Ok(await findByNid.ExecuteAsync(nid, cycleId, ct));
}
