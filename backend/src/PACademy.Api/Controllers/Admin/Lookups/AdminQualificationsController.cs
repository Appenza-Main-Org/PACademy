using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PACademy.Application.Admin.Lookups.Qualifications;
using PACademy.Contracts.Admin.Lookups;
using PACademy.Contracts.Common;

namespace PACademy.Api.Controllers.Admin.Lookups;

[ApiController]
[Route("admin/qualifications")]
[Authorize(Policy = "*")]
public sealed class AdminQualificationsController(
    ListQualificationsUseCase list, GetQualificationUseCase get,
    CreateQualificationUseCase create, UpdateQualificationUseCase update,
    ArchiveQualificationUseCase archive, RestoreQualificationUseCase restore)
    : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<QualificationDto>>> List([FromQuery] LookupListFilters f, CancellationToken ct)
    { var r = await list.ExecuteAsync(f, ct); Response.Headers["X-Total-Count"] = r.TotalCount.ToString(); Response.Headers["X-Page-Count"] = r.TotalPages.ToString(); return Ok(r); }
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<QualificationDto>> Get(Guid id, CancellationToken ct)
        => await get.ExecuteAsync(id, ct) is { } dto ? Ok(dto) : NotFound();
    [HttpPost]
    public async Task<ActionResult<QualificationDto>> Create([FromBody] CreateQualificationRequest req, CancellationToken ct)
    { var dto = await create.ExecuteAsync(req, ct); return CreatedAtAction(nameof(Get), new { id = dto.Id }, dto); }
    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<QualificationDto>> Update(Guid id, [FromBody] UpdateQualificationRequest req, CancellationToken ct)
        => await update.ExecuteAsync(id, req, ct) is { } dto ? Ok(dto) : NotFound();
    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken ct)
        => await archive.ExecuteAsync(id, ct) ? NoContent() : NotFound();
    [HttpPost("{id:guid}/restore")]
    public async Task<IActionResult> Restore(Guid id, CancellationToken ct)
        => await restore.ExecuteAsync(id, ct) ? NoContent() : NotFound();
}
