using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using PACademy.Admin.Api.Modules.AdminRecords;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("api/admin/payments")]
public sealed class PaymentsController(AdminRecordsService records) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> List(CancellationToken ct) => Ok(await records.ListAsync("payments", ct));

    [HttpGet("refund-eligible")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> RefundEligible(CancellationToken ct) =>
        Ok((await records.ListAsync("payments", ct)).Where(x => AdminRecordJson.StringProp(x, "status") == "paid").ToList());

    [HttpGet("{reference}")]
    public async Task<ActionResult<JsonObject?>> Get(string reference, CancellationToken ct)
    {
        var rows = await records.ListAsync("payments", ct);
        var row = rows.FirstOrDefault(x => AdminRecordJson.StringProp(x, "fawryReference") == reference || AdminRecordJson.StringProp(x, "id") == reference);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost("{reference}/sync")]
    [HttpPost("{reference}/status")]
    [HttpPost("{reference}/refund")]
    public async Task<ActionResult<JsonObject>> Mutate(string reference, [FromBody] JsonObject? body, CancellationToken ct)
    {
        var rows = await records.ListAsync("payments", ct);
        var row = rows.FirstOrDefault(x => AdminRecordJson.StringProp(x, "fawryReference") == reference || AdminRecordJson.StringProp(x, "id") == reference);
        if (row is null) return NotFound();
        var id = AdminRecordJson.StringProp(row, "id")!;
        var patch = body ?? [];
        patch["lastSyncAt"] = DateTimeOffset.UtcNow;
        return Ok(await records.UpsertAsync("payments", id, patch, ct));
    }
}
