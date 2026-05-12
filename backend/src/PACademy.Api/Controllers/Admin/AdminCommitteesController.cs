using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PACademy.Modules.Committees.Application.Committees;
using PACademy.Modules.Committees.Application.Dtos;
using PACademy.Modules.Committees.Application.Members;

namespace PACademy.Api.Controllers.Admin;

[ApiController]
[Authorize(Policy = "admission-setup:read")]
public sealed class AdminCommitteesController(
    ListCommitteesUseCase list,
    GetCommitteeUseCase get,
    CreateCommitteeUseCase create,
    UpdateCommitteeUseCase update,
    ArchiveCommitteeUseCase archive,
    RestoreCommitteeUseCase restore,
    AddCommitteeMemberUseCase addMember,
    RemoveCommitteeMemberUseCase removeMember)
    : ControllerBase
{
    [HttpGet("admin/committees")]
    public async Task<ActionResult<IReadOnlyList<CommitteeDto>>> List(
        [FromQuery] Guid cycleId,
        [FromQuery] string? status = null,
        [FromQuery] bool includeArchived = false,
        CancellationToken ct = default)
        => Ok(await list.ExecuteAsync(cycleId, status, includeArchived, ct));

    [HttpGet("admin/committees/{id:guid}")]
    public async Task<ActionResult<CommitteeDto>> Get(Guid id, CancellationToken ct)
    {
        var dto = await get.ExecuteAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost("admin/committees")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<ActionResult<CommitteeDto>> Create(
        [FromBody] CreateCommitteeRequest request, CancellationToken ct)
    {
        var dto = await create.ExecuteAsync(request, ct);
        return StatusCode(201, dto);
    }

    [HttpPatch("admin/committees/{id:guid}")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<ActionResult<CommitteeDto>> Update(
        Guid id, [FromBody] UpdateCommitteeRequest request, CancellationToken ct)
    {
        var dto = await update.ExecuteAsync(id, request, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost("admin/committees/{id:guid}/members")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<ActionResult<CommitteeMemberDto>> AddMember(
        Guid id, [FromBody] AddCommitteeMemberRequest request, CancellationToken ct)
    {
        var dto = await addMember.ExecuteAsync(id, request, ct);
        return dto is null ? NotFound() : StatusCode(201, dto);
    }

    [HttpDelete("admin/committees/{id:guid}/members/{userId:guid}")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<IActionResult> RemoveMember(Guid id, Guid userId, CancellationToken ct)
    {
        var ok = await removeMember.ExecuteAsync(id, userId, ct);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("admin/committees/{id:guid}/archive")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<IActionResult> Archive(
        Guid id, [FromBody] ArchiveCommitteeRequest request, CancellationToken ct)
    {
        var ok = await archive.ExecuteAsync(id, request.Reason, ct);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("admin/committees/{id:guid}/restore")]
    [Authorize(Policy = "*")]
    public async Task<ActionResult<CommitteeDto>> Restore(Guid id, CancellationToken ct)
    {
        var dto = await restore.ExecuteAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }
}
