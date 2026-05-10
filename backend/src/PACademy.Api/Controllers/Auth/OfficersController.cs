using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PACademy.Modules.Identity.Application;
using PACademy.Modules.Identity.Application.Officers;
using PACademy.Shared.Contracts;
using System.Text.RegularExpressions;

namespace PACademy.Api.Controllers.Auth;

[ApiController]
[Route("v1/officers")]
[Authorize(Policy = "users:create")]
public sealed class OfficersController(
    LookupOfficerUseCase lookupOfficer,
    ICurrentUser currentUser)
    : ControllerBase
{
    private static readonly Regex NidPattern = new(@"^\d{14}$", RegexOptions.Compiled);

    [HttpGet("lookup")]
    public async Task<IActionResult> Lookup(
        [FromQuery] string nid,
        [FromQuery] string code,
        CancellationToken ct)
    {
        var errors = new List<object>();
        if (string.IsNullOrEmpty(nid) || !NidPattern.IsMatch(nid))
            errors.Add(new { field = "nid", constraint = "must be 14 digits", value = nid });
        if (string.IsNullOrEmpty(code))
            errors.Add(new { field = "code", constraint = "required", value = code });

        if (errors.Count > 0)
        {
            return BadRequest(new
            {
                code = ErrorCodes.ValidationFailed,
                message = "Invalid request",
                payload = new { errors },
            });
        }

        var (record, unavailable) = await lookupOfficer.ExecuteAsync(nid, code, currentUser.Id, ct);

        if (unavailable)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                code = ErrorCodes.OfficerLookupUnavailable,
                message = "خدمة البحث عن الضباط غير متاحة حالياً. حاول مرة أخرى.",
            });
        }

        if (record is null)
        {
            return NotFound(new
            {
                code = ErrorCodes.OfficerNotFound,
                message = "لم يتم العثور على ضابط بهذا الرقم القومي ورمز الضابط",
            });
        }

        return Ok(record);
    }
}
