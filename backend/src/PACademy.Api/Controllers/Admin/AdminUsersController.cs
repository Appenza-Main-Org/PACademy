using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PACademy.Application.Admin.Users;
using PACademy.Contracts.Admin.Users;
using PACademy.Contracts.Common;

namespace PACademy.Api.Controllers.Admin;

/// <summary>
/// Admin Users — super-admin provisions and manages system operators.
/// All endpoints require Role:super_admin (FR-030).
/// </summary>
[ApiController]
[Route("admin/users")]
[Authorize(Policy = "Role:super_admin")]
public sealed class AdminUsersController(
    ListSystemUsersUseCase list,
    GetSystemUserUseCase get,
    CreateSystemUserUseCase create,
    UpdateSystemUserUseCase update,
    IValidator<CreateSystemUserRequest> createValidator)
    : ControllerBase
{
    /// <summary>
    /// GET /admin/users — paginated list with filters.
    /// Returns X-Total-Count + X-Page-Count headers (Constitution Check IV).
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<SystemUserListItemDto>>> List(
        [FromQuery] string? role = null,
        [FromQuery] string? q = null,
        [FromQuery] bool? isActive = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? sortBy = null,
        [FromQuery] string? sortDir = null,
        CancellationToken ct = default)
    {
        var filters = new SystemUserListFilters(role, q, isActive, page, pageSize, sortBy, sortDir);
        var result = await list.ExecuteAsync(filters, ct);

        Response.Headers["X-Total-Count"] = result.TotalCount.ToString();
        Response.Headers["X-Page-Count"] = result.TotalPages.ToString();

        return Ok(result);
    }

    /// <summary>GET /admin/users/{id} — user detail.</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<SystemUserDetailDto>> Get(Guid id, CancellationToken ct)
    {
        var dto = await get.ExecuteAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    /// <summary>POST /admin/users — provision a new operator.</summary>
    [HttpPost]
    public async Task<ActionResult<SystemUserDetailDto>> Create(
        [FromBody] CreateSystemUserRequest request,
        CancellationToken ct)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            throw new ValidationException(validation.Errors);
        }

        var dto = await create.ExecuteAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = dto.Id }, dto);
    }

    /// <summary>
    /// PATCH /admin/users/{id} — update mutable fields.
    /// Role changes trigger FR-C06 session revocation inside UpdateSystemUserUseCase.
    /// </summary>
    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<SystemUserDetailDto>> Update(
        Guid id,
        [FromBody] UpdateSystemUserRequest request,
        CancellationToken ct)
    {
        var dto = await update.ExecuteAsync(id, request, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    /// <summary>
    /// POST /admin/users/{id}/deactivate — stub; US3 (T181) fills in the use case with the super-admin floor check.
    /// </summary>
    [HttpPost("{id:guid}/deactivate")]
    public IActionResult Deactivate(Guid id)
    {
        return StatusCode(501, new
        {
            code = "NOT_IMPLEMENTED",
            message = "Deactivate endpoint is implemented in US3 (T181).",
        });
    }
}
