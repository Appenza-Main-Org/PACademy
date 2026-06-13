using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Modules.Admissions;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("")]
public sealed class AdmissionSetupController(
    OperationalRecordsService records,
    ApplicationSettingsService appSettings,
    CategoryEducationFieldsService educationFields) : ControllerBase
{
    private const int MaxDeclarationPdfBytes = 10 * 1024 * 1024;

    /* ── Category education fields (config-driven profile score fields) ── */

    [HttpGet("api/admission-setup/education-fields")]
    public async Task<ActionResult<IReadOnlyList<CategoryEducationFieldsService.CategoryEducationFieldDto>>> EducationFields(
        [FromQuery] string? categoryKey,
        CancellationToken ct) =>
        Ok(await educationFields.ListAsync(categoryKey, ct));

    [HttpPut("api/admission-setup/education-fields/{categoryKey}")]
    public async Task<ActionResult<IReadOnlyList<CategoryEducationFieldsService.CategoryEducationFieldDto>>> SaveEducationFields(
        string categoryKey,
        [FromBody] IReadOnlyList<CategoryEducationFieldsService.CategoryEducationFieldDto> rows,
        CancellationToken ct) =>
        Ok(await educationFields.SaveCategoryAsync(categoryKey, rows, ct));

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
    public async Task<ActionResult<JsonObject>> Declaration(string cycleId, CancellationToken ct)
    {
        var id = DeclarationId(cycleId);
        var current = await records.GetAsync(DeclarationModule(cycleId), id, ct);
        return Ok(NormalizeDeclaration(cycleId, current));
    }

    [HttpGet("api/admission-setup/declaration/published")]
    public async Task<ActionResult<JsonObject?>> PublishedDeclaration(
        [FromQuery] string? cycleId,
        [FromQuery] string? categoryKey,
        CancellationToken ct)
    {
        var resolvedCycleId = string.IsNullOrWhiteSpace(cycleId)
            ? await ResolvePublishedDeclarationCycleIdAsync(ct)
            : cycleId.Trim();
        if (string.IsNullOrWhiteSpace(resolvedCycleId)) return Ok(null);

        var current = NormalizeDeclaration(
            resolvedCycleId,
            await records.GetAsync(DeclarationModule(resolvedCycleId), DeclarationId(resolvedCycleId), ct));
        var isPublished =
            !string.IsNullOrWhiteSpace(AdminRecordJson.StringProp(current, "publishedAt")) ||
            BoolProp(current, "published") == true;
        if (!isPublished || !HasDeclarationContentForSelectedMode(current)) return Ok(null);

        return Ok(ProjectPublishedDeclaration(current, categoryKey));
    }

    [HttpPut("api/admission-setup/cycles/{cycleId}/declaration")]
    [Consumes("application/json")]
    public async Task<ActionResult<JsonObject>> SaveDeclaration(string cycleId, [FromBody] JsonObject body, CancellationToken ct)
    {
        var id = DeclarationId(cycleId);
        var current = await records.GetAsync(DeclarationModule(cycleId), id, ct);
        var payload = PrepareDeclarationForSave(cycleId, body, current);
        return Ok(await records.UpsertAsync(DeclarationModule(cycleId), id, payload, ct));
    }

    [HttpPut("api/admission-setup/cycles/{cycleId}/declaration")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<JsonObject>> SaveDeclarationPdf(
        string cycleId,
        [FromForm] string mode,
        [FromForm] string? bodyAr,
        [FromForm] string effectiveFrom,
        [FromForm] IFormFile document,
        CancellationToken ct)
    {
        var id = DeclarationId(cycleId);
        var current = await records.GetAsync(DeclarationModule(cycleId), id, ct);
        var documentNode = await BuildDeclarationDocumentAsync(document, ct);
        var payload = PrepareDeclarationForSave(cycleId, new JsonObject
        {
            ["mode"] = mode,
            ["bodyAr"] = bodyAr ?? "",
            ["document"] = documentNode,
            ["effectiveFrom"] = effectiveFrom
        }, current);
        return Ok(await records.UpsertAsync(DeclarationModule(cycleId), id, payload, ct));
    }

    [HttpPost("api/admission-setup/declarations/{declarationId}/publish")]
    public async Task<ActionResult<JsonObject>> PublishDeclaration(string declarationId, CancellationToken ct)
    {
        var cycleId = declarationId.Replace("DECL-", "", StringComparison.OrdinalIgnoreCase);
        var declaration = NormalizeDeclaration(
            cycleId,
            await records.GetAsync(DeclarationModule(cycleId), declarationId, ct));
        if (!HasDeclarationContent(declaration))
        {
            throw new ConflictException("DECLARATION_EMPTY", "لا يمكن نشر إقرار إلكتروني فارغ");
        }
        declaration["published"] = true;
        declaration["publishedAt"] = DateTimeOffset.UtcNow.ToString("O");
        return Ok(await records.UpsertAsync(DeclarationModule(cycleId), declarationId, declaration, ct));
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

    private static string DeclarationModule(string cycleId) => $"admissionSetup.declaration.{cycleId}";

    private static string DeclarationId(string cycleId) => $"DECL-{cycleId}";

    private async Task<string?> ResolvePublishedDeclarationCycleIdAsync(CancellationToken ct)
    {
        var cycles = await records.ListAsync("cycles", ct);
        var cycle = cycles.FirstOrDefault(IsActiveCycle) ?? cycles.FirstOrDefault();
        return cycle is null ? null : AdminRecordJson.StringProp(cycle, "id");
    }

    private static JsonObject NormalizeDeclaration(string cycleId, JsonObject? current)
    {
        var now = DateTimeOffset.UtcNow.ToString("O");
        var normalized = current is null ? [] : AdminRecordJson.Clone(current);
        normalized["id"] = DeclarationId(cycleId);
        normalized["cycleId"] = cycleId;
        normalized["mode"] = ValidDeclarationMode(AdminRecordJson.StringProp(normalized, "mode"));
        normalized["bodyAr"] = AdminRecordJson.StringProp(normalized, "bodyAr") ?? "";
        normalized["version"] = Math.Max(1, (int)(AdminRecordJson.NumberProp(normalized, "version") ?? 1));
        normalized["effectiveFrom"] = AdminRecordJson.StringProp(normalized, "effectiveFrom") ?? now;
        normalized["createdAt"] = AdminRecordJson.StringProp(normalized, "createdAt")
            ?? AdminRecordJson.StringProp(normalized, "updatedAt")
            ?? now;
        normalized["createdBy"] = AdminRecordJson.StringProp(normalized, "createdBy") ?? "system";

        if (!normalized.TryGetPropertyValue("document", out _))
        {
            normalized["document"] = null;
        }

        return normalized;
    }

    private static JsonObject PrepareDeclarationForSave(string cycleId, JsonObject incoming, JsonObject? current)
    {
        var existing = NormalizeDeclaration(cycleId, current);
        var now = DateTimeOffset.UtcNow.ToString("O");
        var next = AdminRecordJson.Clone(incoming);
        var mode = ValidDeclarationMode(AdminRecordJson.StringProp(next, "mode"));
        next["id"] = DeclarationId(cycleId);
        next["cycleId"] = cycleId;
        next["mode"] = mode;
        next["bodyAr"] = AdminRecordJson.StringProp(next, "bodyAr") ?? "";
        next["version"] = current is null
            ? 1
            : Math.Max(1, (int)(AdminRecordJson.NumberProp(existing, "version") ?? 0) + 1);
        next["effectiveFrom"] = AdminRecordJson.StringProp(next, "effectiveFrom")
            ?? AdminRecordJson.StringProp(existing, "effectiveFrom")
            ?? now;
        next["createdAt"] = AdminRecordJson.StringProp(existing, "createdAt") ?? now;
        next["createdBy"] = AdminRecordJson.StringProp(existing, "createdBy") ?? "system";
        next["updatedAt"] = now;

        var hasDocumentKey = next.TryGetPropertyValue("document", out var document);
        if (!hasDocumentKey)
        {
            next["document"] = mode == "pdf"
                ? existing["document"]?.DeepClone()
                : null;
        }
        else if (document is null)
        {
            next["document"] = null;
        }

        if (AdminRecordJson.StringProp(existing, "publishedAt") is { } publishedAt)
        {
            next["publishedAt"] = publishedAt;
        }
        if (existing.TryGetPropertyValue("published", out var published) && published is not null)
        {
            next["published"] = published.DeepClone();
        }

        return next;
    }

    private static async Task<JsonObject> BuildDeclarationDocumentAsync(IFormFile document, CancellationToken ct)
    {
        if (document.Length <= 0)
        {
            throw new ConflictException("DECLARATION_PDF_EMPTY", "ملف الإقرار فارغ");
        }
        if (document.Length > MaxDeclarationPdfBytes)
        {
            throw new ConflictException("DECLARATION_PDF_TOO_LARGE", "حجم ملف الإقرار يتجاوز 10 ميجابايت");
        }
        var extension = Path.GetExtension(document.FileName);
        var isPdf =
            string.Equals(document.ContentType, "application/pdf", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(extension, ".pdf", StringComparison.OrdinalIgnoreCase);
        if (!isPdf)
        {
            throw new ConflictException("DECLARATION_PDF_INVALID_TYPE", "يجب أن يكون ملف الإقرار بصيغة PDF");
        }

        await using var ms = new MemoryStream();
        await document.CopyToAsync(ms, ct);
        return new JsonObject
        {
            ["fileName"] = Path.GetFileName(document.FileName),
            ["fileUrl"] = $"data:application/pdf;base64,{Convert.ToBase64String(ms.ToArray())}",
            ["size"] = document.Length
        };
    }

    private static string ValidDeclarationMode(string? mode) =>
        string.Equals(mode, "pdf", StringComparison.OrdinalIgnoreCase) ? "pdf" : "text";

    private static bool HasDeclarationContent(JsonObject declaration)
    {
        if (!string.IsNullOrWhiteSpace(AdminRecordJson.StringProp(declaration, "bodyAr")))
        {
            return true;
        }
        if (!declaration.TryGetPropertyValue("document", out var document) || document is not JsonObject doc)
        {
            return false;
        }
        return !string.IsNullOrWhiteSpace(AdminRecordJson.StringProp(doc, "fileName")) &&
            !string.IsNullOrWhiteSpace(AdminRecordJson.StringProp(doc, "fileUrl"));
    }

    private static JsonObject ProjectPublishedDeclaration(JsonObject declaration, string? categoryKey)
    {
        var projected = AdminRecordJson.Clone(declaration);
        var mode = ValidDeclarationMode(AdminRecordJson.StringProp(projected, "mode"));
        projected["mode"] = mode;
        if (!string.IsNullOrWhiteSpace(categoryKey))
        {
            projected["categoryKey"] = categoryKey.Trim();
        }
        if (mode == "text")
        {
            projected["document"] = null;
        }
        else
        {
            projected["bodyAr"] = "";
        }
        return projected;
    }

    private static bool HasDeclarationContentForSelectedMode(JsonObject declaration)
    {
        var mode = ValidDeclarationMode(AdminRecordJson.StringProp(declaration, "mode"));
        if (mode == "text") return !string.IsNullOrWhiteSpace(AdminRecordJson.StringProp(declaration, "bodyAr"));
        if (!declaration.TryGetPropertyValue("document", out var document) || document is not JsonObject doc)
        {
            return false;
        }
        return !string.IsNullOrWhiteSpace(AdminRecordJson.StringProp(doc, "fileName")) &&
            !string.IsNullOrWhiteSpace(AdminRecordJson.StringProp(doc, "fileUrl"));
    }

    private static bool? BoolProp(JsonObject obj, string key)
    {
        if (!obj.TryGetPropertyValue(key, out var node) || node is null) return null;
        return bool.TryParse(node.ToString().Trim().Trim('"'), out var parsed) ? parsed : null;
    }

    private static bool IsActiveCycle(JsonObject cycle) =>
        BoolProp(cycle, "isActive") == true ||
        AdminRecordJson.StringProp(cycle, "status") is "active" or "open";

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
