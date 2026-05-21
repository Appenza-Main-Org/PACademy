using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PACademy.Modules.CyclesAdmin.Infrastructure;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
public sealed class ExamPlansController(CyclesAdminDbContext db) : ControllerBase
{
    [HttpGet("api/cycles/{cycleId}/exam-plans")]
    public async Task<IActionResult> ListForCycle([FromRoute] string cycleId, CancellationToken ct)
        => Ok((await List("examPlans", ct))
            .Where(x => ReadString(x, "cycleId") == cycleId)
            .ToList());

    [HttpGet("api/cycles/{cycleId}/categories/{categoryId}/exam-plan")]
    public async Task<IActionResult> GetPlan([FromRoute] string cycleId, [FromRoute] string categoryId, CancellationToken ct)
        => Ok(await EnsurePlan(cycleId, categoryId, ct));

    [HttpPut("api/cycles/{cycleId}/categories/{categoryId}/exam-plan")]
    public async Task<IActionResult> SavePlan(
        [FromRoute] string cycleId,
        [FromRoute] string categoryId,
        [FromBody] JsonObject body,
        CancellationToken ct)
    {
        var entries = body["exams"] as JsonArray ?? [];
        var validation = ValidateEntries(entries);
        if (validation.Count > 0)
        {
            var conflict = validation.FirstOrDefault(x => ReadString(x, "code") == "EXAM_ORDER_DUPLICATE");
            if (conflict is not null)
            {
                return Conflict(new
                {
                    code = "CONFLICT",
                    conflictCode = "EXAM_ORDER_DUPLICATE",
                    errors = validation,
                    message = ReadString(conflict, "message") ?? "ترتيب الاختبارات مكرر",
                });
            }
            return BadRequest(new { code = "VALIDATION_ERROR", errors = validation, message = "خطة الاختبارات غير مكتملة" });
        }

        var existing = (await List("examPlans", ct)).FirstOrDefault(x =>
            ReadString(x, "cycleId") == cycleId && ReadString(x, "categoryId") == categoryId);
        var id = ReadString(existing, "id") ?? $"EP-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        var next = new JsonObject
        {
            ["id"] = id,
            ["cycleId"] = cycleId,
            ["categoryId"] = categoryId,
            ["exams"] = entries.DeepClone(),
            ["updatedAt"] = DateTimeOffset.UtcNow.ToString("O"),
        };
        await Upsert("examPlans", id, next, ct);
        return Ok(next);
    }

    [HttpPost("api/cycles/{targetCycleId}/exam-plans/copy")]
    public async Task<IActionResult> CopyPlans(
        [FromRoute] string targetCycleId,
        [FromQuery(Name = "from")] string sourceCycleId,
        CancellationToken ct)
    {
        var sourcePlans = (await List("examPlans", ct))
            .Where(x => ReadString(x, "cycleId") == sourceCycleId)
            .ToList();
        if (sourcePlans.Count == 0)
        {
            return BadRequest(new { code = "VALIDATION_ERROR", message = "الدورة المصدر لا تحتوي على خطط اختبارات لنسخها" });
        }

        var existing = await db.Items.Where(x => x.Bucket == "examPlans").ToListAsync(ct);
        foreach (var item in existing)
        {
            var payload = Parse(item.PayloadJson);
            if (ReadString(payload, "cycleId") == targetCycleId) db.Items.Remove(item);
        }
        await db.SaveChangesAsync(ct);

        var cloned = new List<JsonObject>();
        var counter = 1;
        foreach (var source in sourcePlans)
        {
            var categoryId = ReadString(source, "categoryId") ?? "officers_general";
            var id = $"EP-{targetCycleId}-{categoryId}-{counter++}";
            var row = new JsonObject
            {
                ["id"] = id,
                ["cycleId"] = targetCycleId,
                ["categoryId"] = categoryId,
                ["exams"] = source["exams"]?.DeepClone() ?? new JsonArray(),
                ["updatedAt"] = DateTimeOffset.UtcNow.ToString("O"),
            };
            await Upsert("examPlans", id, row, ct);
            cloned.Add(row);
        }
        return Ok(cloned);
    }

    private async Task<JsonObject> EnsurePlan(string cycleId, string categoryId, CancellationToken ct)
    {
        var existing = (await List("examPlans", ct)).FirstOrDefault(x =>
            ReadString(x, "cycleId") == cycleId && ReadString(x, "categoryId") == categoryId);
        if (existing is not null) return existing;

        var id = $"EP-{cycleId}-{categoryId}";
        var row = new JsonObject
        {
            ["id"] = id,
            ["cycleId"] = cycleId,
            ["categoryId"] = categoryId,
            ["exams"] = new JsonArray(DefaultExamEntries().Select(x => x.DeepClone()).ToArray()),
            ["updatedAt"] = DateTimeOffset.UtcNow.ToString("O"),
        };
        await Upsert("examPlans", id, row, ct);
        return row;
    }

