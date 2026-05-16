using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PACademy.Modules.Grades.Application.Adjustments;
using PACademy.Modules.Grades.Application.Dtos;
using PACademy.Modules.Grades.Application.Grades;
using PACademy.Modules.Grades.Application.Import;

namespace PACademy.Api.Controllers.Admin;

[ApiController]
[Authorize(Policy = "admission-setup:read")]
public sealed class AdminApplicantGradesController(
    ListGradesUseCase list,
    ListPaginatedGradesUseCase listPaginated,
    ExportGradesUseCase export,
    ClearAllGradesUseCase clearAll,
    AddAdjustmentUseCase addAdjustment,
    ToggleAdjustmentUseCase toggleAdjustment,
    DeleteAdjustmentUseCase deleteAdjustment,
    UpdateOverrideMaxUseCase updateOverrideMax,
    StageImportUseCase stageImport,
    CommitImportUseCase commitImport,
    RunImportPreflightUseCase runPreflight,
    RunImportCommitUseCase runCommit) : ControllerBase
{
    [HttpGet("admin/grades")]
    public async Task<ActionResult<IReadOnlyList<GradeRowDto>>> List(CancellationToken ct)
        => Ok(await list.ExecuteAsync(ct));

    [HttpGet("admin/grades/paginated")]
    public async Task<ActionResult<PaginatedGradesResult>> ListPaginated(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] string? sortKey = null,
        [FromQuery] string? sortDirection = null,
        CancellationToken ct = default)
        => Ok(await listPaginated.ExecuteAsync(
            new ListPaginatedRequest(page, pageSize, search, sortKey, sortDirection), ct));

    [HttpGet("admin/grades/export")]
    public async Task<ActionResult<IReadOnlyList<GradeRowDto>>> Export(
        [FromQuery] string? search = null,
        [FromQuery] string? sortKey = null,
        [FromQuery] string? sortDirection = null,
        CancellationToken ct = default)
        => Ok(await export.ExecuteAsync(new ExportRequest(search, sortKey, sortDirection), ct));

    [HttpDelete("admin/grades")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<IActionResult> ClearAll(CancellationToken ct)
    {
        await clearAll.ExecuteAsync(ct);
        return NoContent();
    }

    [HttpPost("admin/grades/{seat:int}/adjustments")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<ActionResult<GradeRowDto>> AddAdjustment(
        int seat, [FromBody] AddAdjustmentRequest request, CancellationToken ct)
        => Ok(await addAdjustment.ExecuteAsync(seat, request, ct));

    [HttpPatch("admin/grades/{seat:int}/adjustments/{adjustmentId:guid}/toggle")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<ActionResult<GradeRowDto>> ToggleAdjustment(
        int seat, Guid adjustmentId, CancellationToken ct)
        => Ok(await toggleAdjustment.ExecuteAsync(seat, adjustmentId, ct));

    [HttpDelete("admin/grades/{seat:int}/adjustments/{adjustmentId:guid}")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<ActionResult<GradeRowDto>> DeleteAdjustment(
        int seat, Guid adjustmentId, CancellationToken ct)
        => Ok(await deleteAdjustment.ExecuteAsync(seat, adjustmentId, ct));

    [HttpPatch("admin/grades/{seat:int}/override-max")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<ActionResult<GradeRowDto>> UpdateOverrideMax(
        int seat, [FromBody] UpdateOverrideMaxRequest request, CancellationToken ct)
        => Ok(await updateOverrideMax.ExecuteAsync(seat, request, ct));

    [HttpPost("admin/grades/import/stage")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<ActionResult<StagedImportResult>> StageImport(
        [FromBody] StageImportRequest request, CancellationToken ct)
        => Ok(await stageImport.ExecuteAsync(request, ct));

    [HttpPost("admin/grades/import/commit")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<ActionResult<CommittedImportDto>> CommitImport(
        [FromBody] CommitImportRequest request, CancellationToken ct)
        => Ok(await commitImport.ExecuteAsync(request, ct));

    [HttpPost("admin/grades/import/preflight")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<ActionResult<ImportReportDto>> RunPreflight(
        [FromBody] RunImportPreflightRequest request, CancellationToken ct)
        => Ok(await runPreflight.ExecuteAsync(request, ct));

    [HttpPost("admin/grades/import/commit-v2")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<ActionResult<ImportCommitResultDto>> RunCommit(
        [FromBody] RunImportCommitRequest request, CancellationToken ct)
        => Ok(await runCommit.ExecuteAsync(request, ct));
}
