using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using PACademy.Modules.ApplicantGradesAdmin.Application.Grades;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("api/admin/applicant-grades")]
public sealed class ApplicantGradesController(
    ListGradesUseCase listGrades,
    FindGradeByNidUseCase findByNid,
    ClearGradesUseCase clearGrades,
    StageImportUseCase stageImport,
    CommitStagedImportUseCase commitStagedImport,
    RunImportPreflightUseCase preflightImport,
    RunImportCommitUseCase commitImport,
    AddAdjustmentUseCase addAdjustment,
    ToggleAdjustmentUseCase toggleAdjustment,
    DeleteAdjustmentUseCase deleteAdjustment,
    UpdateOverrideMaxUseCase updateOverrideMax,
    IValidator<StageImportRequest> stageValidator,
    IValidator<RunImportCommitRequest> commitValidator,
    IValidator<AddAdjustmentRequest> adjustmentValidator,
    IValidator<UpdateOverrideMaxRequest> overrideValidator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] int? page,
        [FromQuery(Name = "size")] int? size,
        [FromQuery] int? pageSize,
        [FromQuery(Name = "q")] string? q,
        [FromQuery(Name = "search")] string? search,
        [FromQuery] string? sort,
        [FromQuery] string? sortKey,
        [FromQuery] string? sortDirection,
        [FromQuery] string? gender,
        [FromQuery] string? branch,
        [FromQuery(Name = "year")] int? year,
        [FromQuery] int? graduationYear,
        [FromQuery(Name = "school")] string? school,
        [FromQuery] string? schoolCategoryCode,
        [FromQuery(Name = "changed")] bool? changed,
        [FromQuery] bool? changedOnly,
        CancellationToken ct)
    {
        var computedSort = !string.IsNullOrWhiteSpace(sort)
            ? sort
            : !string.IsNullOrWhiteSpace(sortKey)
                ? $"{sortKey}:{(string.IsNullOrWhiteSpace(sortDirection) ? "asc" : sortDirection)}"
                : null;
        var filters = new GradeListFilters(
            page,
            size ?? pageSize,
            q ?? search,
            computedSort,
            gender,
            branch,
            year ?? graduationYear,
            school ?? schoolCategoryCode,
            changed ?? changedOnly);
        var result = await listGrades.ExecuteAsync(filters, ct);
        return page.HasValue || size.HasValue || pageSize.HasValue ? Ok(result) : Ok(result.Rows);
    }

    [HttpGet("export")]
    public async Task<IActionResult> Export([FromQuery] string? q, CancellationToken ct)
        => Ok((await listGrades.ExecuteAsync(new GradeListFilters(null, null, q, null, null, null, null, null, null), ct)).Rows);

    [HttpGet("by-nid/{nid}")]
    public async Task<IActionResult> ByNid([FromRoute] string nid, [FromQuery] string? cycleId, CancellationToken ct)
        => Ok(await findByNid.ExecuteAsync(nid, ct));

    [HttpDelete]
    public async Task<IActionResult> Clear(CancellationToken ct)
    {
        await clearGrades.ExecuteAsync(ct);
        return NoContent();
    }

    [HttpPost("delete")]
    public async Task<IActionResult> DeleteRows([FromBody] DeleteGradesRequest body, CancellationToken ct)
    {
        var deleted = await clearGrades.DeleteRowsAsync(body.Seats, ct);
        return Ok(new { deleted });
    }

    [HttpPost("import/stage")]
    public async Task<IActionResult> Stage([FromBody] StageImportRequest body, CancellationToken ct)
    {
        var validation = await stageValidator.ValidateAsync(body, ct);
        if (!validation.IsValid) return BadValidation(validation.Errors);
        return Ok(await stageImport.ExecuteAsync(body, ct));
    }

    [HttpPost("import/commit")]
    public async Task<IActionResult> CommitStaged([FromBody] CommitImportRequest body, CancellationToken ct)
        => Ok(await commitStagedImport.ExecuteAsync(body, ct));

    [HttpPost("import/preflight")]
    [HttpPost("v2/preflight")]
    public async Task<IActionResult> Preflight([FromBody] RunImportPreflightRequest body, CancellationToken ct)
        => Ok(await preflightImport.ExecuteAsync(body, ct));

    [HttpPost("import/v2/commit")]
    [HttpPost("v2/commit")]
    public async Task<IActionResult> Commit([FromBody] RunImportCommitRequest body, CancellationToken ct)
    {
        var validation = await commitValidator.ValidateAsync(body, ct);
        if (!validation.IsValid) return BadValidation(validation.Errors);
        return Ok(await commitImport.ExecuteAsync(body, ct));
    }

    [HttpPost("{seat:int}/adjustments")]
    public async Task<IActionResult> AddAdjustment([FromRoute] int seat, [FromBody] AddAdjustmentRequest body, CancellationToken ct)
    {
        var validation = await adjustmentValidator.ValidateAsync(body, ct);
        if (!validation.IsValid) return BadValidation(validation.Errors);
        var (ok, errorCode) = await addAdjustment.ExecuteAsync(seat, body, ct);
        return errorCode is null ? Ok(ok) : BadRequest(new { code = errorCode, message = "بيانات غير صالحة." });
    }

    [HttpPatch("{seat:int}/adjustments/{adjustmentId:guid}")]
    public async Task<IActionResult> ToggleAdjustment([FromRoute] int seat, [FromRoute] Guid adjustmentId, [FromBody] ToggleAdjustmentRequest body, CancellationToken ct)
        => Ok(await toggleAdjustment.ExecuteAsync(seat, adjustmentId, body, ct));

    [HttpDelete("{seat:int}/adjustments/{adjustmentId:guid}")]
    public async Task<IActionResult> DeleteAdjustment([FromRoute] int seat, [FromRoute] Guid adjustmentId, CancellationToken ct)
        => Ok(await deleteAdjustment.ExecuteAsync(seat, adjustmentId, ct));

    [HttpPatch("{seat:int}/override-max")]
    public async Task<IActionResult> UpdateOverrideMax([FromRoute] int seat, [FromBody] UpdateOverrideMaxRequest body, CancellationToken ct)
    {
        var validation = await overrideValidator.ValidateAsync(body, ct);
        if (!validation.IsValid) return BadValidation(validation.Errors);
        var (ok, errorCode) = await updateOverrideMax.ExecuteAsync(seat, body, ct);
        return errorCode is null ? Ok(ok) : BadRequest(new { code = errorCode, message = "بيانات غير صالحة." });
    }

    private BadRequestObjectResult BadValidation(IEnumerable<FluentValidation.Results.ValidationFailure> failures)
        => BadRequest(new
        {
            code = ErrorCodes.ValidationFailed,
            errors = failures.ToDictionary(
                e => char.ToLowerInvariant(e.PropertyName[0]) + e.PropertyName[1..],
                e => e.ErrorMessage),
            message = "بيانات غير صالحة.",
        });
}
