using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("")]
public sealed class AdmissionSetupController(AdminRecordsService records) : ControllerBase
{
    [HttpGet("api/admission-setup/cycles/{cycleId}/exam-dates")]
    public async Task<ActionResult<JsonObject>> ExamDates(string cycleId, CancellationToken ct) =>
        Ok(await records.SingletonAsync($"admissionSetup.examDates.{cycleId}", new JsonObject { ["cycleId"] = cycleId, ["ranges"] = new JsonArray() }, ct));

    [HttpPut("api/admission-setup/cycles/{cycleId}/exam-dates")]
    public async Task<ActionResult<JsonObject>> SaveExamDates(string cycleId, [FromBody] JsonObject body, CancellationToken ct)
    {
        ValidateExamDateRanges(body);
        body["cycleId"] = cycleId;
        var module = $"admissionSetup.examDates.{cycleId}";
        return Ok(await records.UpsertAsync(module, module, body, ct));
    }

    [HttpGet("api/admission-setup/cycles/{cycleId}/declaration")]
    public async Task<ActionResult<JsonObject>> Declaration(string cycleId, CancellationToken ct) =>
        Ok(await records.SingletonAsync($"admissionSetup.declaration.{cycleId}", new JsonObject { ["id"] = $"DECL-{cycleId}", ["cycleId"] = cycleId, ["bodyAr"] = "", ["published"] = false }, ct));

    [HttpPut("api/admission-setup/cycles/{cycleId}/declaration")]
    public async Task<ActionResult<JsonObject>> SaveDeclaration(string cycleId, [FromBody] JsonObject body, CancellationToken ct)
    {
        body["id"] = $"DECL-{cycleId}";
        body["cycleId"] = cycleId;
        body["updatedAt"] = DateTimeOffset.UtcNow.ToString("O");
        return Ok(await records.UpsertAsync($"admissionSetup.declaration.{cycleId}", $"DECL-{cycleId}", body, ct));
    }

    [HttpPost("api/admission-setup/declarations/{declarationId}/publish")]
    public async Task<ActionResult<JsonObject>> PublishDeclaration(string declarationId, CancellationToken ct)
    {
        var cycleId = declarationId.Replace("DECL-", "", StringComparison.OrdinalIgnoreCase);
        var declaration = await records.GetAsync($"admissionSetup.declaration.{cycleId}", declarationId, ct)
            ?? new JsonObject { ["id"] = declarationId, ["cycleId"] = cycleId, ["bodyAr"] = "" };
        if (string.IsNullOrWhiteSpace(AdminRecordJson.StringProp(declaration, "bodyAr")))
        {
            throw new ConflictException("DECLARATION_EMPTY", "لا يمكن نشر إقرار إلكتروني فارغ");
        }
        declaration["published"] = true;
        declaration["publishedAt"] = DateTimeOffset.UtcNow.ToString("O");
        return Ok(await records.UpsertAsync($"admissionSetup.declaration.{cycleId}", declarationId, declaration, ct));
    }

    [HttpGet("api/admission-setup/cycles/{cycleId}/committee-bindings")]
    public async Task<ActionResult<JsonArray>> AdmissionCommitteeBindings(string cycleId, CancellationToken ct)
    {
        var stored = await records.SingletonAsync($"admissionSetup.committeeBindings.{cycleId}", new JsonObject { ["cycleId"] = cycleId, ["bindings"] = new JsonArray() }, ct);
        return Ok(stored["bindings"]?.AsArray() ?? new JsonArray());
    }

    [HttpPut("api/admission-setup/cycles/{cycleId}/committee-bindings")]
    public async Task<ActionResult<JsonNode>> SaveAdmissionCommitteeBindings(string cycleId, [FromBody] JsonObject body, CancellationToken ct)
    {
        ValidateCommitteeBindingArray(body["bindings"]?.AsArray());
        body["cycleId"] = cycleId;
        var module = $"admissionSetup.committeeBindings.{cycleId}";
        return Ok(await records.UpsertAsync(module, module, body, ct));
    }

