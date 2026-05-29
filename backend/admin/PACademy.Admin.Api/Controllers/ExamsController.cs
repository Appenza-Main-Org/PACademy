using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using PACademy.Admin.Api.Infrastructure;
using PACademy.Admin.Api.Modules.Exams;

namespace PACademy.Admin.Api.Controllers;

/// <summary>
/// Question Bank + Exams REST surface. Mirrors the INTEGRATION CONTRACT
/// in <c>frontend/src/features/exams/api/exams.service.ts</c>.
/// </summary>
[ApiController]
[Route("")]
public sealed class ExamsController(ExamsService service) : ControllerBase
{
    /* ── Questions ─────────────────────────────────────────────────── */

    [HttpGet("api/questions")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> ListQuestions(
        [FromQuery] string? status,
        [FromQuery] string? category,
        CancellationToken ct)
        => Ok(await service.ListQuestionsAsync(status, category, ct));

    [HttpGet("api/questions/{id}")]
    public async Task<ActionResult<JsonObject>> GetQuestion(string id, CancellationToken ct)
    {
        var q = await service.GetQuestionAsync(id, ct);
        return q is null ? NotFound() : Ok(q);
    }

    [HttpPost("api/questions")]
    public async Task<ActionResult<JsonObject>> CreateQuestion([FromBody] JsonObject payload, CancellationToken ct)
        => Ok(await service.CreateQuestionAsync(payload, ct));

    [HttpPatch("api/questions/{id}")]
    public async Task<ActionResult<JsonObject>> UpdateQuestion(string id, [FromBody] JsonObject patch, CancellationToken ct)
        => Ok(await service.UpdateQuestionAsync(id, patch, ct));

    [HttpPost("api/questions/{id}/publish")]
    public async Task<ActionResult<JsonObject>> PublishQuestion(string id, CancellationToken ct)
        => Ok(await service.PublishQuestionAsync(id, ct));

    [HttpPost("api/questions/batch")]
    public async Task<ActionResult<object>> BatchCreateQuestions([FromBody] JsonObject body, CancellationToken ct)
    {
        var rows = body["questions"]?.AsArray() ?? [];
        var typed = rows.OfType<JsonObject>().ToList();
        return Ok(await service.BatchCreateQuestionsAsync(typed, ct));
    }

    [HttpGet("api/exams/categories")]
    public async Task<ActionResult<IReadOnlyList<object>>> CategoryCounts(CancellationToken ct)
        => Ok(await service.GetCategoryCountsAsync(ct));

    /* ── Exams ─────────────────────────────────────────────────────── */

    [HttpGet("api/exams")]
    [RequireBearerAuth]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> ListExams(CancellationToken ct)
        => Ok(await service.ListExamsAsync(ct));

    [HttpGet("api/exams/{id}")]
    public async Task<ActionResult<JsonObject>> GetExam(string id, CancellationToken ct)
    {
        var exam = await service.GetExamAsync(id, ct);
        return exam is null ? NotFound() : Ok(exam);
    }

    [HttpPost("api/exams")]
    [RequireBearerAuth]
    public async Task<ActionResult<JsonObject>> CreateExam([FromBody] JsonObject payload, CancellationToken ct)
        => Ok(await service.CreateExamAsync(payload, ct));

    [HttpPost("api/exams/{id}/publish")]
    public async Task<ActionResult<JsonObject>> PublishExam(string id, CancellationToken ct)
        => Ok(await service.PublishExamAsync(id, ct));

    /* ── Attempts ──────────────────────────────────────────────────── */

    [HttpPost("api/exams/{id}/take/start")]
    public async Task<ActionResult<JsonObject>> StartAttempt(string id, [FromBody] JsonObject body, CancellationToken ct)
    {
        var applicantId = body["applicantId"]?.GetValue<string>() ?? "unknown";
        return Ok(await service.StartAttemptAsync(id, applicantId, ct));
    }

    [HttpPost("api/exams/attempts/{attemptId}/submit")]
    public async Task<ActionResult<JsonObject>> SubmitAttempt(string attemptId, [FromBody] JsonObject body, CancellationToken ct)
    {
        var answers = body["answers"] as JsonObject ?? body;
        return Ok(await service.SubmitAttemptAsync(attemptId, answers, ct));
    }

    [HttpGet("api/exams/{id}/attempts")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> ListAttempts(string id, CancellationToken ct)
        => Ok(await service.ListAttemptsAsync(id, ct));

    [HttpGet("api/exams/{id}/conflict")]
    public async Task<ActionResult<object>> CheckConflict(string id, [FromQuery] string applicantId, CancellationToken ct)
        => Ok(await service.CheckConflictAsync(applicantId, id, ct));

    /* ── Live proctor ──────────────────────────────────────────────── */

    [HttpGet("api/exams/{id}/sessions/live")]
    public async Task<ActionResult<object>> ListLiveSessions(string id, CancellationToken ct)
        => Ok(await service.ListLiveSessionsAsync(id, ct));
}
