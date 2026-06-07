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
        [FromQuery] ApplicantGradesListQuery query,
        CancellationToken ct)
    {
        var result = await listGrades.ExecuteAsync(query.ToPagedFilters(), ct);
        return query.HasPaging ? Ok(result) : Ok(result.Rows);
    }

    [HttpGet("export")]
    public async Task<IActionResult> Export(
        [FromQuery] ApplicantGradesListQuery query,
        CancellationToken ct)
        => Ok((await listGrades.ExecuteAsync(query.ToExportFilters(), ct)).Rows);

    [HttpGet("by-nid/{nid}")]
    public async Task<IActionResult> ByNid([FromRoute] string nid, [FromQuery] string? cycleId, CancellationToken ct)
        => Ok(await findByNid.ExecuteAsync(nid, ct));

    [HttpDelete]
    public async Task<IActionResult> Clear(CancellationToken ct)
    {
        var deleted = await clearGrades.ExecuteAsync(ct);
        return Ok(new { deleted });
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

public sealed class ApplicantGradesListQuery
{
    public int? Page { get; set; }

    [FromQuery(Name = "size")]
    public int? Size { get; set; }

    public int? PageSize { get; set; }

    [FromQuery(Name = "q")]
    public string? Q { get; set; }

    [FromQuery(Name = "search")]
    public string? Search { get; set; }

    public string? Sort { get; set; }
    public string? SortKey { get; set; }
    public string? SortDirection { get; set; }
    public string? Gender { get; set; }
    public string? Branch { get; set; }

    [FromQuery(Name = "year")]
    public int? Year { get; set; }

    public int? GraduationYear { get; set; }

    [FromQuery(Name = "school")]
    public string? School { get; set; }

    public string? SchoolCategoryCode { get; set; }
    public string? SchoolName { get; set; }
    public string[]? SchoolCategoryCodes { get; set; }

    [FromQuery(Name = "changed")]
    public bool? Changed { get; set; }

    public bool? ChangedOnly { get; set; }
    public string? Nid { get; set; }
    public string? SeatingNumber { get; set; }
    public string? Name { get; set; }
    public decimal? TotalMin { get; set; }
    public decimal? TotalMax { get; set; }
    public decimal? PctMin { get; set; }
    public decimal? PctMax { get; set; }
    public decimal? EffMin { get; set; }
    public decimal? EffMax { get; set; }
    public int? GraduationYearMin { get; set; }
    public int? GraduationYearMax { get; set; }

    public bool HasPaging => Page.HasValue || Size.HasValue || PageSize.HasValue;

    public GradeListFilters ToPagedFilters()
        => CreateFilters(Page, Size ?? PageSize);

    public GradeListFilters ToExportFilters()
        => CreateFilters(null, null);

    private GradeListFilters CreateFilters(int? page, int? pageSize)
        => new(
            page,
            pageSize,
            Q ?? Search,
            ComputedSort,
            Gender,
            Branch,
            Year ?? GraduationYear,
            School ?? SchoolCategoryCode,
            Changed ?? ChangedOnly,
            Nid,
            SeatingNumber,
            Name,
            SchoolName,
            SchoolCategoryCodes?.Where(x => !string.IsNullOrWhiteSpace(x)).ToArray(),
            TotalMin,
            TotalMax,
            PctMin,
            PctMax,
            EffMin,
            EffMax,
            GraduationYearMin,
            GraduationYearMax);

    private string? ComputedSort => !string.IsNullOrWhiteSpace(Sort)
        ? Sort
        : !string.IsNullOrWhiteSpace(SortKey)
            ? $"{SortKey}:{(string.IsNullOrWhiteSpace(SortDirection) ? "asc" : SortDirection)}"
            : null;
}
