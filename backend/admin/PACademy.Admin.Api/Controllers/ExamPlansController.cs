using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Modules.Lookups;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("")]
public sealed class ExamPlansController(AdminRecordsService records, LookupsService lookups) : ControllerBase
{
    [HttpGet("api/exams/academy")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> AcademyExams(CancellationToken ct) =>
        Ok(await AcademyExamRowsAsync(ct));

    [HttpGet("api/cycles/{cycleId}/exam-plans")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> Plans(string cycleId, CancellationToken ct)
    {
        var rows = await records.ListAsync("examPlans", ct);
        var cycleRows = rows.Where(x => AdminRecordJson.StringProp(x, "cycleId") == cycleId).ToList();
        if (cycleRows.Count > 0) return Ok(cycleRows);
        var categories = await records.ListAsync("categories", ct);
        var defaults = new List<JsonObject>();
        foreach (var category in categories)
        {
            defaults.Add(await DefaultPlanAsync(cycleId, AdminRecordJson.StringProp(category, "key") ?? "officers_general", ct));
        }
        return Ok(defaults);
    }

    [HttpGet("api/cycles/{cycleId}/categories/{categoryId}/exam-plan")]
    public async Task<ActionResult<JsonObject>> Plan(string cycleId, string categoryId, CancellationToken ct)
    {
        var id = PlanId(cycleId, categoryId);
        var row = await records.GetAsync("examPlans", id, ct);
        return Ok(row ?? await DefaultPlanAsync(cycleId, categoryId, ct));
    }

    [HttpPut("api/cycles/{cycleId}/categories/{categoryId}/exam-plan")]
    public async Task<ActionResult<JsonObject>> SavePlan(string cycleId, string categoryId, [FromBody] JsonObject body, CancellationToken ct)
    {
        var id = PlanId(cycleId, categoryId);
        var plan = new JsonObject
        {
            ["id"] = id,
            ["cycleId"] = cycleId,
            ["categoryId"] = categoryId,
            ["exams"] = body["exams"]?.DeepClone() ?? await DefaultExamEntriesAsync(ct),
            ["updatedAt"] = DateTimeOffset.UtcNow.ToString("O")
        };
        return Ok(await records.UpsertAsync("examPlans", id, plan, ct));
    }

    [HttpPost("api/cycles/{cycleId}/exam-plans/copy")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> CopyPlans(string cycleId, [FromQuery(Name = "from")] string? fromCycleId, CancellationToken ct)
    {
        var source = (await records.ListAsync("examPlans", ct)).Where(x => AdminRecordJson.StringProp(x, "cycleId") == fromCycleId).ToList();
        if (source.Count == 0)
        {
            var categories = await records.ListAsync("categories", ct);
            source = new List<JsonObject>();
            foreach (var category in categories)
            {
                source.Add(await DefaultPlanAsync(fromCycleId ?? cycleId, AdminRecordJson.StringProp(category, "key") ?? "officers_general", ct));
            }
        }
        var copied = new List<JsonObject>();
        foreach (var item in source)
        {
            var categoryId = AdminRecordJson.StringProp(item, "categoryId") ?? "officers_general";
            var id = PlanId(cycleId, categoryId);
            var plan = new JsonObject
            {
                ["id"] = id,
                ["cycleId"] = cycleId,
                ["categoryId"] = categoryId,
                ["exams"] = item["exams"]?.DeepClone() ?? await DefaultExamEntriesAsync(ct),
                ["updatedAt"] = DateTimeOffset.UtcNow.ToString("O")
            };
            copied.Add(await records.UpsertAsync("examPlans", id, plan, ct));
        }
        return Ok(copied);
    }

    [HttpGet("api/exams/results/can-enter")]
    public ActionResult<object> CanEnter() => Ok(new { canEnter = true });

    [HttpPost("api/exams/results/{resultId}/transition")]
    public ActionResult<object> TransitionResult(string resultId, [FromBody] JsonObject body) => Ok(new { id = resultId, status = body["status"]?.GetValue<string>() ?? "draft" });

    [HttpPost("api/cycles/{cycleId}/exams/{examId}/results")]
    [HttpPost("api/cycles/{cycleId}/exams/{examId}/device-callback")]
    public async Task<ActionResult<object>> ResultEntry(string cycleId, string examId, [FromBody] JsonObject? body, CancellationToken ct)
    {
        var payload = body ?? [];
        var applicantId = AdminRecordJson.StringProp(payload, "applicantId") ?? AdminRecordJson.StringProp(payload, "nationalId") ?? "unknown";
        var id = AdminRecordJson.StringProp(payload, "id") ?? $"EXR-{cycleId}-{examId}-{applicantId}";
        payload["id"] = id;
        payload["cycleId"] = cycleId;
        payload["examId"] = examId;
        payload["receivedAt"] = DateTimeOffset.UtcNow.ToString("O");
        return Ok(await records.UpsertAsync("examResults", id, payload, ct));
    }

    [HttpPost("api/cycles/{cycleId}/exams/{examId}/results/bulk-upload")]
    public async Task<ActionResult<object>> BulkUpload(string cycleId, string examId, [FromBody] JsonObject? body, CancellationToken ct)
    {
        var rows = body?["rows"] as JsonArray ?? [];
        var imported = 0;
        var errors = new JsonArray();
        foreach (var row in rows.OfType<JsonObject>())
        {
            var applicantId = AdminRecordJson.StringProp(row, "applicantId") ?? AdminRecordJson.StringProp(row, "nationalId");
            if (string.IsNullOrWhiteSpace(applicantId))
            {
                errors.Add(new JsonObject { ["row"] = imported + errors.Count + 1, ["message"] = "applicantId مطلوب" });
                continue;
            }
            var id = AdminRecordJson.StringProp(row, "id") ?? $"EXR-{cycleId}-{examId}-{applicantId}";
            row["id"] = id;
            row["cycleId"] = cycleId;
            row["examId"] = examId;
            row["receivedAt"] = DateTimeOffset.UtcNow.ToString("O");
            await records.UpsertAsync("examResults", id, row, ct);
            imported++;
        }
        return Ok(new { imported, errors });
    }

    private static string PlanId(string cycleId, string categoryId) => $"EP-{cycleId}-{categoryId}";

    private async Task<JsonObject> DefaultPlanAsync(string cycleId, string categoryId, CancellationToken ct) => new()
    {
        ["id"] = PlanId(cycleId, categoryId),
        ["cycleId"] = cycleId,
        ["categoryId"] = categoryId,
        ["exams"] = await DefaultExamEntriesAsync(ct),
        ["updatedAt"] = DateTimeOffset.UtcNow.ToString("O")
    };

    private async Task<JsonArray> DefaultExamEntriesAsync(CancellationToken ct)
    {
        var rows = await TestLookupRowsAsync(ct);
        var entries = new JsonArray();
        var order = 1;
        foreach (var row in rows.Where(row => BoolProp(row, "required") ?? true))
        {
            entries.Add(new JsonObject
            {
                ["examId"] = StringProp(row, "code") ?? $"TST-{order:00}",
                ["order"] = order,
                ["isRequired"] = true
            });
            order++;
        }
        return entries;
    }

    private async Task<List<JsonObject>> AcademyExamRowsAsync(CancellationToken ct)
    {
        var rows = await TestLookupRowsAsync(ct);
        return rows.Select(row => new JsonObject
        {
            ["id"] = StringProp(row, "code"),
            ["key"] = StringProp(row, "code"),
            ["group"] = "admission",
            ["nameAr"] = StringProp(row, "name"),
            ["scoreType"] = "pass_fail",
            ["isQualifying"] = BoolProp(row, "required") ?? true,
            ["defaultOrder"] = IntProp(row, "order")
        }).ToList();
    }

    private async Task<IReadOnlyList<JsonObject>> TestLookupRowsAsync(CancellationToken ct)
    {
        var rows = await lookups.ListAsync("tests", true, null, ct);
        return rows
            .OrderBy(row => IntProp(row, "order") ?? int.MaxValue)
            .ThenBy(row => StringProp(row, "code"))
            .ToList();
    }

    private static string? StringProp(JsonObject obj, string name) =>
        obj.TryGetPropertyValue(name, out var node) ? node?.GetValue<string>() : null;

    private static bool? BoolProp(JsonObject obj, string name) =>
        obj.TryGetPropertyValue(name, out var node) ? node?.GetValue<bool>() : null;

    private static int? IntProp(JsonObject obj, string name) =>
        obj.TryGetPropertyValue(name, out var node) ? node?.GetValue<int>() : null;
}
