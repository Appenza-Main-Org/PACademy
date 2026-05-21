using Microsoft.AspNetCore.Mvc;
using PACademy.Admin.Api.Modules.AdminRecords;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("api/admin/reports")]
public sealed class ReportsController(AdminRecordsService records) : ControllerBase
{
    [HttpGet("cycle-snapshot")]
    public async Task<ActionResult<object>> CycleSnapshot(CancellationToken ct) => Ok(new { kpis = await records.StatsAsync(ct), categories = Array.Empty<object>(), range = "today" });

    [HttpGet("funnel")]
    public ActionResult<object> Funnel() => Ok(new { stages = Array.Empty<object>() });

    [HttpGet("by-department")]
    public ActionResult<object> ByDepartment() => Ok(new { departments = Array.Empty<object>() });

    [HttpGet("test-results")]
    public ActionResult<object> TestResults() => Ok(new { rows = Array.Empty<object>(), heatmap = Array.Empty<object>() });

    [HttpGet("operational-status")]
    public async Task<ActionResult<object>> OperationalStatus(CancellationToken ct) => Ok(new { committees = await records.ListAsync("committeeInstances", ct) });

    [HttpGet("governance")]
    public async Task<ActionResult<object>> Governance(CancellationToken ct) => Ok(new { audit = (await records.ListAsync("audit", ct)).Take(20).ToList(), anomalies = Array.Empty<object>() });

    [HttpGet("integrations")]
    public ActionResult<object> Integrations() => Ok(new { systems = Array.Empty<object>() });
}