    private static List<JsonObject> ValidateEntries(JsonArray entries)
    {
        var errors = new List<JsonObject>();
        var knownExamIds = AcademyExamIds.ToHashSet(StringComparer.Ordinal);
        var orders = new Dictionary<int, int>();
        var examIds = new HashSet<string>(StringComparer.Ordinal);
        for (var i = 0; i < entries.Count; i++)
        {
            if (entries[i] is not JsonObject entry)
            {
                errors.Add(Error($"exams[{i}]", "INVALID_ROW", "صف الاختبار غير صحيح"));
                continue;
            }
            var examId = ReadString(entry, "examId");
            if (string.IsNullOrWhiteSpace(examId))
            {
                errors.Add(Error($"exams[{i}].examId", "REQUIRED", "الاختبار مطلوب"));
            }
            else if (!knownExamIds.Contains(examId))
            {
                errors.Add(Error($"exams[{i}].examId", "EXAM_NOT_FOUND", "الاختبار غير موجود"));
            }
            else if (!examIds.Add(examId))
            {
                errors.Add(Error($"exams[{i}].examId", "DUPLICATE_EXAM", "لا يمكن إضافة نفس الاختبار أكثر من مرة"));
            }

            var order = ReadInt(entry, "order");
            if (order is null || order <= 0)
            {
                errors.Add(Error($"exams[{i}].order", "ORDER_NOT_POSITIVE", "الترتيب يجب أن يكون رقمًا موجبًا"));
            }
            else
            {
                orders[order.Value] = (orders.GetValueOrDefault(order.Value) + 1);
            }
        }

        foreach (var (order, count) in orders)
        {
            if (count > 1)
            {
                errors.Add(Error("exams.order", "EXAM_ORDER_DUPLICATE", $"الترتيب {order} مستخدم أكثر من مرة في خطة الاختبارات"));
            }
        }
        return errors;
    }

    private async Task<List<JsonObject>> List(string bucket, CancellationToken ct)
        => (await db.Items.AsNoTracking()
            .Where(x => x.Bucket == bucket)
            .OrderBy(x => x.SortOrder)
            .Select(x => x.PayloadJson)
            .ToListAsync(ct))
            .Select(Parse)
            .ToList();

    private async Task Upsert(string bucket, string id, JsonObject payload, CancellationToken ct)
    {
        var item = await db.Items.FirstOrDefaultAsync(x => x.Bucket == bucket && x.Id == id, ct);
        if (item is null)
        {
            var max = await db.Items.Where(x => x.Bucket == bucket).Select(x => (int?)x.SortOrder).MaxAsync(ct) ?? -1;
            db.Items.Add(AdminJsonItem.Create(bucket, id, payload.ToJsonString(JsonOptions), max + 1));
        }
        else
        {
            item.ReplacePayload(payload.ToJsonString(JsonOptions));
        }
        await db.SaveChangesAsync(ct);
    }

    private static JsonObject Error(string field, string code, string message)
        => new() { ["field"] = field, ["code"] = code, ["message"] = message };

    private static JsonObject Parse(string payload)
        => JsonNode.Parse(payload)?.AsObject() ?? new JsonObject();

    private static string? ReadString(JsonObject? obj, string property)
        => obj is not null && obj.TryGetPropertyValue(property, out var value) ? value?.GetValue<string>() : null;

    private static int? ReadInt(JsonObject obj, string property)
    {
        if (!obj.TryGetPropertyValue(property, out var value) || value is null) return null;
        try { return value.GetValue<int>(); }
        catch { return null; }
    }

    private static List<JsonObject> DefaultExamEntries()
        => QualifyingAcademyExamIds
            .Select((examId, index) => new JsonObject
            {
                ["examId"] = examId,
                ["order"] = index + 1,
                ["isRequired"] = true,
            })
            .ToList();

    private static readonly string[] AcademyExamIds =
    [
        "AX-01", "AX-02", "AX-03", "AX-04", "AX-05", "AX-06", "AX-07",
        "AX-08", "AX-09", "AX-10", "AX-11", "AX-12", "AX-13",
    ];

    private static readonly string[] QualifyingAcademyExamIds =
    [
        "AX-01", "AX-02", "AX-03", "AX-04", "AX-05", "AX-07",
        "AX-08", "AX-10", "AX-12", "AX-13",
    ];

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
}
