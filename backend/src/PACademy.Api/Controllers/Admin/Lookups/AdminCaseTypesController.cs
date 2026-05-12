using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PACademy.Application.Admin.Lookups.CaseTypes;
using PACademy.Contracts.Admin.Lookups;
using PACademy.Contracts.Common;

namespace PACademy.Api.Controllers.Admin.Lookups;

[ApiController]
[Route("admin/case-types")]
[Authorize(Policy = "*")]
public sealed class AdminCaseTypesController(
    ListCaseTypesUseCase list, GetCaseTypeUseCase get,
    CreateCaseTypeUseCase create, UpdateCaseTypeUseCase update,
    ArchiveCaseTypeUseCase archive, RestoreCaseTypeUseCase restore)
    : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<CaseTypeDto>>> List([FromQuery] LookupListFilters f, CancellationToken ct)
    { var r = await list.ExecuteAsync(f, ct); Response.Headers["X-Total-Count"] = r.TotalCount.ToString(); Response.Headers["X-Page-Count"] = r.TotalPages.ToString(); return Ok(r); }
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CaseTypeDto>> Get(Guid id, CancellationToken ct)
        => await get.ExecuteAsync(id, ct) is { } dto ? Ok(dto) : NotFound();
    [HttpPost]
    public async Task<ActionResult<CaseTypeDto>> Create([FromBody] CreateCaseTypeRequest req, CancellationToken ct)
    { var dto = await create.ExecuteAsync(req, ct); return CreatedAtAction(nameof(Get), new { id = dto.Id }, dto); }
    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<CaseTypeDto>> Update(Guid id, [FromBody] UpdateCaseTypeRequest req, CancellationToken ct)
        => await update.ExecuteAsync(id, req, ct) is { } dto ? Ok(dto) : NotFound();
    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken ct)
        => await archive.ExecuteAsync(id, ct) ? NoContent() : NotFound();
    [HttpPost("{id:guid}/restore")]
    public async Task<IActionResult> Restore(Guid id, CancellationToken ct)
        => await restore.ExecuteAsync(id, ct) ? NoContent() : NotFound();
}
