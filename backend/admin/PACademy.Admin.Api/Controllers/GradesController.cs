using Microsoft.AspNetCore.Mvc;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("")]
public sealed class GradesController : ControllerBase
{
    [HttpGet("api/grades")]
    public ActionResult<object> List([FromQuery] int? page, [FromQuery] int? pageSize)
    {
        if (page is not null || pageSize is not null) return Ok(new { rows = Array.Empty<object>(), total = 0 });
        return Ok(Array.Empty<object>());
    }

    [HttpGet("api/grades/export")]
    public ActionResult<IReadOnlyList<object>> Export() => Ok(Array.Empty<object>());

    [HttpGet("api/admin/applicant-grades/by-nid/{nid}")]
    public ActionResult<object> ByNationalId(string nid) => NotFound();

    [HttpDelete("api/grades")]
    public ActionResult<object> Delete() => Ok(new { deleted = 0 });

    [HttpPost("api/grades/import/stage")]
    [HttpPost("api/grades/import/commit")]
    [HttpPost("api/grades/v2/preflight")]
    [HttpPost("api/grades/v2/commit")]
    public ActionResult<object> Import() => Ok(new { rows = Array.Empty<object>(), staged = Array.Empty<object>(), errors = Array.Empty<object>() });

    [HttpPost("api/grades/{seat}/adjustments")]
    [HttpPost("api/grades/{seat}/adjustments/{entryId}/toggle")]
    [HttpDelete("api/grades/{seat}/adjustments/{entryId}")]
    [HttpPatch("api/grades/{seat}/override-max")]
    public ActionResult<object> Adjust(string seat) => Ok(new { seat });
}
