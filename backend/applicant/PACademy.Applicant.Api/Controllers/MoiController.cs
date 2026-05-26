using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PACademy.Modules.IdentityApplicant.Application.Moi;

namespace PACademy.Applicant.Api.Controllers;

/// <summary>
/// MOI (وزارة الداخلية) identity-verification endpoint. Returns the
/// canonical <c>MoiApplicantSession</c> payload the frontend's
/// applicant-portal store consumes, or 404 when MOI doesn't know the NID.
///
/// Currently backed by <see cref="MoiMockClient"/> in Dev; swappable to a
/// real upstream impl via <c>IMoiClient</c> when the integration is ready.
/// </summary>
[ApiController]
[Route("applicant/moi")]
public sealed class MoiController(FetchMoiVerificationUseCase fetch) : ControllerBase
{
    [HttpGet("verify/{nid}")]
    [AllowAnonymous]
    public async Task<IActionResult> Verify(string nid, CancellationToken ct)
    {
        var session = await fetch.ExecuteAsync(nid, ct);
        return session is null
            ? NotFound(new { code = "NOT_FOUND", message = "لم يتم العثور على البيانات في سجلات وزارة الداخلية." })
            : Ok(session);
    }
}
