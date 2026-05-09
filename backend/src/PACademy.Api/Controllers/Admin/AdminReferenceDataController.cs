using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PACademy.Application.Admin.ReferenceData;
using PACademy.Contracts.Admin.ReferenceData;
using PACademy.Contracts.Common;

namespace PACademy.Api.Controllers.Admin;

/// <summary>
/// Admin Reference Data — super-admin manages the 8 lookup categories.
/// </summary>
[ApiController]
[Route("admin/reference-data")]
[Authorize(Policy = "Role:super_admin")]
public sealed class AdminReferenceDataController(
    ListReferenceDataUseCase list,
    GetReferenceDataUseCase get,
    CreateReferenceDataUseCase create,
    UpdateReferenceDataUseCase update,
    ArchiveReferenceDataUseCase archive,
    IValidator<CreateReferenceDataRequest> createValidator)
    : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<ReferenceDataListItemDto>>> List(
        [FromQuery] string? category = null,
        [FromQuery] bool? isActive = null,
        [FromQuery] bool includeArchived = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? sortBy = null,
        [FromQuery] string? sortDir = null,
        CancellationToken ct = default)
    {
        var filters = new ReferenceDataListFilters(
            category, isActive, includeArchived, page, pageSize, sortBy, sortDir);
        var result = await list.ExecuteAsync(filters, ct);

        Response.Headers["X-Total-Count"] = result.TotalCount.ToString();
        Response.Headers["X-Page-Count"] = result.TotalPages.ToString();
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ReferenceDataDetailDto>> Get(Guid id, CancellationToken ct)
    {
        var dto = await get.ExecuteAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost]
    public async Task<ActionResult<ReferenceDataDetailDto>> Create(
        [FromBody] CreateReferenceDataRequest request,
        CancellationToken ct)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            throw new ValidationException(validation.Errors);

        var dto = await create.ExecuteAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = dto.Id }, dto);
    }

    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<ReferenceDataDetailDto>> Update(
        Guid id,
        [FromBody] UpdateReferenceDataRequest request,
        CancellationToken ct)
    {
        var dto = await update.ExecuteAsync(id, request, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken ct)
    {
        var ok = await archive.ExecuteAsync(id, ct);
        return ok ? NoContent() : NotFound();
    }
}
