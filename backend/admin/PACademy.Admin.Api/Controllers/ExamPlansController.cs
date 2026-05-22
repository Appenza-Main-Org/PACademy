using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using PACademy.Admin.Api.Modules.AdminRecords;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("")]
public sealed class ExamPlansController(AdminRecordsService records) : ControllerBase
{
    [HttpGet("api/exams/academy")]
    public ActionResult<IReadOnlyList<JsonObject>> AcademyExams() => Ok(AcademyExamRows());

    [HttpGet("api/cycles/{cycleId}/exam-plans")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> Plans(string cycleId, CancellationToken ct)
    {
        var rows = await records.ListAsync("examPlans", ct);
        var cycleRows = rows.Where(x => AdminRecordJson.StringProp(x, "cycleId") == cycleId).ToList();
        if (cycleRows.Count > 0) return Ok(cycleRows);
        var categories = await records.ListAsync("categories", ct);
        return Ok(categories.Select(c => DefaultPlan(cycleId, AdminRecordJson.StringProp(c, "key") ?? "officers_general")).ToList());
    }

    [HttpGet("api/cycles/{cycleId}/categories/{categoryId}/exam-plan")]
    public async Task<ActionResult<JsonObject>> Plan(string cycleId, string categoryId, CancellationToken ct)
    {
        var id = PlanId(cycleId, categoryId);
        var row = await records.GetAsync("examPlans", id, ct);
        return Ok(row ?? DefaultPlan(cycleId, categoryId));
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
            ["exams"] = body["exams"]?.DeepClone() ?? DefaultExamEntries(),
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
            source = categories.Select(c => DefaultPlan(fromCycleId ?? cycleId, AdminRecordJson.StringProp(c, "key") ?? "officers_general")).ToList();
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
                ["exams"] = item["exams"]?.DeepClone() ?? DefaultExamEntries(),
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
    public ActionResult<object> ResultEntry() => Ok(new { ok = true });

    [HttpPost("api/cycles/{cycleId}/exams/{examId}/results/bulk-upload")]
    public ActionResult<object> BulkUpload() => Ok(new { imported = 0, errors = Array.Empty<object>() });

    private static string PlanId(string cycleId, string categoryId) => $"EP-{cycleId}-{categoryId}";

    private static JsonObject DefaultPlan(string cycleId, string categoryId) => new()
    {
        ["id"] = PlanId(cycleId, categoryId),
        ["cycleId"] = cycleId,
        ["categoryId"] = categoryId,
        ["exams"] = DefaultExamEntries(),
        ["updatedAt"] = DateTimeOffset.UtcNow.ToString("O")
    };

    private static JsonArray DefaultExamEntries() => new(
        new JsonObject { ["examId"] = "medical", ["order"] = 1, ["isRequired"] = true, ["minScore"] = 0 },
        new JsonObject { ["examId"] = "physical", ["order"] = 2, ["isRequired"] = true, ["minScore"] = 50 },
        new JsonObject { ["examId"] = "psychological", ["order"] = 3, ["isRequired"] = true, ["minScore"] = 50 },
        new JsonObject { ["examId"] = "interview", ["order"] = 4, ["isRequired"] = true, ["minScore"] = 0 }
    );

    private static List<JsonObject> AcademyExamRows() =>
    [
        new() { ["id"] = "medical", ["nameAr"] = "الكشف الطبي", ["kind"] = "medical", ["defaultOrder"] = 1 },
        new() { ["id"] = "physical", ["nameAr"] = "الاختبار الرياضي", ["kind"] = "physical", ["defaultOrder"] = 2 },
        new() { ["id"] = "psychological", ["nameAr"] = "الاختبار النفسي", ["kind"] = "psychological", ["defaultOrder"] = 3 },
        new() { ["id"] = "interview", ["nameAr"] = "المقابلة الشخصية", ["kind"] = "interview", ["defaultOrder"] = 4 },
        new() { ["id"] = "drug", ["nameAr"] = "تحليل المخدرات", ["kind"] = "drug", ["defaultOrder"] = 5 }
    ];
}
