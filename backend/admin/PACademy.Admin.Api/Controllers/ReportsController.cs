using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using PACademy.Admin.Api.Modules.Reports.Dtos;
using PACademy.Admin.Api.Modules.Reports.Export;
using PACademy.Admin.Api.Modules.Reports.Queries;
using PACademy.Admin.Api.Modules.Reports.Validators;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("api/admin/reports")]
public sealed class ReportsController(
    ReportsQueryService reportQueries,
    ReportsOverviewService overview,
    ReportsExportHandler exportHandler,
    ReportsFiltersValidator filtersValidator) : ControllerBase
{
    [HttpGet("applicants/aggregate")]
    public async Task<ActionResult<object>> ApplicantsAggregate(
        [FromQuery] ReportsFiltersDto filters,
        [FromQuery] string groupBy = "committee",
        CancellationToken ct = default)
    {
        var validation = await filtersValidator.ValidateAsync(filters, ct);
        if (!validation.IsValid) return UnprocessableEntity(new { code = "VALIDATION_ERROR", errors = validation.Errors });
        return Ok(await reportQueries.AggregateAsync(filters, groupBy, ct));
    }

    [HttpGet("applicants/detail")]
    public async Task<ActionResult<object>> ApplicantsDetail(
        [FromQuery] ReportsFiltersDto filters,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        [FromQuery] string? sort = "submittedAt",
        [FromQuery] string? search = null,
        CancellationToken ct = default)
    {
        var validation = await filtersValidator.ValidateAsync(filters, ct);
        if (!validation.IsValid) return UnprocessableEntity(new { code = "VALIDATION_ERROR", errors = validation.Errors });
        if (pageSize > 200) return UnprocessableEntity(new { code = "VALIDATION_ERROR", errors = new[] { "pageSize must be <= 200" } });
        if (!string.IsNullOrWhiteSpace(sort) && !ReportsFiltersValidator.SortWhitelist.Contains(sort))
            return UnprocessableEntity(new { code = "VALIDATION_ERROR", errors = new[] { "sort is not supported" } });
        return Ok(await reportQueries.DetailAsync(filters, page, pageSize, sort, search, ct));
    }

    [HttpGet("stage-dropoff")]
    public async Task<ActionResult<object>> StageDropoff(
        [FromQuery] ReportsFiltersDto filters,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        [FromQuery] int staleDays = 7,
        CancellationToken ct = default)
    {
        var validation = await filtersValidator.ValidateAsync(filters, ct);
        if (!validation.IsValid) return UnprocessableEntity(new { code = "VALIDATION_ERROR", errors = validation.Errors });
        return Ok(await reportQueries.DropoffAsync(filters, page, pageSize, Math.Max(1, staleDays), ct));
    }

    [HttpGet("data-availability")]
    public async Task<ActionResult<DataAvailabilityReportDto>> DataAvailability(
        [FromQuery] ReportsFiltersDto filters,
        CancellationToken ct)
    {
        var validation = await filtersValidator.ValidateAsync(filters, ct);
        if (!validation.IsValid) return UnprocessableEntity(new { code = "VALIDATION_ERROR", errors = validation.Errors });
        return Ok(await reportQueries.ProbeAsync(filters, ct));
    }

    [HttpPost("export")]
    public async Task<IActionResult> Export([FromBody] ReportsExportRequest request, CancellationToken ct)
    {
        var validation = await filtersValidator.ValidateAsync(request.Filters, ct);
        if (!validation.IsValid) return UnprocessableEntity(new { code = "VALIDATION_ERROR", errors = validation.Errors });
        var result = await exportHandler.ExportAsync(request, ct);
        Response.Headers.ContentDisposition = $"attachment; filename=\"{result.FileName}\"";
        return File(result.Bytes, result.ContentType, result.FileName);
    }

    /* ── Overview datasets — all derived from live operational rows ── */

    [HttpGet("cycle-snapshot")]
    public async Task<ActionResult<object>> CycleSnapshot(CancellationToken ct) =>
        Ok(await overview.CycleSnapshotAsync(ct));

    [HttpGet("funnel")]
    public async Task<ActionResult<object>> Funnel(CancellationToken ct) =>
        Ok(await overview.FunnelAsync(ct));

    [HttpGet("by-department")]
    public async Task<ActionResult<object>> ByDepartment(CancellationToken ct) =>
        Ok(await overview.ByDepartmentAsync(ct));

    [HttpGet("test-results")]
    public async Task<ActionResult<object>> TestResults(CancellationToken ct) =>
        Ok(await overview.TestResultsAsync(ct));

    [HttpGet("operational-status")]
    public async Task<ActionResult<object>> OperationalStatus(CancellationToken ct) =>
        Ok(await overview.OperationalStatusAsync(ct));

    [HttpGet("governance")]
    public async Task<ActionResult<object>> Governance(CancellationToken ct) =>
        Ok(await overview.GovernanceAsync(ct));

    [HttpGet("integrations")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> Integrations(CancellationToken ct) =>
        Ok(await overview.IntegrationsAsync(ct));
}
