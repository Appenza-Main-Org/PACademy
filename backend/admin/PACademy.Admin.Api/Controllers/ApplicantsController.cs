using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using PACademy.Admin.Api.Modules.AdminRecords;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("")]
public sealed class ApplicantsController(AdminRecordsService records) : ControllerBase
{
    private static readonly ApplicantStatusOption[] StatusOptions =
    [
        new("pending", "في الانتظار", "neutral"),
        new("under-review", "قيد المراجعة", "warning"),
        new("approved", "مقبول", "success"),
        new("rejected", "مرفوض", "danger"),
        new("on-hold", "موقوف", "warning"),
        new("documents-required", "مستندات ناقصة", "info"),
        new("under_medical_review", "قيد الكشف الطبي", "info"),
        new("passed_physical", "اجتاز اللياقة", "success"),
        new("failed_interview", "لم يجتز المقابلة", "danger"),
        new("awaiting_board_decision", "بانتظار قرار الهيئة", "warning")
    ];

    [HttpGet("api/applicants")]
    public async Task<ActionResult<object>> List(CancellationToken ct) => Ok(await records.PageAsync("applicants", Request.Query, ct));

    [HttpGet("api/applicants/stats")]
    public async Task<ActionResult<object>> Stats(CancellationToken ct) => Ok(await records.StatsAsync(ct));

    [HttpGet("api/applicants/status-options")]
    public ActionResult<IReadOnlyList<ApplicantStatusOption>> StatusOptionsList() => Ok(StatusOptions);

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
    public async Task<ActionResult<IReadOnlyList<object>>> Timeline(string id, CancellationToken ct)
    {
        var applicant = await records.GetAsync("applicants", id, ct);
        if (applicant is null) return NotFound();
        var registeredAt = AdminRecordJson.StringProp(applicant, "registeredAt") ?? DateTimeOffset.UtcNow.ToString("O");
        var transitions = (await records.ListAsync("workflowTransitions", ct))
            .Where(x => AdminRecordJson.StringProp(x, "applicantId") == id)
            .Select(x => new
            {
                id = AdminRecordJson.StringProp(x, "id"),
                at = AdminRecordJson.StringProp(x, "ts") ?? registeredAt,
                type = "workflow",
                label = $"{AdminRecordJson.StringProp(x, "fromStatus") ?? "بدء"} ← {AdminRecordJson.StringProp(x, "toStatus") ?? "تحديث"}",
                actorName = AdminRecordJson.StringProp(x, "actorName") ?? "النظام",
                details = AdminRecordJson.StringProp(x, "reason") ?? ""
            })
            .Cast<object>()
            .ToList();
        var timeline = new List<object>
        {
            new
            {
                id = $"registered-{id}",
                at = registeredAt,
                type = "registration",
                label = "تسجيل ملف المتقدم",
                actorName = "النظام",
                details = AdminRecordJson.StringProp(applicant, "name") ?? id
            }
        };
        timeline.AddRange(transitions);
        return Ok(timeline);
    }

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

public sealed record ApplicantStatusOption(string Value, string Label, string Color);
