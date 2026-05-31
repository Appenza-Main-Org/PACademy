using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Infrastructure;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Modules.Lookups;
using PACademy.Admin.Api.Modules.Settings;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("")]
public sealed class OperationalAdminController(OperationalRecordsService records, ILookupsDbContext lookups, GeneralSettingsService generalSettings) : ControllerBase
{
    [HttpGet("api/committee-instances")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> CommitteeInstances(CancellationToken ct)
    {
        var activeCategoryCodes = await lookups.LookupRows
            .AsNoTracking()
            .Where(x => x.LookupKey == "applicant-categories" && x.IsActive)
            .Select(x => x.Code)
            .ToListAsync(ct);
        var active = activeCategoryCodes.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var rows = (await records.ListAsync("committeeInstances", ct))
            .Where(row =>
            {
                var categoryKey = AdminRecordJson.StringProp(row, "categoryKey");
                return !string.IsNullOrWhiteSpace(categoryKey) && active.Contains(categoryKey);
            })
            .ToList();
        return Ok(rows);
    }

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
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> RefreshReserved(CancellationToken ct)
    {
        var instances = await records.ListAsync("committeeInstances", ct);
        var applicants = await records.ListAsync("applicants", ct);
        var committees = await records.ListAsync("committees", ct);
        foreach (var instance in instances)
        {
            var definitionCode = AdminRecordJson.StringProp(instance, "definitionCode");
            var committee = committees.FirstOrDefault(x => AdminRecordJson.StringProp(x, "id") == definitionCode || AdminRecordJson.StringProp(x, "definitionCode") == definitionCode);
            var committeeName = committee is null ? null : AdminRecordJson.StringProp(committee, "name");
            var reserved = string.IsNullOrWhiteSpace(committeeName)
                ? AdminRecordJson.NumberProp(instance, "reserved") ?? 0
                : applicants.Count(x => AdminRecordJson.StringProp(x, "committee") == committeeName);
            instance["reserved"] = reserved;
            instance["reservedRefreshedAt"] = DateTimeOffset.UtcNow.ToString("O");
            await records.UpsertAsync("committeeInstances", AdminRecordJson.StringProp(instance, "id")!, instance, ct);
        }
        return Ok(await records.ListAsync("committeeInstances", ct));
    }

    [HttpDelete("api/committee-instances")]
    public async Task<ActionResult<object>> DeleteCommitteeDay([FromQuery] string? date, [FromQuery] string? categoryKey, CancellationToken ct)
    {
        var instances = await records.ListAsync("committeeInstances", ct);
        var targets = instances.Where(x =>
            (string.IsNullOrWhiteSpace(date) || AdminRecordJson.StringProp(x, "date") == date) &&
            (string.IsNullOrWhiteSpace(categoryKey) || AdminRecordJson.StringProp(x, "categoryKey") == categoryKey)).ToList();
        foreach (var target in targets)
        {
            await records.DeleteAsync("committeeInstances", AdminRecordJson.StringProp(target, "id")!, ct);
        }
        return Ok(new { deleted = targets.Count });
    }

    [HttpPost("api/committee-instances/transfer-day")]
    [HttpPost("api/committee-instances/{id}/transfer")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> TransferCommitteeDay(string? id, [FromBody] JsonObject? body, CancellationToken ct)
    {
        var fromDate = body is null ? null : AdminRecordJson.StringProp(body, "fromDate");
        var toDate = body is null ? null : AdminRecordJson.StringProp(body, "toDate");
        var instances = await records.ListAsync("committeeInstances", ct);
        var targets = instances.Where(x =>
            (!string.IsNullOrWhiteSpace(id) && AdminRecordJson.StringProp(x, "id") == id) ||
            (!string.IsNullOrWhiteSpace(fromDate) && AdminRecordJson.StringProp(x, "date") == fromDate)).ToList();
        foreach (var target in targets)
        {
            if (!string.IsNullOrWhiteSpace(toDate)) target["date"] = toDate;
            target["updatedAt"] = DateTimeOffset.UtcNow.ToString("O");
            await records.UpsertAsync("committeeInstances", AdminRecordJson.StringProp(target, "id")!, target, ct);
        }
        return Ok(await records.ListAsync("committeeInstances", ct));
    }

    [HttpGet("api/v1/admin/workflows")]
    [RequireBearerAuth]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> Workflows(CancellationToken ct) => Ok(await records.ListAsync("workflows", ct));

    [HttpGet("api/v1/admin/workflows/{id}")]
    public async Task<ActionResult<JsonObject?>> Workflow(string id, CancellationToken ct)
    {
        var row = await records.GetAsync("workflows", id, ct);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpGet("api/v1/admin/workflows/by-department")]
    [RequireBearerAuth]
    public async Task<ActionResult<JsonObject?>> WorkflowByDepartment([FromQuery] string? department, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(department))
        {
            return BadRequest(new ApiErrorEnvelope(
                ErrorCodes.ValidationFailed,
                Errors: new Dictionary<string, string[]> { ["department"] = ["القسم مطلوب"] },
                Message: "تحقق من البيانات المدخلة"));
        }

        var row = (await records.ListAsync("workflows", ct)).FirstOrDefault(x => AdminRecordJson.StringProp(x, "department") == department);
        return row is null ? NotFound(new ApiErrorEnvelope(ErrorCodes.NotFound, Message: "مسار العمل غير موجود")) : Ok(row);
    }

    [HttpPost("api/v1/admin/workflows")]
    [RequireBearerAuth]
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
        Ok(await generalSettings.GetAsync(ct));

    [HttpPatch("api/admin/settings")]
    public async Task<ActionResult<JsonObject>> UpdateSettings([FromBody] JsonObject body, CancellationToken ct) =>
        Ok(await generalSettings.UpdateAsync(body, ct));
}
