using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PACademy.Application.Admin.Categories;
using PACademy.Contracts.Admin.Categories;

namespace PACademy.Api.Controllers.Admin;

/// <summary>
/// Admin Categories — super-admin manages applicant categories.
/// Spec categories (FR-K01 — 7 RFP keys) cannot be deleted; their
/// labelAr is also locked.
/// </summary>
[ApiController]
[Route("admin/categories")]
[Authorize(Policy = "Role:super_admin")]
public sealed class AdminCategoriesController(
    ListCategoriesUseCase list,
    GetCategoryUseCase get,
    CreateCategoryUseCase create,
    UpdateCategoryUseCase update,
    DeleteCategoryUseCase delete)
    : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<CategoryListItemDto>>> List(
        [FromQuery] bool includeArchived = false,
        CancellationToken ct = default)
    {
        var items = await list.ExecuteAsync(includeArchived, ct);
        Response.Headers["X-Total-Count"] = items.Count.ToString();
        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CategoryDetailDto>> GetById(Guid id, CancellationToken ct)
    {
        var dto = await get.ExecuteByIdAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpGet("by-key/{key}")]
    public async Task<ActionResult<CategoryDetailDto>> GetByKey(string key, CancellationToken ct)
    {
        var dto = await get.ExecuteByKeyAsync(key, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost]
    public async Task<ActionResult<CategoryDetailDto>> Create(
        [FromBody] CreateCategoryRequest request,
        CancellationToken ct)
    {
        var dto = await create.ExecuteAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = dto.Id }, dto);
    }

    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<CategoryDetailDto>> UpdateById(
        Guid id,
        [FromBody] UpdateCategoryRequest request,
        CancellationToken ct)
    {
        var dto = await update.ExecuteByIdAsync(id, request, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPatch("by-key/{key}")]
    public async Task<ActionResult<CategoryDetailDto>> UpdateByKey(
        string key,
        [FromBody] UpdateCategoryRequest request,
        CancellationToken ct)
    {
        var dto = await update.ExecuteByKeyAsync(key, request, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteById(Guid id, CancellationToken ct)
    {
        var ok = await delete.ExecuteByIdAsync(id, ct);
        return ok ? NoContent() : NotFound();
    }

    [HttpDelete("by-key/{key}")]
    public async Task<IActionResult> DeleteByKey(string key, CancellationToken ct)
    {
        var ok = await delete.ExecuteByKeyAsync(key, ct);
        return ok ? NoContent() : NotFound();
    }
}
