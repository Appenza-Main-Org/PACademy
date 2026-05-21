using Microsoft.AspNetCore.Mvc;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("api/lookups")]
public sealed class LookupAliasesController : ControllerBase
{
    [HttpGet("educationTypes")]
    public ActionResult<IReadOnlyList<object>> EducationTypes() => Ok(Array.Empty<object>());
}
