using Microsoft.AspNetCore.Mvc;
using PACademy.Modules.LookupsRead.Application;

namespace PACademy.Applicant.Api.Controllers;

/// <summary>
/// Read-only lookup endpoints for applicant-facing dropdowns.
///
/// One <c>[HttpGet]</c> action per lookup key — the closed union (24
/// keys) is enforced at the controller level so unknown keys can't
/// reach the data layer.
///
/// Matches the frontend's <c>useLookup(key)</c> contract verbatim:
/// <c>GET /api/lookups/:key</c> returns <c>LookupRow&lt;key&gt;[]</c>.
/// </summary>
[ApiController]
[Route("api/lookups")]
public sealed class LookupsController(ListActiveFacultiesUseCase listFaculties) : ControllerBase
{
    [HttpGet("faculties")]
    public async Task<IActionResult> GetFaculties(CancellationToken ct)
        => Ok(await listFaculties.ExecuteAsync(ct));

    // Future: one [HttpGet("specializations")], [HttpGet("universities")], etc.
    // per the closed union in frontend/src/features/lookups/types.ts.
}
