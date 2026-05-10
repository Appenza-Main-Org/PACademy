using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PACademy.Application.Admin.Lookups.Governorates;
using PACademy.Contracts.Admin.Lookups;
using PACademy.Contracts.Common;

namespace PACademy.Api.Controllers.Admin.Lookups;

[ApiController]
[Route("admin/governorates")]
[Authorize(Policy = "*")]
public sealed class AdminGovernoratesController(
    ListGovernoratesUseCase list,
    GetGovernorateUseCase get,
    CreateGovernorateUseCase create,
    UpdateGovernorateUseCase update,
    ArchiveGovernorateUseCase archive,
    RestoreGovernorateUseCase restore)
    : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<GovernorateDto>>> List([FromQuery] LookupListFilters f, CancellationToken ct)
    {
        var r = await list.ExecuteAsync(f, ct);
        Response.Headers["X-Total-Count"] = r.TotalCount.ToString();
        Response.Headers["X-Page-Count"] = r.TotalPages.ToString();
        return Ok(r);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<GovernorateDto>> Get(Guid id, CancellationToken ct)
        => await get.ExecuteAsync(id, ct) is { } dto ? Ok(dto) : NotFound();

    [HttpPost]
    public async Task<ActionResult<GovernorateDto>> Create([FromBody] CreateGovernorateRequest req, CancellationToken ct)
    {
        var dto = await create.ExecuteAsync(req, ct);
        return CreatedAtAction(nameof(Get), new { id = dto.Id }, dto);
    }

    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<GovernorateDto>> Update(Guid id, [FromBody] UpdateGovernorateRequest req, CancellationToken ct)
        => await update.ExecuteAsync(id, req, ct) is { } dto ? Ok(dto) : NotFound();

    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken ct)
        => await archive.ExecuteAsync(id, ct) ? NoContent() : NotFound();

    [HttpPost("{id:guid}/restore")]
    public async Task<IActionResult> Restore(Guid id, CancellationToken ct)
        => await restore.ExecuteAsync(id, ct) ? NoContent() : NotFound();
}
