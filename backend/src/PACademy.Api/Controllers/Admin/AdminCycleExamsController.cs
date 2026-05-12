using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PACademy.Modules.Admissions.Application.Admin.CycleExams;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;

namespace PACademy.Api.Controllers.Admin;

[ApiController]
[Authorize(Policy = "admission-setup:read")]
public sealed class AdminCycleExamsController(
    ListCycleExamsUseCase list,
    CreateCycleExamUseCase create,
    UpdateCycleExamUseCase update,
    ReorderCycleExamsUseCase reorder,
    ArchiveCycleExamUseCase archive,
    RestoreCycleExamUseCase restore)
    : ControllerBase
{
    [HttpGet("admin/cycles/{cycleId:guid}/exam-plan")]
    public async Task<ActionResult<IReadOnlyList<CycleExamDto>>> List(
        Guid cycleId, [FromQuery] Guid? categoryId = null, CancellationToken ct = default)
        => Ok(await list.ExecuteAsync(cycleId, categoryId, ct));

    [HttpPost("admin/cycles/{cycleId:guid}/exam-plan")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<ActionResult<CycleExamDto>> Create(
        Guid cycleId, [FromBody] CreateCycleExamRequest request, CancellationToken ct)
    {
        var dto = await create.ExecuteAsync(cycleId, request, ct);
        return StatusCode(201, dto);
    }

    [HttpPatch("admin/cycle-exams/{id:guid}")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<ActionResult<CycleExamDto>> Update(
        Guid id, [FromBody] UpdateCycleExamRequest request, CancellationToken ct)
    {
        var dto = await update.ExecuteAsync(id, request, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost("admin/cycles/{cycleId:guid}/exam-plan/reorder")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<ActionResult<IReadOnlyList<CycleExamDto>>> Reorder(
        Guid cycleId, [FromBody] ReorderCycleExamsRequest request, CancellationToken ct)
        => Ok(await reorder.ExecuteAsync(cycleId, request, ct));

    [HttpPost("admin/cycle-exams/{id:guid}/archive")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken ct)
    {
        var ok = await archive.ExecuteAsync(id, ct);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("admin/cycle-exams/{id:guid}/restore")]
    [Authorize(Policy = "*")]
    public async Task<ActionResult<CycleExamDto>> Restore(Guid id, CancellationToken ct)
    {
        var dto = await restore.ExecuteAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }
}
