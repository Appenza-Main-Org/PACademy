using System.Text.Json.Nodes;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Modules.Exams;

/// <summary>
/// Question Bank + Exams service. Wraps <see cref="AdminRecordsService"/> for
/// JSON storage; grades attempts in-process (mcq / true-false rely on
/// <c>correctIndex</c>, matching compares <c>matchingPairs</c> against the
/// applicant's <c>{ prompt: match }</c> dict).
/// </summary>
public sealed class ExamsService(AdminRecordsService records)
{
    public const string QuestionsModule = "questions";
    public const string ExamsModule = "exams";
    public const string AttemptsModule = "exam-attempts";
    public const string LiveSessionsModule = "exam-live-sessions";

    /* ── Questions ─────────────────────────────────────────────────── */

    public async Task<IReadOnlyList<JsonObject>> ListQuestionsAsync(string? status, string? category, CancellationToken ct)
    {
        var rows = await records.ListAsync(QuestionsModule, ct);
        if (!string.IsNullOrWhiteSpace(status) && status != "all")
        {
            rows = rows.Where(x => AdminRecordJson.StringProp(x, "status") == status).ToList();
        }
        if (!string.IsNullOrWhiteSpace(category) && category != "all")
        {
            rows = rows.Where(x => AdminRecordJson.StringProp(x, "category") == category).ToList();
        }
        return rows;
    }

    public Task<JsonObject?> GetQuestionAsync(string id, CancellationToken ct) =>
        records.GetAsync(QuestionsModule, id, ct);

    public async Task<JsonObject> CreateQuestionAsync(JsonObject payload, CancellationToken ct)
    {
        var id = AdminRecordJson.StringProp(payload, "id") ?? NextQuestionId();
        payload["id"] = id;
        payload["status"] ??= "draft";
        payload["version"] ??= 1;
        return await records.UpsertAsync(QuestionsModule, id, payload, ct);
    }

    public async Task<JsonObject> UpdateQuestionAsync(string id, JsonObject patch, CancellationToken ct)
    {
        var existing = await records.GetAsync(QuestionsModule, id, ct)
            ?? throw new EntityNotFoundException("السؤال غير موجود");
        foreach (var item in patch) existing[item.Key] = item.Value?.DeepClone();
        var nextVersion = (int)(AdminRecordJson.NumberProp(existing, "version") ?? 1) + 1;
        existing["version"] = nextVersion;
        return await records.UpsertAsync(QuestionsModule, id, existing, ct);
    }

    public Task<JsonObject> PublishQuestionAsync(string id, CancellationToken ct) =>
        UpdateQuestionAsync(id, new JsonObject { ["status"] = "live" }, ct);

    public async Task<IReadOnlyList<object>> GetCategoryCountsAsync(CancellationToken ct)
    {
        var rows = await records.ListAsync(QuestionsModule, ct);
        return rows
            .GroupBy(x => AdminRecordJson.StringProp(x, "category") ?? "غير مصنّف")
            .Select(g => (object)new { name = g.Key, count = g.Count() })
            .OrderByDescending(x => ((dynamic)x).count)
            .ToList();
    }

    public async Task<object> BatchCreateQuestionsAsync(IReadOnlyList<JsonObject> rows, CancellationToken ct)
    {
        if (rows.Count == 0) return new { created = 0, skipped = 0, ids = Array.Empty<string>() };
        if (rows.Count > 1000)
        {
            throw new ConflictException("BATCH_TOO_LARGE", "عدد الأسئلة يتجاوز الحد المسموح (1000 سؤال).");
        }
        var ids = new List<string>(rows.Count);
        foreach (var row in rows)
        {
            var id = AdminRecordJson.StringProp(row, "id") ?? NextQuestionId();
            row["id"] = id;
            row["status"] ??= "draft";
            row["version"] ??= 1;
            await records.UpsertAsync(QuestionsModule, id, row, ct);
            ids.Add(id);
        }
        return new { created = ids.Count, skipped = 0, ids };
    }

    /* ── Exams ─────────────────────────────────────────────────────── */

    public Task<IReadOnlyList<JsonObject>> ListExamsAsync(CancellationToken ct) =>
        records.ListAsync(ExamsModule, ct);

    public Task<JsonObject?> GetExamAsync(string id, CancellationToken ct) =>
        records.GetAsync(ExamsModule, id, ct);

    public async Task<JsonObject> CreateExamAsync(JsonObject payload, CancellationToken ct)
    {
        var id = AdminRecordJson.StringProp(payload, "id") ?? NextExamId();
        payload["id"] = id;
        payload["status"] ??= "draft";
        return await records.UpsertAsync(ExamsModule, id, payload, ct);
    }

    public async Task<JsonObject> PublishExamAsync(string id, CancellationToken ct)
    {
        var existing = await records.GetAsync(ExamsModule, id, ct)
            ?? throw new EntityNotFoundException("الاختبار غير موجود");
        existing["status"] = "published";
        return await records.UpsertAsync(ExamsModule, id, existing, ct);
    }

    /* ── Attempts + grading ────────────────────────────────────────── */

