using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using PACademy.Admin.Api.Modules.AdminRecords;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("")]
public sealed class AdmissionSetupController(AdminRecordsService records) : ControllerBase
{
    [HttpGet("api/admission-setup/cycles/{cycleId}/exam-dates")]
    public ActionResult<object> ExamDates(string cycleId) => Ok(new { cycleId, ranges = Array.Empty<object>() });

    [HttpPut("api/admission-setup/cycles/{cycleId}/exam-dates")]
    public ActionResult<object> SaveExamDates(string cycleId, [FromBody] JsonObject body) => Ok(body);

    [HttpGet("api/admission-setup/cycles/{cycleId}/declaration")]
    public ActionResult<object> Declaration(string cycleId) => Ok(new { id = $"DECL-{cycleId}", cycleId, bodyAr = "", published = false });

    [HttpPut("api/admission-setup/cycles/{cycleId}/declaration")]
    public ActionResult<object> SaveDeclaration(string cycleId, [FromBody] JsonObject body) => Ok(body);

    [HttpPost("api/admission-setup/declarations/{declarationId}/publish")]
    public ActionResult<object> PublishDeclaration(string declarationId) => Ok(new { id = declarationId, published = true });

    [HttpGet("api/admission-setup/cycles/{cycleId}/committee-bindings")]
    public ActionResult<IReadOnlyList<object>> AdmissionCommitteeBindings(string cycleId) => Ok(Array.Empty<object>());

    [HttpPut("api/admission-setup/cycles/{cycleId}/committee-bindings")]
    public ActionResult<object> SaveAdmissionCommitteeBindings(string cycleId, [FromBody] JsonNode body) => Ok(body);

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
    public ActionResult<object> MutateAppSettings([FromBody] JsonNode? body) => Ok(body ?? new JsonObject { ["ok"] = true });

    [HttpDelete("api/admin/app-settings/specializations/{id}")]
    [HttpDelete("api/admin/app-settings/years/{id}")]
    public ActionResult<object> DeleteAppSettings() => Ok(new { deleted = true });

    [HttpGet("api/admin/exam-schedule/cycles/{cycleId}")]
    public ActionResult<IReadOnlyList<object>> ExamSchedule(string cycleId) => Ok(Array.Empty<object>());

    [HttpGet("api/admin/exam-schedule/cycles/{cycleId}/aggregate")]
    public ActionResult<object> ExamScheduleAggregate(string cycleId) => Ok(new { activeCategoryIds = Array.Empty<string>(), days = Array.Empty<object>() });

    [HttpPost("api/admin/exam-schedule/cycles/{cycleId}/generate")]
    [HttpPost("api/admin/exam-schedule/cycles/{cycleId}/days")]
    [HttpPost("api/admin/exam-schedule/cycles/{cycleId}/clear-range")]
    [HttpPost("api/admin/exam-schedule/cycles/{cycleId}/copy-from-category")]
    [HttpPatch("api/admin/exam-schedule/days/{dayId}")]
    [HttpPost("api/admin/exam-schedule/days/{dayId}/toggle-off")]
    public ActionResult<object> MutateExamSchedule([FromBody] JsonNode? body) => Ok(body ?? new JsonObject { ["ok"] = true });

    [HttpDelete("api/admin/exam-schedule/days/{dayId}")]
    public ActionResult<object> DeleteExamDay() => Ok(new { deleted = true });

    [HttpGet("api/admin/committee-bindings/cycles/{cycleId}")]
    public ActionResult<IReadOnlyList<object>> CommitteeBindings(string cycleId) => Ok(Array.Empty<object>());

    [HttpPost("api/admin/committee-bindings")]
    [HttpPatch("api/admin/committee-bindings/{id}")]
    [HttpPost("api/admin/committee-bindings/{id}/toggle-active")]
    [HttpPost("api/admin/committee-bindings/bulk-eligibility")]
    [HttpPost("api/admin/committee-bindings/copy-row")]
    [HttpPost("api/admin/committee-bindings/copy-column")]
    public ActionResult<object> MutateCommitteeBindings([FromBody] JsonNode? body) => Ok(body ?? new JsonObject { ["ok"] = true });

    [HttpDelete("api/admin/committee-bindings/{id}")]
    public ActionResult<object> DeleteCommitteeBinding() => Ok(new { deleted = true });

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
