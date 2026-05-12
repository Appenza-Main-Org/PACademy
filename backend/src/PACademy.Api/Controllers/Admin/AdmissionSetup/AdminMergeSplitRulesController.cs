using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PACademy.Modules.Admissions.Application.Admin.MergeSplit;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;

namespace PACademy.Api.Controllers.Admin.AdmissionSetup;

[ApiController]
[Authorize(Policy = "admission-setup:read")]
public sealed class AdminMergeSplitRulesController(
    ListMergeSplitRulesUseCase list,
    GetMergeSplitRuleUseCase get,
    CreateMergeSplitRuleUseCase create,
    UpdateMergeSplitRuleUseCase update,
    CancelMergeSplitRuleUseCase cancel,
    ArchiveMergeSplitRuleUseCase archive,
    PreviewMergeSplitRuleUseCase preview,
    ApplyMergeSplitRuleUseCase apply)
    : ControllerBase
{
    [HttpGet("admin/admission-setup/cycles/{cycleId:guid}/merge-split-rules")]
    public async Task<ActionResult<IReadOnlyList<MergeSplitRuleDto>>> List(
        Guid cycleId, [FromQuery] string? status = null, CancellationToken ct = default)
        => Ok(await list.ExecuteAsync(cycleId, status, ct));

    [HttpGet("admin/admission-setup/merge-split-rules/{id:guid}")]
    public async Task<ActionResult<MergeSplitRuleDto>> Get(Guid id, CancellationToken ct)
    {
        var dto = await get.ExecuteAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost("admin/admission-setup/cycles/{cycleId:guid}/merge-split-rules")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<ActionResult<MergeSplitRuleDto>> Create(
        Guid cycleId, [FromBody] CreateMergeSplitRuleRequest request, CancellationToken ct)
    {
        var dto = await create.ExecuteAsync(cycleId, request, ct);
        return CreatedAtAction(nameof(Get), new { id = dto.Id }, dto);
    }

    [HttpPatch("admin/admission-setup/merge-split-rules/{id:guid}")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<ActionResult<MergeSplitRuleDto>> Update(
        Guid id, [FromBody] UpdateMergeSplitRuleRequest request, CancellationToken ct)
    {
        var dto = await update.ExecuteAsync(id, request, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost("admin/admission-setup/merge-split-rules/{id:guid}/cancel")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<ActionResult<MergeSplitRuleDto>> Cancel(
        Guid id, [FromBody] CancelMergeSplitRuleRequest request, CancellationToken ct)
    {
        var dto = await cancel.ExecuteAsync(id, request, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost("admin/admission-setup/merge-split-rules/{id:guid}/preview")]
    [Authorize(Policy = "admission-setup:apply")]
    public async Task<ActionResult<MergeSplitPreviewDto>> Preview(Guid id, CancellationToken ct)
    {
        var dto = await preview.ExecuteAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost("admin/admission-setup/merge-split-rules/{id:guid}/apply")]
    [Authorize(Policy = "admission-setup:apply")]
    public async Task<ActionResult<ApplyResultDto>> Apply(
        Guid id, [FromBody] ApplyMergeSplitRuleRequest request, CancellationToken ct)
        => Ok(await apply.ExecuteAsync(id, request, ct));

    [HttpPost("admin/admission-setup/merge-split-rules/{id:guid}/archive")]
    [Authorize(Policy = "*")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken ct)
    {
        var ok = await archive.ExecuteAsync(id, ct);
        return ok ? NoContent() : NotFound();
    }
}
