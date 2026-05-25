using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Modules.Admissions;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("")]
public sealed class AdmissionSetupController(AdminRecordsService records, ApplicationSettingsService appSettings) : ControllerBase
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

    [HttpGet("api/admin/app-settings/cycle-drafts/{cycleId}")]
    public async Task<ActionResult<JsonObject>> AppSettingsCycleDraft(string cycleId, CancellationToken ct)
    {
        var module = $"admissionSetup.applicationSettings.{cycleId}";
        return Ok(await records.SingletonAsync(module, new JsonObject
        {
            ["id"] = module,
            ["cycleId"] = cycleId,
            ["version"] = 1,
            ["headers"] = new JsonObject(),
            ["local"] = new JsonArray(),
            ["approved"] = new JsonArray()
        }, ct));
    }

    [HttpPut("api/admin/app-settings/cycle-drafts/{cycleId}")]
    public async Task<ActionResult<JsonObject>> SaveAppSettingsCycleDraft(string cycleId, [FromBody] JsonObject body, CancellationToken ct)
    {
        var module = $"admissionSetup.applicationSettings.{cycleId}";
        body["id"] = module;
        body["cycleId"] = cycleId;
        body["version"] = 1;
        body["updatedAt"] = DateTimeOffset.UtcNow.ToString("O");
        body["headers"] ??= new JsonObject();
        body["local"] ??= new JsonArray();
        body["approved"] ??= new JsonArray();
        return Ok(await records.UpsertAsync(module, module, body, ct));
    }

    [HttpGet("api/admin/app-settings/category-configs")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> CategoryConfigs(CancellationToken ct) =>
        Ok(await appSettings.ListCategoryConfigsAsync(ct));

    [HttpGet("api/admin/app-settings/summary")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> AppSettingsSummary(CancellationToken ct) =>
        Ok(await appSettings.SummaryAsync(ct));

    [HttpGet("api/admin/app-settings/category-configs/{configId}/specializations")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> AppSettingsSpecializations(string configId, CancellationToken ct) =>
        Ok(await appSettings.ListSpecializationsForConfigAsync(configId, ct));

    [HttpGet("api/admin/app-settings/category-configs/{configId}/eligible-specializations")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> AppSettingsEligibleSpecializations(string configId, CancellationToken ct) =>
        Ok(await appSettings.EligibleSpecializationsAsync(configId, ct));

    [HttpGet("api/admin/app-settings/specializations/{id}/grading-mode")]
    public async Task<ActionResult<JsonObject>> AppSettingsGradingMode(string id, CancellationToken ct) =>
        Ok(await appSettings.GradingModeAsync(id, ct));

    [HttpGet("api/admin/app-settings/specializations/{id}/parent-category")]
    public async Task<ActionResult<JsonObject?>> AppSettingsParentCategory(string id, CancellationToken ct) =>
        Ok(await appSettings.ParentCategoryAsync(id, ct));

    [HttpGet("api/admin/app-settings/specializations/{id}/years")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> AppSettingsYears(string id, CancellationToken ct) =>
        Ok(await appSettings.ListYearsAsync(id, ct));

    [HttpPost("api/admin/app-settings/category-configs/{configId}/specializations")]
    public async Task<ActionResult<JsonObject>> AttachAppSettingsSpecialization(string configId, [FromBody] JsonObject body, CancellationToken ct) =>
        Ok(await appSettings.AttachSpecializationAsync(configId, body, ct));

    [HttpPost("api/admin/app-settings/category-configs/{categorySpecializationId}/years")]
    public async Task<ActionResult<JsonObject>> CreateAppSettingsYear(string categorySpecializationId, [FromBody] JsonObject body, CancellationToken ct) =>
        Ok(await appSettings.CreateYearAsync(categorySpecializationId, body, ct));

    [HttpPatch("api/admin/app-settings/category-configs/{configId}")]
    public async Task<ActionResult<JsonObject>> ToggleAppSettingsCategory(string configId, CancellationToken ct) =>
        Ok(await appSettings.ToggleCategoryAsync(configId, ct));

    [HttpPatch("api/admin/app-settings/years/{id}")]
    public async Task<ActionResult<JsonObject>> UpdateAppSettingsYear(string id, [FromBody] JsonObject body, CancellationToken ct) =>
        Ok(await appSettings.UpdateYearAsync(id, body, ct));

    [HttpPost("api/admin/app-settings/years/{id}/toggle-active")]
    public async Task<ActionResult<JsonObject>> ToggleAppSettingsYear(string id, CancellationToken ct) =>
        Ok(await appSettings.ToggleYearAsync(id, ct));

    [HttpPost("api/admin/app-settings/bulk-save")]
    public async Task<ActionResult<JsonObject>> BulkSaveAppSettings([FromBody] JsonArray body, CancellationToken ct) =>
        Ok(await appSettings.BulkSaveAsync(body, ct));

    [HttpDelete("api/admin/app-settings/specializations/{id}")]
    public async Task<ActionResult<object>> DeleteAppSettingsSpecialization(string id, CancellationToken ct)
    {
        await appSettings.DeleteSpecializationAsync(id, ct);
        return Ok(new { deleted = true });
    }

    [HttpDelete("api/admin/app-settings/years/{id}")]
    public async Task<ActionResult<object>> DeleteAppSettingsYear(string id, CancellationToken ct)
    {
        await appSettings.DeleteYearAsync(id, ct);
        return Ok(new { deleted = true });
    }

    [HttpGet("api/admin/exam-schedule/cycles/{cycleId}")]
    public async Task<ActionResult<JsonArray>> ExamSchedule(string cycleId, CancellationToken ct)
    {
        var stored = await records.SingletonAsync($"admissionSetup.examSchedule.{cycleId}", new JsonObject { ["cycleId"] = cycleId, ["days"] = new JsonArray() }, ct);
        var days = new JsonArray((stored["days"]?.AsArray() ?? []).Select(x => x!.DeepClone()).ToArray());
        foreach (var day in await ExamScheduleDayRecordsAsync(cycleId, ct))
        {
            days.Add(day);
        }
        return Ok(days);
    }

    [HttpGet("api/admin/exam-schedule/cycles/{cycleId}/aggregate")]
    public async Task<ActionResult<object>> ExamScheduleAggregate(string cycleId, CancellationToken ct)
    {
        var committeeDays = await records.ListAsync("committeeInstances", ct);
        var scheduleDays = await ExamScheduleDayRecordsAsync(cycleId, ct);
        var rows = committeeDays
            .Concat(scheduleDays)
            .Where(x => AdminRecordJson.StringProp(x, "cycleId") == cycleId)
            .ToList();
        var activeCategoryIds = rows
            .Select(x => AdminRecordJson.StringProp(x, "categoryKey") ?? AdminRecordJson.StringProp(x, "categoryId"))
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.Ordinal)
            .ToList();
        var days = rows
            .GroupBy(x => AdminRecordJson.StringProp(x, "date") ?? AdminRecordJson.StringProp(x, "day") ?? AdminRecordJson.StringProp(x, "examDate") ?? "")
            .Where(x => !string.IsNullOrWhiteSpace(x.Key))
            .OrderBy(x => x.Key)
            .Select(group => new
            {
                date = group.Key,
                capacity = group.Sum(x => AdminRecordJson.NumberProp(x, "capacity") ?? AdminRecordJson.NumberProp(x, "capacityPerDay") ?? 0),
                reserved = group.Sum(x => AdminRecordJson.NumberProp(x, "reserved") ?? AdminRecordJson.NumberProp(x, "reservedCount") ?? 0),
                categoryIds = group
                    .Select(x => AdminRecordJson.StringProp(x, "categoryKey") ?? AdminRecordJson.StringProp(x, "categoryId"))
                    .Where(x => !string.IsNullOrWhiteSpace(x))
                    .Distinct(StringComparer.Ordinal)
                    .ToList(),
                rows = group.Count()
            })
            .ToList();
        return Ok(new { activeCategoryIds, days });
    }

    [HttpPost("api/admin/exam-schedule/cycles/{cycleId}/generate")]
    [HttpPost("api/admin/exam-schedule/cycles/{cycleId}/days")]
    [HttpPost("api/admin/exam-schedule/cycles/{cycleId}/clear-range")]
    [HttpPost("api/admin/exam-schedule/cycles/{cycleId}/copy-from-category")]
    [HttpPatch("api/admin/exam-schedule/days/{dayId}")]
    [HttpPost("api/admin/exam-schedule/days/{dayId}/toggle-off")]
    public async Task<ActionResult<JsonObject>> MutateExamSchedule(string? cycleId, string? dayId, [FromBody] JsonObject? body, CancellationToken ct)
    {
        var payload = body ?? new JsonObject { ["ok"] = true };
        ValidateCapacity(payload);
        if (!string.IsNullOrWhiteSpace(cycleId)) payload["cycleId"] = cycleId;
        if (!string.IsNullOrWhiteSpace(dayId)) payload["id"] = dayId;
        var id = AdminRecordJson.StringProp(payload, "id") ?? $"exam-day-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        return Ok(await records.UpsertAsync("admissionSetup.examScheduleDays", id, payload, ct));
    }

    [HttpDelete("api/admin/exam-schedule/days/{dayId}")]
    public async Task<ActionResult<object>> DeleteExamDay(string dayId, CancellationToken ct) =>
        Ok(new { deleted = await records.DeleteAsync("admissionSetup.examScheduleDays", dayId, ct), id = dayId });

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
    public async Task<ActionResult<object>> DeleteCommitteeBinding(string id, CancellationToken ct)
    {
        var deletedRecord = await records.DeleteAsync("admissionSetup.committeeBindings", id, ct);
        var deletedFromCycleSets = await records.DeleteFromArrayModulesAsync("admissionSetup.committeeBindings.", "bindings", id, ct);
        return Ok(new { deleted = deletedRecord || deletedFromCycleSets > 0, id, deletedFromCycleSets });
    }

    private async Task<IReadOnlyList<JsonObject>> ExamScheduleDayRecordsAsync(string cycleId, CancellationToken ct)
    {
        var dayRecords = await records.ListAsync("admissionSetup.examScheduleDays", ct);
        return dayRecords
            .Where(x => AdminRecordJson.StringProp(x, "cycleId") == cycleId)
            .ToList();
    }

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

}
