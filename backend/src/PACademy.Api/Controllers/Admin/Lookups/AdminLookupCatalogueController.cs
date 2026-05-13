using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PACademy.Modules.Lookups.Application;
using PACademy.Modules.Lookups.Public;

namespace PACademy.Api.Controllers.Admin.Lookups;

/// <summary>
/// Unified single-table lookup catalogue (spec 010). All 31 lookup type codes
/// share <c>lookup_items</c> with a discriminator; this controller exposes the
/// generic CRUD surface keyed by <c>typeCode</c>. Legacy typed controllers
/// (Governorates, Nationalities, …) coexist until migration follow-up drops them.
/// </summary>
[ApiController]
[Route("admin/lookups")]
[Authorize(Policy = "*")]
public sealed class AdminLookupCatalogueController(
    ListLookupItemTypesUseCase listTypes,
    ListLookupItemsUseCase list,
    GetLookupItemUseCase get,
    CreateLookupItemUseCase create,
    UpdateLookupItemUseCase update,
    SoftDeleteLookupItemUseCase softDelete)
    : ControllerBase
{
    [HttpGet("types")]
    public async Task<ActionResult<IReadOnlyList<LookupItemTypeDto>>> ListTypes(
        [FromQuery] bool adminOnly = false, CancellationToken ct = default)
        => Ok(await listTypes.ExecuteAsync(adminOnly, ct));

    [HttpGet("{typeCode}")]
    public async Task<ActionResult<IReadOnlyList<LookupItemDto>>> List(
        string typeCode,
        [FromQuery] bool includeInactive = false,
        [FromQuery] bool includeDeleted = false,
        CancellationToken ct = default)
        => Ok(await list.ExecuteAsync(typeCode, includeInactive, includeDeleted, ct));

    [HttpGet("{typeCode}/{code}")]
    public async Task<ActionResult<LookupItemDto>> Get(string typeCode, string code, CancellationToken ct)
        => await get.ExecuteAsync(typeCode, code, ct) is { } dto ? Ok(dto) : NotFound();

    [HttpPost("{typeCode}")]
    public async Task<ActionResult<LookupItemDto>> Create(
        string typeCode, [FromBody] CreateLookupItemRequest req, CancellationToken ct)
    {
        var dto = await create.ExecuteAsync(typeCode, req, ct);
        return CreatedAtAction(nameof(Get), new { typeCode = dto.LookupTypeCode, code = dto.Code }, dto);
    }

    [HttpPatch("{typeCode}/{code}")]
    public async Task<ActionResult<LookupItemDto>> Update(
        string typeCode, string code, [FromBody] UpdateLookupItemRequest req, CancellationToken ct)
        => await update.ExecuteAsync(typeCode, code, req, ct) is { } dto ? Ok(dto) : NotFound();

    [HttpDelete("{typeCode}/{code}")]
    public async Task<IActionResult> SoftDelete(
        string typeCode, string code, [FromBody] SoftDeleteLookupItemRequest req, CancellationToken ct)
        => await softDelete.ExecuteAsync(typeCode, code, req, ct) ? NoContent() : NotFound();
}
