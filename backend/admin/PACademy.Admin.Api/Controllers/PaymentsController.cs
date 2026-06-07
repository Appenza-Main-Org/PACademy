using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using PACademy.Admin.Api.Modules.Payments;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("api/admin/payments")]
public sealed class PaymentsController(PaymentsLedgerService payments) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> List(
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] string? cycleId,
        CancellationToken ct) =>
        Ok(await payments.ListAsync(status, search, cycleId, ct));

    [HttpGet("refund-eligible")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> RefundEligible(CancellationToken ct) =>
        Ok(await payments.ListRefundEligibleAsync(ct));

    [HttpGet("{reference}")]
    public async Task<ActionResult<JsonObject?>> Get(string reference, CancellationToken ct)
    {
        var row = await payments.GetAsync(reference, ct);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost("{reference}/sync")]
    [HttpPost("{reference}/status")]
    [HttpPost("{reference}/refund")]
    public async Task<ActionResult<JsonObject>> Mutate(string reference, [FromBody] JsonObject? body, CancellationToken ct)
    {
        var patch = body ?? [];
        var row = await payments.MutateAsync(reference, patch, ct);
        return row is null ? NotFound() : Ok(row);
    }
}