    [HttpGet("api/admin/app-settings/category-configs")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> CategoryConfigs(CancellationToken ct)
    {
        var categories = await records.ListAsync("categories", ct);
        return Ok(categories.Select((c, index) => CategoryConfig(c, index)).ToList());
    }

    [HttpGet("api/admin/app-settings/summary")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> AppSettingsSummary(CancellationToken ct)
    {
        var categories = await records.ListAsync("categories", ct);
        return Ok(categories.Select((c, index) => new JsonObject
        {
            ["config"] = CategoryConfig(c, index),
            ["groups"] = new JsonArray(),
            ["gradingMode"] = "GRADES"
        }).ToList());
    }

    [HttpGet("api/admin/app-settings/category-configs/{configId}/specializations")]
    [HttpGet("api/admin/app-settings/category-configs/{configId}/eligible-specializations")]
    [HttpGet("api/admin/app-settings/category-configs/{configId}/years")]
    [HttpGet("api/admin/app-settings/specializations/{id}")]
    [HttpGet("api/admin/app-settings/years/{id}")]
    public ActionResult<object> AppSettingsDetail() => Ok(Array.Empty<object>());

    [HttpGet("api/admin/app-settings/specializations/{id}/grading-mode")]
    public ActionResult<object> AppSettingsGradingMode() => Ok(new { gradingMode = "GRADES" });

    [HttpGet("api/admin/app-settings/specializations/{id}/parent-category")]
    public ActionResult<object> AppSettingsParentCategory() => Ok(new { code = "CAT-01", lockedGender = (string?)null });

    [HttpPost("api/admin/app-settings/category-configs/{configId}/specializations")]
    [HttpPost("api/admin/app-settings/category-configs/{configId}/years")]
    [HttpPost("api/admin/app-settings/bulk-save")]
    [HttpPatch("api/admin/app-settings/category-configs/{configId}")]
    [HttpPatch("api/admin/app-settings/years/{id}")]
    [HttpPost("api/admin/app-settings/years/{id}/toggle-active")]
    public async Task<ActionResult<JsonObject>> MutateAppSettings([FromBody] JsonObject? body, CancellationToken ct)
    {
        var payload = body ?? new JsonObject { ["ok"] = true };
        ValidatePercentRange(payload);
        var id = $"app-settings-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        return Ok(await records.UpsertAsync("admissionSetup.appSettings", id, payload, ct));
    }

    [HttpDelete("api/admin/app-settings/specializations/{id}")]
    [HttpDelete("api/admin/app-settings/years/{id}")]
    public ActionResult<object> DeleteAppSettings() => Ok(new { deleted = true });

    [HttpGet("api/admin/exam-schedule/cycles/{cycleId}")]
    public async Task<ActionResult<JsonArray>> ExamSchedule(string cycleId, CancellationToken ct)
    {
        var stored = await records.SingletonAsync($"admissionSetup.examSchedule.{cycleId}", new JsonObject { ["cycleId"] = cycleId, ["days"] = new JsonArray() }, ct);
        return Ok(stored["days"]?.AsArray() ?? new JsonArray());
    }

    [HttpGet("api/admin/exam-schedule/cycles/{cycleId}/aggregate")]
    public ActionResult<object> ExamScheduleAggregate(string cycleId) => Ok(new { activeCategoryIds = Array.Empty<string>(), days = Array.Empty<object>() });

    [HttpPost("api/admin/exam-schedule/cycles/{cycleId}/generate")]
    [HttpPost("api/admin/exam-schedule/cycles/{cycleId}/days")]
    [HttpPost("api/admin/exam-schedule/cycles/{cycleId}/clear-range")]
    [HttpPost("api/admin/exam-schedule/cycles/{cycleId}/copy-from-category")]
    [HttpPatch("api/admin/exam-schedule/days/{dayId}")]
    [HttpPost("api/admin/exam-schedule/days/{dayId}/toggle-off")]
    public async Task<ActionResult<JsonObject>> MutateExamSchedule([FromBody] JsonObject? body, CancellationToken ct)
    {
        var payload = body ?? new JsonObject { ["ok"] = true };
        ValidateCapacity(payload);
        var id = AdminRecordJson.StringProp(payload, "id") ?? $"exam-day-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        return Ok(await records.UpsertAsync("admissionSetup.examScheduleDays", id, payload, ct));
    }

    [HttpDelete("api/admin/exam-schedule/days/{dayId}")]
    public ActionResult<object> DeleteExamDay() => Ok(new { deleted = true });

    [HttpGet("api/admin/committee-bindings/cycles/{cycleId}")]
    public async Task<ActionResult<JsonArray>> CommitteeBindings(string cycleId, CancellationToken ct)
    {
        var stored = await records.SingletonAsync($"admissionSetup.committeeBindings.{cycleId}", new JsonObject { ["cycleId"] = cycleId, ["bindings"] = new JsonArray() }, ct);
        return Ok(stored["bindings"]?.AsArray() ?? new JsonArray());
    }

    [HttpPost("api/admin/committee-bindings")]
    [HttpPatch("api/admin/committee-bindings/{id}")]
    [HttpPost("api/admin/committee-bindings/{id}/toggle-active")]
    [HttpPost("api/admin/committee-bindings/bulk-eligibility")]
    [HttpPost("api/admin/committee-bindings/copy-row")]
    [HttpPost("api/admin/committee-bindings/copy-column")]
    public async Task<ActionResult<JsonObject>> MutateCommitteeBindings([FromBody] JsonObject? body, CancellationToken ct)
    {
        var payload = body ?? new JsonObject { ["ok"] = true };
        ValidateCommitteeBinding(payload);
        var id = AdminRecordJson.StringProp(payload, "id") ?? $"binding-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        return Ok(await records.UpsertAsync("admissionSetup.committeeBindings", id, payload, ct));
    }

    [HttpDelete("api/admin/committee-bindings/{id}")]
    public ActionResult<object> DeleteCommitteeBinding() => Ok(new { deleted = true });

    private static void ValidateExamDateRanges(JsonObject body)
    {
        var seen = new HashSet<string>();
        foreach (var range in (body["ranges"]?.AsArray() ?? []).OfType<JsonObject>())
        {
            var from = ParseDate(AdminRecordJson.StringProp(range, "from") ?? AdminRecordJson.StringProp(range, "startDate"));
            var to = ParseDate(AdminRecordJson.StringProp(range, "to") ?? AdminRecordJson.StringProp(range, "endDate"));
            if (from is not null && to is not null && to < from)
            {
                throw new ConflictException("EXAM_DATE_RANGE_INVALID", "تاريخ نهاية فترة الاختبار يسبق تاريخ البداية");
            }
            var key = $"{from:yyyy-MM-dd}:{to:yyyy-MM-dd}";
            if (!seen.Add(key))
            {
                throw new ConflictException("EXAM_DATE_RANGE_DUPLICATE", "فترة اختبار مكررة داخل نفس الدورة");
            }
        }
    }

    private static void ValidateCommitteeBindingArray(JsonArray? rows)
    {
        var seen = new HashSet<string>();
        foreach (var row in (rows ?? []).OfType<JsonObject>()) ValidateCommitteeBinding(row, seen);
    }

    private static void ValidateCommitteeBinding(JsonObject row, HashSet<string>? seen = null)
    {
        var category = AdminRecordJson.StringProp(row, "categoryId") ?? AdminRecordJson.StringProp(row, "categoryKey") ?? "";
        var committee = AdminRecordJson.StringProp(row, "committeeId") ?? AdminRecordJson.StringProp(row, "committeeKey") ?? "";
        if (string.IsNullOrWhiteSpace(category) && string.IsNullOrWhiteSpace(committee)) return;
        var key = $"{category}:{committee}";
        if (seen is not null && !seen.Add(key))
        {
            throw new ConflictException("COMMITTEE_BINDING_DUPLICATE", "ربط اللجنة مكرر لنفس الفئة");
        }
        ValidateCapacity(row);
    }

    private static void ValidateCapacity(JsonObject body)
    {
        var capacity = AdminRecordJson.NumberProp(body, "capacity") ?? AdminRecordJson.NumberProp(body, "capacityPerDay");
        var reserved = AdminRecordJson.NumberProp(body, "reserved") ?? AdminRecordJson.NumberProp(body, "reservedCount");
        if (capacity is < 0) throw new ConflictException("CAPACITY_INVALID", "السعة لا يمكن أن تكون سالبة");
        if (capacity is not null && reserved is not null && reserved > capacity)
        {
            throw new ConflictException(ErrorCodes.CommitteeAtCapacity, "الحجوزات الحالية تتجاوز سعة اللجنة");
        }
    }

    private static void ValidatePercentRange(JsonObject body)
    {
        var min = AdminRecordJson.NumberProp(body, "minPercentage") ?? AdminRecordJson.NumberProp(body, "minimumPercentage");
        var max = AdminRecordJson.NumberProp(body, "maxPercentage") ?? AdminRecordJson.NumberProp(body, "maximumPercentage");
        if (min is not null && max is not null && min > max)
        {
            throw new ConflictException("PERCENT_RANGE_INVALID", "الحد الأدنى للنسبة أكبر من الحد الأقصى");
        }
    }

    private static DateTimeOffset? ParseDate(string? value) =>
        DateTimeOffset.TryParse(value, out var parsed) ? parsed : null;

    private static JsonObject CategoryConfig(JsonObject category, int index)
    {
        var key = AdminRecordJson.StringProp(category, "key") ?? $"CAT-{index + 1:00}";
        var label = AdminRecordJson.StringProp(category, "labelAr") ?? key;
        return new JsonObject
        {
            ["id"] = $"CFG-{key}",
            ["categoryId"] = key,
            ["categoryCode"] = key,
            ["categoryNameAr"] = label,
            ["categoryType"] = key == "officers_general" ? "pre_university" : "university",
            ["categoryFacultyCodes"] = new JsonArray(),
            ["categorySpecializationCodes"] = new JsonArray(),
            ["lockedGender"] = null,
            ["singleAxis"] = key != "specialized_officers",
            ["implicitSpecId"] = key != "specialized_officers" ? $"SPEC-{key}-DEFAULT" : null,
            ["specializationCount"] = 0,
            ["yearCount"] = 0,
            ["excellenceCriterion"] = null,
            ["isActive"] = category["isOpen"]?.DeepClone() ?? true,
            ["sortOrder"] = index + 1,
            ["createdAt"] = category["createdAt"]?.DeepClone() ?? DateTimeOffset.UtcNow.ToString("O"),
            ["updatedAt"] = category["updatedAt"]?.DeepClone() ?? DateTimeOffset.UtcNow.ToString("O")
        };
    }
}
