using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using PACademy.Admin.Api.Modules.AdminRecords;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("")]
public sealed class ApplicantsController(AdminRecordsService records) : ControllerBase
{
    [HttpGet("api/applicants")]
    public async Task<ActionResult<object>> List(CancellationToken ct) => Ok(await records.PageAsync("applicants", Request.Query, ct));

    [HttpGet("api/applicants/stats")]
    public async Task<ActionResult<object>> Stats(CancellationToken ct) => Ok(await records.StatsAsync(ct));

    [HttpGet("api/applicants/distribution")]
    public async Task<ActionResult<object>> Distribution([FromQuery] string field, CancellationToken ct) => Ok(await records.DistributionAsync(field, ct));

    [HttpGet("api/applicants/{id}")]
    [HttpGet("api/v1/applicants/{id}")]
    public async Task<ActionResult<JsonObject?>> Get(string id, CancellationToken ct)
    {
        var row = await records.GetAsync("applicants", id, ct);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpGet("api/applicants/{id}/timeline")]
    public ActionResult<IReadOnlyList<object>> Timeline(string id) => Ok(Array.Empty<object>());

    [HttpGet("api/v1/applicants/check-nid")]
    public async Task<ActionResult<object>> CheckNid([FromQuery] string nationalId, [FromQuery] string? excludeId, CancellationToken ct)
    {
        var rows = await records.ListAsync("applicants", ct);
        var exists = rows.Any(x => AdminRecordJson.StringProp(x, "nationalId") == nationalId && AdminRecordJson.StringProp(x, "id") != excludeId);
        return Ok(new { exists });
    }

    [HttpPost("api/v1/applicants")]
    public async Task<ActionResult<JsonObject>> Create([FromBody] JsonObject body, CancellationToken ct)
    {
        var id = $"APP-{DateTimeOffset.UtcNow:yyyy}{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        body["id"] = id;
        return Ok(await records.UpsertAsync("applicants", id, body, ct));
    }

    [HttpPut("api/v1/applicants/{id}")]
    public async Task<ActionResult<JsonObject>> Update(string id, [FromBody] JsonObject body, CancellationToken ct) =>
        Ok(await records.UpsertAsync("applicants", id, body, ct));

    [HttpPost("api/v1/applicants/{id}/transition")]
    public async Task<ActionResult<JsonObject>> Transition(string id, [FromBody] JsonObject body, CancellationToken ct)
    {
        var patch = new JsonObject { ["status"] = body["toStatus"]?.DeepClone() ?? "pending" };
        return Ok(await records.UpsertAsync("applicants", id, patch, ct));
    }

    [HttpGet("api/v1/applicants/{id}/workflow-progress")]
    public async Task<ActionResult<JsonObject?>> Progress(string id, CancellationToken ct)
    {
        var row = (await records.ListAsync("applicantWorkflowProgress", ct)).FirstOrDefault(x => AdminRecordJson.StringProp(x, "applicantId") == id);
        return Ok(row);
    }

    [HttpGet("api/v1/applicants/{id}/workflow-transitions")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> Transitions(string id, CancellationToken ct) =>
        Ok((await records.ListAsync("workflowTransitions", ct)).Where(x => AdminRecordJson.StringProp(x, "applicantId") == id).ToList());

    [HttpGet("api/v1/applicants/{id}/active-workflow")]
    public async Task<ActionResult<JsonObject?>> ActiveWorkflow(string id, CancellationToken ct) =>
        Ok((await records.ListAsync("workflows", ct)).FirstOrDefault());
}