    public async Task<JsonObject> StartAttemptAsync(string examId, string applicantId, CancellationToken ct)
    {
        var attempt = new JsonObject
        {
            ["id"] = NextAttemptId(),
            ["examId"] = examId,
            ["applicantId"] = applicantId,
            ["startedAt"] = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            ["answers"] = new JsonObject(),
            ["flagged"] = new JsonArray(),
        };
        return await records.UpsertAsync(
            AttemptsModule,
            AdminRecordJson.StringProp(attempt, "id")!,
            attempt,
            ct);
    }

    public async Task<JsonObject> SubmitAttemptAsync(string attemptId, JsonObject answers, CancellationToken ct)
    {
        var attempt = await records.GetAsync(AttemptsModule, attemptId, ct)
            ?? throw new EntityNotFoundException("Attempt not found");
        attempt["answers"] = answers.DeepClone();
        attempt["submittedAt"] = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        var examId = AdminRecordJson.StringProp(attempt, "examId") ?? "";
        var exam = await records.GetAsync(ExamsModule, examId, ct);
        if (exam is not null && exam["questionIds"] is JsonArray qids && qids.Count > 0)
        {
            var correct = 0;
            foreach (var node in qids.OfType<JsonValue>())
            {
                var qid = node.GetValue<string>();
                var question = await records.GetAsync(QuestionsModule, qid, ct);
                if (question is null) continue;
                if (IsAnswerCorrect(question, answers[qid])) correct++;
            }
            var total = qids.Count;
            var score = (int)Math.Round(correct * 100.0 / Math.Max(1, total));
            attempt["score"] = score;
            attempt["passFail"] = score >= 60 ? "pass" : "fail";
        }

        return await records.UpsertAsync(AttemptsModule, attemptId, attempt, ct);
    }

    public async Task<IReadOnlyList<JsonObject>> ListAttemptsAsync(string examId, CancellationToken ct)
    {
        var rows = await records.ListAsync(AttemptsModule, ct);
        return rows.Where(x => AdminRecordJson.StringProp(x, "examId") == examId).ToList();
    }

    /* ── Conflict check: 6-month re-take window ────────────────────── */

    public async Task<object> CheckConflictAsync(string applicantId, string examId, CancellationToken ct)
    {
        var sixMonthsAgo = DateTimeOffset.UtcNow.AddDays(-180).ToUnixTimeMilliseconds();
        var rows = await records.ListAsync(AttemptsModule, ct);
        var hit = rows.FirstOrDefault(x =>
            AdminRecordJson.StringProp(x, "applicantId") == applicantId &&
            AdminRecordJson.StringProp(x, "examId") == examId &&
            (AdminRecordJson.NumberProp(x, "startedAt") ?? 0) > sixMonthsAgo);
        return hit is null
            ? new { ok = true }
            : new { ok = false, reason = "لا يمكن إعادة الاختبار قبل مرور 6 شهور." };
    }

    /* ── Live proctor surface ──────────────────────────────────────── */

    public async Task<object> ListLiveSessionsAsync(string examId, CancellationToken ct)
    {
        var rows = await records.ListAsync(LiveSessionsModule, ct);
        var sessions = rows.Where(x => AdminRecordJson.StringProp(x, "examId") == examId).ToList();
        var totals = new Dictionary<string, int>
        {
            ["not-started"] = 0,
            ["started"] = 0,
            ["in-progress"] = 0,
            ["dropped"] = 0,
            ["finished"] = 0,
        };
        foreach (var s in sessions)
        {
            var st = AdminRecordJson.StringProp(s, "status") ?? "not-started";
            totals[st] = totals.GetValueOrDefault(st) + 1;
        }
        return new
        {
            sessions,
            totalsByStatus = totals,
            lastUpdated = DateTimeOffset.UtcNow.ToString("O"),
            answersPerMinute = Enumerable.Range(0, 24).Select(_ => 0).ToArray(),
        };
    }

    /* ── Internals ─────────────────────────────────────────────────── */

    private static bool IsAnswerCorrect(JsonObject question, JsonNode? answer)
    {
        var type = AdminRecordJson.StringProp(question, "type") ?? "mcq";
        if (type == "matching")
        {
            if (answer is not JsonObject answerObj) return false;
            if (question["matchingPairs"] is not JsonArray pairs) return false;
            foreach (var pair in pairs.OfType<JsonObject>())
            {
                var prompt = AdminRecordJson.StringProp(pair, "prompt") ?? "";
                var expected = AdminRecordJson.StringProp(pair, "match") ?? "";
                var got = AdminRecordJson.StringProp(answerObj, prompt);
                if (got != expected) return false;
            }
            return pairs.Count > 0;
        }

        if (answer is JsonValue value)
        {
            if (!value.TryGetValue<int>(out var idx)) return false;
            var correctIndex = (int)(AdminRecordJson.NumberProp(question, "correctIndex") ?? -1);
            return idx == correctIndex;
        }
        return false;
    }

    private static string NextQuestionId() => $"Q-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
    private static string NextExamId() => $"EXAM-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
    private static string NextAttemptId() => $"ATT-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
}
