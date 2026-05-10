using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PACademy.Application.Admin.Applicants;
using PACademy.Contracts.Admin.Applicants;
using PACademy.Contracts.Common;

namespace PACademy.Api.Controllers.Admin;

[ApiController]
[Route("admin/applicants")]
[Authorize]
public sealed class AdminApplicantsController(
    ListApplicantsUseCase list,
    GetApplicantUseCase get,
    UpdateApplicantUseCase update,
    IValidator<ApplicantPatchDto> patchValidator)
    : ControllerBase
{
    /// <summary>
    /// GET /admin/applicants — paginated list with filters.
    /// Returns X-Total-Count + X-Page-Count headers (plan Constitution Check IV).
    /// </summary>
    [HttpGet]
    [Authorize(Policy = "applicants:view")]
    public async Task<ActionResult<PagedResult<ApplicantListItemDto>>> List(
        [FromQuery] Guid? cycleId,
        [FromQuery] string? status,
        [FromQuery] string? q,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? sortBy = null,
        [FromQuery] string? sortDir = null,
        CancellationToken ct = default)
    {
        var filters = new ApplicantListFilters(cycleId, status, q, page, pageSize, sortBy, sortDir);
        var result = await list.ExecuteAsync(filters, ct);

        Response.Headers["X-Total-Count"] = result.TotalCount.ToString();
        Response.Headers["X-Page-Count"] = result.TotalPages.ToString();

        return Ok(result);
    }

    /// <summary>GET /admin/applicants/{id} — applicant detail.</summary>
    [HttpGet("{id:guid}")]
    [Authorize(Policy = "applicants:view")]
    public async Task<ActionResult<ApplicantDetailDto>> Get(Guid id, CancellationToken ct)
    {
        var dto = await get.ExecuteAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    /// <summary>
    /// PATCH /admin/applicants/{id} — per-field update. Concurrent writes use
    /// silent last-write-wins per FR-014.
    /// </summary>
    [HttpPatch("{id:guid}")]
    [Authorize(Policy = "applicants:edit")]
    public async Task<ActionResult<ApplicantDetailDto>> Patch(
        Guid id,
        [FromBody] ApplicantPatchDto patch,
        CancellationToken ct)
    {
        var validation = await patchValidator.ValidateAsync(patch, ct);
        if (!validation.IsValid)
        {
            throw new ValidationException(validation.Errors);
        }

        var dto = await update.ExecuteAsync(id, patch, ct);
        return dto is null ? NotFound() : Ok(dto);
    }
}
