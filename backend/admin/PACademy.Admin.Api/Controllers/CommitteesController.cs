using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using PACademy.Admin.Api.Modules.AdminRecords;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("api/committees")]
public sealed class CommitteesController(AdminRecordsService records) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> List(CancellationToken ct) => Ok(await records.ListAsync("committees", ct));

    [HttpGet("eligible-officers")]
    public ActionResult<IReadOnlyList<object>> EligibleOfficers() => Ok(Array.Empty<object>());

    [HttpGet("specializations")]
    public ActionResult<IReadOnlyList<object>> Specializations() => Ok(Array.Empty<object>());

    [HttpGet("assignable/{applicantId}")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> Assignable(string applicantId, CancellationToken ct) => Ok(await records.ListAsync("committees", ct));

    [HttpGet("applicants")]
    public async Task<ActionResult<object>> Applicants(CancellationToken ct) => Ok(await records.PageAsync("applicants", Request.Query, ct));

    [HttpGet("schedule")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> Schedule(CancellationToken ct) => Ok(await records.ListAsync("committeeInstances", ct));

    [HttpPost("schedule")]
    [HttpPost("schedule/batch")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> SaveSchedule(CancellationToken ct) => Ok(await records.ListAsync("committeeInstances", ct));

    [HttpPatch("schedule/{id}")]
    public async Task<ActionResult<JsonObject>> UpdateSchedule(string id, [FromBody] JsonObject body, CancellationToken ct) =>
        Ok(await records.UpsertAsync("committeeInstances", id, body, ct));

    [HttpDelete("schedule/{id}")]
    public async Task<ActionResult<object>> DeleteSchedule(string id, CancellationToken ct) => Ok(new { deleted = await records.DeleteAsync("committeeInstances", id, ct) });

    [HttpGet("{id}")]
    public async Task<ActionResult<JsonObject?>> Get(string id, CancellationToken ct)
    {
        var row = await records.GetAsync("committees", id, ct);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost]
    public async Task<ActionResult<JsonObject>> Create([FromBody] JsonObject body, CancellationToken ct)
    {
        var id = AdminRecordJson.StringProp(body, "id") ?? $"COM-{Guid.NewGuid():N}";
        body["id"] = id;
        return Ok(await records.UpsertAsync("committees", id, body, ct));
    }

    [HttpPatch("{id}")]
    [HttpPost("{id}/status")]
    [HttpPost("{id}/schedule")]
    [HttpPost("{id}/soft-delete")]
    [HttpPost("{id}/restore")]
    public async Task<ActionResult<JsonObject>> Mutate(string id, [FromBody] JsonObject? body, CancellationToken ct) =>
        Ok(await records.UpsertAsync("committees", id, body ?? [], ct));

    [HttpGet("{id}/dependencies")]
    public ActionResult<object> Dependencies(string id) => Ok(new { counts = new { applicants = 0 }, blocking = false });

    [HttpGet("{id}/queue")]
    [HttpGet("{id}/results")]
    [HttpGet("{id}/applicants")]
    public ActionResult<IReadOnlyList<object>> EmptyList(string id) => Ok(Array.Empty<object>());

    [HttpPost("{id}/results")]
    [HttpPost("{id}/results/approve")]
    [HttpPost("{id}/results/bulk-upload")]
    [HttpPost("results/{resultId}/reject")]
    public ActionResult<object> ResultMutation() => Ok(new { ok = true });
}
