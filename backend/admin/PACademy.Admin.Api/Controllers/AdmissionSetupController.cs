using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("")]
public sealed class AdmissionSetupController : ControllerBase
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
    [HttpGet("api/admin/app-settings/summary")]
    public ActionResult<object> AppSettings() => Ok(Array.Empty<object>());

    [HttpGet("api/admin/app-settings/category-configs/{configId}/specializations")]
    [HttpGet("api/admin/app-settings/category-configs/{configId}/years")]
    [HttpGet("api/admin/app-settings/specializations/{id}")]
    [HttpGet("api/admin/app-settings/years/{id}")]
    public ActionResult<object> AppSettingsDetail() => Ok(Array.Empty<object>());

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
    [HttpGet("api/admin/exam-schedule/cycles/{cycleId}/aggregate")]
    public ActionResult<IReadOnlyList<object>> ExamSchedule(string cycleId) => Ok(Array.Empty<object>());

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
}
