using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("")]
public sealed class ExamPlansController : ControllerBase
{
    [HttpGet("api/exams/academy")]
    public ActionResult<IReadOnlyList<object>> AcademyExams() => Ok(Array.Empty<object>());

    [HttpGet("api/cycles/{cycleId}/exam-plans")]
    public ActionResult<IReadOnlyList<object>> Plans(string cycleId) => Ok(Array.Empty<object>());

    [HttpGet("api/cycles/{cycleId}/categories/{categoryId}/exam-plan")]
    public ActionResult<object> Plan(string cycleId, string categoryId) => Ok(new { id = $"EP-{cycleId}-{categoryId}", cycleId, categoryId, exams = Array.Empty<object>() });

    [HttpPut("api/cycles/{cycleId}/categories/{categoryId}/exam-plan")]
    public ActionResult<object> SavePlan(string cycleId, string categoryId, [FromBody] JsonObject body) =>
        Ok(new { id = $"EP-{cycleId}-{categoryId}", cycleId, categoryId, exams = body["exams"]?.DeepClone() ?? new JsonArray(), updatedAt = DateTimeOffset.UtcNow });

    [HttpPost("api/cycles/{cycleId}/exam-plans/copy")]
    public ActionResult<IReadOnlyList<object>> CopyPlans(string cycleId) => Ok(Array.Empty<object>());

    [HttpGet("api/exams/results/can-enter")]
    public ActionResult<object> CanEnter() => Ok(new { canEnter = true });

    [HttpPost("api/exams/results/{resultId}/transition")]
    public ActionResult<object> TransitionResult(string resultId, [FromBody] JsonObject body) => Ok(new { id = resultId, status = body["status"]?.GetValue<string>() ?? "draft" });

    [HttpPost("api/cycles/{cycleId}/exams/{examId}/results")]
    [HttpPost("api/cycles/{cycleId}/exams/{examId}/device-callback")]
    public ActionResult<object> ResultEntry() => Ok(new { ok = true });

    [HttpPost("api/cycles/{cycleId}/exams/{examId}/results/bulk-upload")]
    public ActionResult<object> BulkUpload() => Ok(new { imported = 0, errors = Array.Empty<object>() });
}
