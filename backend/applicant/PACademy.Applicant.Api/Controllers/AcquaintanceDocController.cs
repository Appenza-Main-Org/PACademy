using System.Security.Claims;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PACademy.Applicant.Api.Modules.ApplicantPortal;

namespace PACademy.Applicant.Api.Controllers;

/// <summary>
/// Applicant-facing Acquaintance-Doc lifecycle endpoints.
///
/// INTEGRATION CONTRACT:
///   GET   /api/applicant/acquaintance-doc/status → backend-owned open/closed/print state
///   GET   /api/applicant/acquaintance-doc        → current draft, initialized when opening rules pass
///   PATCH /api/applicant/acquaintance-doc        → debounced autosave of top-level document sections
///   GET   /api/applicant/acquaintance-doc/print  → final printable document after backend closure
/// </summary>
[ApiController]
[Route("api/applicant/acquaintance-doc")]
[Authorize]
public sealed class AcquaintanceDocController(PortalService portal) : ControllerBase
{
    [HttpGet("status")]
    public async Task<IActionResult> GetStatus(CancellationToken ct)
    {
        var applicantId = CurrentApplicantId();
        if (applicantId is null) return Unauthorized();
        return Ok(await portal.GetAcquaintanceDocStatusAsync(applicantId, ct));
    }

    [HttpGet]
    public async Task<IActionResult> GetDocument(CancellationToken ct)
    {
        var applicantId = CurrentApplicantId();
        if (applicantId is null) return Unauthorized();
        return Ok(await portal.GetOrCreateAcquaintanceDocAsync(applicantId, ct));
    }

    [HttpPatch]
    public async Task<IActionResult> SaveDraft([FromBody] JsonObject partial, CancellationToken ct)
    {
        var applicantId = CurrentApplicantId();
        if (applicantId is null) return Unauthorized();
        return Ok(await portal.SaveAcquaintanceDocAsync(applicantId, partial, ct));
    }

    [HttpGet("print")]
    public async Task<IActionResult> GetPrintable(CancellationToken ct)
    {
        var applicantId = CurrentApplicantId();
        if (applicantId is null) return Unauthorized();
        return Ok(await portal.GetPrintableAcquaintanceDocAsync(applicantId, ct));
    }

    private string? CurrentApplicantId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier) ??
        User.FindFirstValue("sub");
}
