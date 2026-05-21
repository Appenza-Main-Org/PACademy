using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using PACademy.Admin.Api.Modules.AdminRecords;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("")]
public sealed class OperationalAdminController(AdminRecordsService records) : ControllerBase
{
    [HttpGet("api/committee-instances")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> CommitteeInstances(CancellationToken ct) => Ok(await records.ListAsync("committeeInstances", ct));

    [HttpPost("api/committee-instances")]
    public async Task<ActionResult<object>> AddCommitteeInstances([FromBody] JsonNode body, CancellationToken ct)
    {
        if (body is JsonArray arr)
        {
            foreach (var node in arr.OfType<JsonObject>())
            {
                var id = AdminRecordJson.StringProp(node, "id") ?? $"CI-{Guid.NewGuid():N}";
                await records.UpsertAsync("committeeInstances", id, node, ct);
            }
            return Ok(await records.ListAsync("committeeInstances", ct));
        }
        var obj = body as JsonObject ?? [];
        var singleId = AdminRecordJson.StringProp(obj, "id") ?? $"CI-{Guid.NewGuid():N}";
        return Ok(await records.UpsertAsync("committeeInstances", singleId, obj, ct));
    }

    [HttpPatch("api/committee-instances/{id}")]
    public async Task<ActionResult<JsonObject>> UpdateCommitteeInstance(string id, [FromBody] JsonObject body, CancellationToken ct) =>
        Ok(await records.UpsertAsync("committeeInstances", id, body, ct));

    [HttpDelete("api/committee-instances/{id}")]
    public async Task<ActionResult<object>> DeleteCommitteeInstance(string id, CancellationToken ct) =>
        Ok(new { deleted = await records.DeleteAsync("committeeInstances", id, ct) });

    [HttpPost("api/committee-instances/refresh-reserved")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> RefreshReserved(CancellationToken ct) => Ok(await records.ListAsync("committeeInstances", ct));

    [HttpDelete("api/committee-instances")]
    public ActionResult<object> DeleteCommitteeDay() => Ok(new { deleted = true });

    [HttpPost("api/committee-instances/transfer-day")]
    [HttpPost("api/committee-instances/{id}/transfer")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> TransferCommitteeDay(CancellationToken ct) => Ok(await records.ListAsync("committeeInstances", ct));

    [HttpGet("api/v1/admin/workflows")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> Workflows(CancellationToken ct) => Ok(await records.ListAsync("workflows", ct));

    [HttpGet("api/v1/admin/workflows/{id}")]
    public async Task<ActionResult<JsonObject?>> Workflow(string id, CancellationToken ct)
    {
        var row = await records.GetAsync("workflows", id, ct);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpGet("api/v1/admin/workflows/by-department")]
    public async Task<ActionResult<JsonObject?>> WorkflowByDepartment([FromQuery] string department, CancellationToken ct)
    {
        var row = (await records.ListAsync("workflows", ct)).FirstOrDefault(x => AdminRecordJson.StringProp(x, "department") == department);
        return Ok(row);
    }

    [HttpPost("api/v1/admin/workflows")]
    public async Task<ActionResult<JsonObject>> CreateWorkflow([FromBody] JsonObject body, CancellationToken ct)
    {
        var id = AdminRecordJson.StringProp(body, "id") ?? $"WF-{Guid.NewGuid():N}";
        body["id"] = id;
        return Ok(await records.UpsertAsync("workflows", id, body, ct));
    }

    [HttpPut("api/v1/admin/workflows/{id}")]
    [HttpPost("api/v1/admin/workflows/{id}/reorder")]
    [HttpPost("api/v1/admin/workflows/{id}/apply")]
    public async Task<ActionResult<JsonObject>> MutateWorkflow(string id, [FromBody] JsonObject body, CancellationToken ct) =>
        Ok(await records.UpsertAsync("workflows", id, body, ct));

    [HttpDelete("api/v1/admin/workflows/{id}")]
    public async Task<ActionResult<object>> DeleteWorkflow(string id, CancellationToken ct) =>
        Ok(new { deleted = await records.DeleteAsync("workflows", id, ct) });

    [HttpGet("api/admin/settings")]
    public async Task<ActionResult<JsonObject>> Settings(CancellationToken ct) =>
        Ok(await records.SingletonAsync("settings", new JsonObject(), ct));

    [HttpPatch("api/admin/settings")]
    public async Task<ActionResult<JsonObject>> UpdateSettings([FromBody] JsonObject body, CancellationToken ct) =>
        Ok(await records.UpsertAsync("settings", "settings", body, ct));
}
