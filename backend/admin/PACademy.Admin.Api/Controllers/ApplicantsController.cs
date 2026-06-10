using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Modules.Admissions;
using PACademy.Admin.Api.Modules.Admissions.Eligibility;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("")]
public sealed class ApplicantsController(
    OperationalRecordsService records,
    ApplicantEligibilityService eligibility,
    CyclesService cycles) : ControllerBase
{
    private static readonly ApplicantStatusOption[] StatusOptions =
    [
        new("draft", "مسودة", "neutral"),
        new("personal_data_completed", "استكمال البيانات الشخصية", "info"),
        new("awaiting_payment", "في انتظار السداد", "warning"),
        new("fees_paid", "تم سداد الرسوم", "success"),
        new("family_data_in_progress", "بيانات العائلة قيد الإدخال", "info"),
        new("family_data_approved", "اعتماد بيانات العائلة", "success"),
        new("awaiting_exam_booking", "في انتظار حجز موعد الاختبار", "warning"),
        new("exam_scheduled", "تم حجز موعد الاختبار", "info"),
        new("attendance_card_available", "بطاقة التردد متاحة", "success"),
        new("awaiting_exam_result", "في انتظار نتيجة الاختبار", "warning"),
        new("suspended", "موقوف", "danger"),
        new("acquaintance_doc_opened", "وثيقة التعارف", "success"),
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

    [HttpGet("api/applicants/{nationalId}/eligible-categories")]
    public async Task<ActionResult<ApplicantEligibilityResponse>> EligibleCategories(
        string nationalId,
        [FromQuery] bool includeIneligible = false,
        CancellationToken ct = default)
    {
        try
        {
            return Ok(await eligibility.GetEligibleCategoriesAsync(nationalId, ct, includeIneligible));
        }
        catch (NationalIdFormatException ex)
        {
            return BadRequest(new ApiErrorEnvelope(
                ErrorCodes.ValidationFailed,
                Errors: new Dictionary<string, string[]> { ["nationalId"] = [ex.Message] },
                Message: "الرقم القومي غير صحيح"));
        }
        catch (EntityNotFoundException ex) when (ex.Message == "لا توجد دورة قبول نشطة")
        {
            return Conflict(new ApiErrorEnvelope(
                ErrorCodes.Conflict,
                ConflictCode: ErrorCodes.NoActiveCycle,
                Message: "لا توجد دورة قبول نشطة حالياً",
                Payload: new { reasons = new[] { "cycle_not_active" } }));
        }
    }

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
        /* Every applicant must belong to a cycle so cycle-scoped views (filter,
         * export, payments) can reach it; the admin form leaves the field optional. */
        if (string.IsNullOrWhiteSpace(AdminRecordJson.StringProp(body, "cycleId")))
        {
            var activeCycle = await cycles.GetActiveAsync(ct);
            var activeCycleId = activeCycle is null ? null : AdminRecordJson.StringProp(activeCycle, "id");
            if (!string.IsNullOrWhiteSpace(activeCycleId)) body["cycleId"] = activeCycleId;
        }
        var validation = ValidateApplicant(body);
        if (validation.Count > 0) return ValidationProblem(validation);
        return Ok(await records.UpsertAsync("applicants", id, body, ct));
    }

    [HttpPut("api/v1/applicants/{id}")]
    public async Task<ActionResult<JsonObject>> Update(string id, [FromBody] JsonObject body, CancellationToken ct)
    {
        var current = await records.GetAsync("applicants", id, ct) ?? [];
        foreach (var item in body) current[item.Key] = item.Value?.DeepClone();
        current["id"] ??= id;
        var validation = ValidateApplicant(current);
        if (validation.Count > 0) return ValidationProblem(validation);
        return Ok(await records.UpsertAsync("applicants", id, current, ct));
    }

    [HttpGet("api/applicants/{id}/follow-up")]
    [HttpGet("api/v1/applicants/{id}/follow-up")]
    public async Task<ActionResult<JsonObject>> GetFollowUp(string id, CancellationToken ct)
    {
        var result = await records.GetApplicantFollowUpAsync(id, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPut("api/applicants/{id}/follow-up")]
    [HttpPut("api/v1/applicants/{id}/follow-up")]
    public async Task<ActionResult<JsonObject>> UpdateFollowUp(string id, [FromBody] JsonObject body, CancellationToken ct)
    {
        var result = await records.UpdateApplicantFollowUpAsync(id, body, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost("api/v1/applicants/{id}/transition")]
    public async Task<ActionResult<JsonObject>> Transition(string id, [FromBody] JsonObject body, CancellationToken ct)
    {
        var patch = new JsonObject { ["status"] = body["toStatus"]?.DeepClone() ?? "pending" };
        return Ok(await records.UpsertAsync("applicants", id, patch, ct));
    }

    [HttpPost("api/v1/applicants/{id}/reset")]
    public async Task<ActionResult<JsonObject>> Reset(string id, CancellationToken ct)
    {
        var row = await records.ResetApplicantAsync(id, ct);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpDelete("api/v1/applicants/{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken ct)
    {
        return await records.DeleteApplicantAsync(id, ct) ? NoContent() : NotFound();
    }

    [HttpPost("api/v1/applicants/{id}/suspension")]
    public async Task<ActionResult<JsonObject>> Suspension(string id, [FromBody] ApplicantSuspensionRequest body, CancellationToken ct)
    {
        var row = await records.SetApplicantSuspensionAsync(id, body.Suspended, body.Reason, ct);
        return row is null ? NotFound() : Ok(row);
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

    private ActionResult ValidationProblem(IReadOnlyDictionary<string, string[]> errors) =>
        UnprocessableEntity(new ApiErrorEnvelope(
            ErrorCodes.ValidationFailed,
            Errors: errors,
            Message: "أكمل البيانات المطلوبة قبل حفظ المتقدم"));

    private static Dictionary<string, string[]> ValidateApplicant(JsonObject body)
    {
        var errors = new Dictionary<string, string[]>();
        RequireNationalId(body, "nationalId", errors);
        RequireText(body, "religion", errors);
        RequireText(body, "maritalStatus", errors);
        RequireText(body, "department", errors);

        var fullName = ObjectProp(body, "fullName");
        RequireText(fullName, "first", errors, "fullName.first", minLength: 2);
        RequireText(fullName, "second", errors, "fullName.second", minLength: 2);
        RequireText(fullName, "third", errors, "fullName.third", minLength: 2);
        RequireText(fullName, "fourth", errors, "fullName.fourth", minLength: 2);

        var address = ObjectProp(body, "currentAddress");
        RequireText(address, "governorate", errors, "currentAddress.governorate");
        RequireText(address, "city", errors, "currentAddress.city");
        RequireText(address, "detail", errors, "currentAddress.detail", minLength: 2);

        var contact = ObjectProp(body, "contact");
        RequireMobile(contact, "mobilePhone", errors, "contact.mobilePhone");

        var education = ObjectProp(body, "education");
        var kind = StringProp(education, "kind");
        RequireText(education, "kind", errors, "education.kind");
        if (kind == "higher")
        {
            RequireText(education, "specialization", errors, "education.specialization", minLength: 2);
            RequireText(education, "university", errors, "education.university", minLength: 2);
            RequireText(education, "faculty", errors, "education.faculty", minLength: 2);
            RequirePositiveNumber(education, "totalScore", errors, "education.totalScore");
            RequirePositiveNumber(education, "graduationYear", errors, "education.graduationYear");
            var secondary = ObjectProp(education, "secondary");
            RequireText(secondary, "certificateName", errors, "education.secondary.certificateName", minLength: 2);
            RequirePositiveNumber(secondary, "totalScore", errors, "education.secondary.totalScore");
        }
        else
        {
            RequireText(education, "certificateName", errors, "education.certificateName", minLength: 2);
            RequireText(education, "schoolName", errors, "education.schoolName", minLength: 2);
            RequirePositiveNumber(education, "totalScore", errors, "education.totalScore");
            RequirePositiveNumber(education, "graduationYear", errors, "education.graduationYear");
            if (kind == "overseas")
            {
                RequireText(education, "country", errors, "education.country", minLength: 2);
            }
        }

        return errors;
    }

    private static JsonObject? ObjectProp(JsonObject? obj, string key) =>
        obj is not null && obj.TryGetPropertyValue(key, out var node) && node is JsonObject child ? child : null;

    private static string? StringProp(JsonObject? obj, string key)
    {
        if (obj is null || !obj.TryGetPropertyValue(key, out var node) || node is null) return null;
        try
        {
            return node.GetValue<string>()?.Trim();
        }
        catch (InvalidOperationException)
        {
            return node.ToString().Trim();
        }
    }

    private static double? NumberProp(JsonObject? obj, string key)
    {
        if (obj is null || !obj.TryGetPropertyValue(key, out var node) || node is null) return null;
        try
        {
            return node.GetValue<double>();
        }
        catch (InvalidOperationException)
        {
            return double.TryParse(node.ToString(), out var parsed) ? parsed : null;
        }
    }

    private static void RequireText(
        JsonObject? obj,
        string key,
        IDictionary<string, string[]> errors,
        string? field = null,
        int minLength = 1)
    {
        var value = StringProp(obj, key);
        if (string.IsNullOrWhiteSpace(value) || value.Length < minLength)
        {
            errors[field ?? key] = ["مطلوب"];
        }
    }

    private static void RequireNationalId(JsonObject obj, string key, IDictionary<string, string[]> errors)
    {
        var value = StringProp(obj, key);
        if (value is not { Length: 14 } || !value.All(char.IsDigit))
        {
            errors[key] = ["الرقم القومي يجب أن يكون 14 رقماً"];
        }
    }

    private static void RequireMobile(JsonObject? obj, string key, IDictionary<string, string[]> errors, string field)
    {
        var value = StringProp(obj, key);
        if (value is null ||
            value.Length != 11 ||
            !value.StartsWith("01", StringComparison.Ordinal) ||
            !value.All(char.IsDigit))
        {
            errors[field] = ["رقم محمول مصري غير صحيح"];
        }
    }

    private static void RequirePositiveNumber(JsonObject? obj, string key, IDictionary<string, string[]> errors, string field)
    {
        var value = NumberProp(obj, key);
        if (value is null or <= 0)
        {
            errors[field] = ["مطلوب"];
        }
    }
}

public sealed record ApplicantStatusOption(string Value, string Label, string Color);

public sealed record ApplicantSuspensionRequest(bool Suspended, string? Reason);
