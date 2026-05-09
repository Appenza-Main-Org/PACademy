using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PACademy.Application.Admin.Cycles;
using PACademy.Contracts.Admin.Cycles;
using PACademy.Contracts.Common;

namespace PACademy.Api.Controllers.Admin;

/// <summary>
/// Admin Cycles — super-admin manages admission cycle lifecycle.
/// All endpoints require Role:super_admin.
/// </summary>
[ApiController]
[Route("admin/cycles")]
[Authorize(Policy = "Role:super_admin")]
public sealed class AdminCyclesController(
    ListCyclesUseCase list,
    GetCycleUseCase get,
    CreateCycleUseCase create,
    UpdateCycleUseCase update,
    TransitionCycleStatusUseCase transition,
    DeleteCycleUseCase delete,
    IValidator<CreateCycleRequest> createValidator)
    : ControllerBase
{
    /// <summary>GET /admin/cycles — paginated list with filters.</summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<CycleListItemDto>>> List(
        [FromQuery] string? status = null,
        [FromQuery] int? year = null,
        [FromQuery] string? cohort = null,
        [FromQuery] bool includeArchived = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        var filters = new CycleListFilters(status, year, cohort, includeArchived, page, pageSize);
        var result = await list.ExecuteAsync(filters, ct);

        Response.Headers["X-Total-Count"] = result.TotalCount.ToString();
        Response.Headers["X-Page-Count"] = result.TotalPages.ToString();

        return Ok(result);
    }

    /// <summary>GET /admin/cycles/{id} — cycle detail.</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CycleDetailDto>> Get(Guid id, CancellationToken ct)
    {
        var dto = await get.ExecuteAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    /// <summary>POST /admin/cycles — create a Draft cycle.</summary>
    [HttpPost]
    public async Task<ActionResult<CycleDetailDto>> Create(
        [FromBody] CreateCycleRequest request,
        CancellationToken ct)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            throw new ValidationException(validation.Errors);

        var dto = await create.ExecuteAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = dto.Id }, dto);
    }

    /// <summary>PATCH /admin/cycles/{id} — update mutable fields (not status).</summary>
    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<CycleDetailDto>> Update(
        Guid id,
        [FromBody] UpdateCycleRequest request,
        CancellationToken ct)
    {
        var dto = await update.ExecuteAsync(id, request, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    /// <summary>
    /// POST /admin/cycles/{id}/status — lifecycle transition.
    /// Runs under IsolationLevel.Serializable (FR-Y01/Y02).
    /// </summary>
    [HttpPost("{id:guid}/status")]
    public async Task<ActionResult<CycleDetailDto>> Transition(
        Guid id,
        [FromBody] TransitionCycleStatusRequest request,
        CancellationToken ct)
    {
        var dto = await transition.ExecuteAsync(id, request.NewStatus, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    /// <summary>DELETE /admin/cycles/{id} — hard-delete Draft with zero applicants.</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var deleted = await delete.ExecuteAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }
}
