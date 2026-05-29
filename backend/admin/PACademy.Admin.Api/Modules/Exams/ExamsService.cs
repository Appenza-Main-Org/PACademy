using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Modules.Exams;

/// <summary>
/// Question Bank + Exams service. Questions and exam definitions use typed
/// normalized tables; transient attempts still use the legacy record bucket.
/// Grades attempts in-process (mcq / true-false rely on
/// <c>correctIndex</c>, matching compares <c>matchingPairs</c> against the
/// applicant's <c>{ prompt: match }</c> dict).
/// </summary>
public sealed class ExamsService(AdminRecordsService records, IExamsDbContext examsDb)
{
    public const string QuestionsModule = "questions";
    public const string ExamsModule = "exams";
    public const string AttemptsModule = "exam-attempts";
    public const string LiveSessionsModule = "exam-live-sessions";

    /* ── Questions ─────────────────────────────────────────────────── */

    public async Task<IReadOnlyList<JsonObject>> ListQuestionsAsync(string? status, string? category, CancellationToken ct)
    {
        var rows = await examsDb.ExamQuestions
            .AsNoTracking()
            .Include(x => x.Options)
            .Include(x => x.MatchingPairs)
            .OrderBy(x => x.Id)
            .ToListAsync(ct);
        var mapped = rows.Select(ToQuestionJson).ToList();
        if (!string.IsNullOrWhiteSpace(status) && status != "all")
        {
            mapped = mapped.Where(x => AdminRecordJson.StringProp(x, "status") == status).ToList();
        }
        if (!string.IsNullOrWhiteSpace(category) && category != "all")
        {
            mapped = mapped.Where(x => AdminRecordJson.StringProp(x, "category") == category).ToList();
        }
        return mapped;
    }

    public async Task<JsonObject?> GetQuestionAsync(string id, CancellationToken ct)
    {
        var row = await LoadQuestionAsync(id, ct, asTracking: false);
        return row is null ? null : ToQuestionJson(row);
    }

    public async Task<JsonObject> CreateQuestionAsync(JsonObject payload, CancellationToken ct)
    {
        var id = AdminRecordJson.StringProp(payload, "id") ?? NextQuestionId();
        var now = DateTimeOffset.UtcNow;
        var entity = QuestionFromJson(id, payload, now, now);
        examsDb.ExamQuestions.Add(entity);
        await ReplaceQuestionChildrenAsync(id, payload, ct);
        await examsDb.SaveChangesAsync(ct);
        return ToQuestionJson((await LoadQuestionAsync(id, ct, asTracking: false))!);
    }

    public async Task<JsonObject> UpdateQuestionAsync(string id, JsonObject patch, CancellationToken ct)
    {
        var existing = await LoadQuestionAsync(id, ct, asTracking: true)
            ?? throw new EntityNotFoundException("السؤال غير موجود");
        var merged = ToQuestionJson(existing);
        foreach (var item in patch) merged[item.Key] = item.Value?.DeepClone();
        merged["version"] = existing.Version + 1;
        ApplyQuestionJson(existing, merged, existing.CreatedAt, DateTimeOffset.UtcNow);
        await ReplaceQuestionChildrenAsync(id, merged, ct);
        await examsDb.SaveChangesAsync(ct);
        return ToQuestionJson((await LoadQuestionAsync(id, ct, asTracking: false))!);
    }

    public Task<JsonObject> PublishQuestionAsync(string id, CancellationToken ct) =>
        UpdateQuestionAsync(id, new JsonObject { ["status"] = "live" }, ct);

    public async Task<IReadOnlyList<object>> GetCategoryCountsAsync(CancellationToken ct)
    {
        var rows = await examsDb.ExamQuestions.AsNoTracking().ToListAsync(ct);
        return rows
            .GroupBy(x => x.Category)
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
            var now = DateTimeOffset.UtcNow;
            examsDb.ExamQuestions.Add(QuestionFromJson(id, row, now, now));
            await ReplaceQuestionChildrenAsync(id, row, ct);
            ids.Add(id);
        }
        await examsDb.SaveChangesAsync(ct);
        return new { created = ids.Count, skipped = 0, ids };
    }

    /* ── Exams ─────────────────────────────────────────────────────── */

    public async Task<IReadOnlyList<JsonObject>> ListExamsAsync(CancellationToken ct)
    {
        var rows = await examsDb.Exams
            .AsNoTracking()
            .Include(x => x.Rules)
            .Include(x => x.QuestionLinks)
            .Include(x => x.Assignments)
            .OrderBy(x => x.Id)
            .ToListAsync(ct);
        return rows.Select(ToExamJson).ToList();
    }

    public async Task<JsonObject?> GetExamAsync(string id, CancellationToken ct)
    {
        var row = await LoadExamAsync(id, ct, asTracking: false);
        return row is null ? null : ToExamJson(row);
    }

    public async Task<JsonObject> CreateExamAsync(JsonObject payload, CancellationToken ct)
    {
        var id = AdminRecordJson.StringProp(payload, "id") ?? NextExamId();
        var now = DateTimeOffset.UtcNow;
        var entity = ExamFromJson(id, payload, now, now);
        examsDb.Exams.Add(entity);
        await ReplaceExamChildrenAsync(id, payload, ct);
        await examsDb.SaveChangesAsync(ct);
        return ToExamJson((await LoadExamAsync(id, ct, asTracking: false))!);
    }

    public async Task<JsonObject> PublishExamAsync(string id, CancellationToken ct)
    {
        var existing = await LoadExamAsync(id, ct, asTracking: true)
            ?? throw new EntityNotFoundException("الاختبار غير موجود");
        existing.Status = "published";
        existing.UpdatedAt = DateTimeOffset.UtcNow;
        await examsDb.SaveChangesAsync(ct);
        return ToExamJson((await LoadExamAsync(id, ct, asTracking: false))!);
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
        var exam = await GetExamAsync(examId, ct);
        if (exam is not null && exam["questionIds"] is JsonArray qids && qids.Count > 0)
        {
            var correct = 0;
            foreach (var node in qids.OfType<JsonValue>())
            {
                var qid = node.GetValue<string>();
                var question = await GetQuestionAsync(qid, ct);
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

    private async Task<ExamQuestionEntity?> LoadQuestionAsync(string id, CancellationToken ct, bool asTracking)
    {
        var query = examsDb.ExamQuestions
            .Include(x => x.Options)
            .Include(x => x.MatchingPairs)
            .Where(x => x.Id == id);
        if (!asTracking) query = query.AsNoTracking();
        return await query.FirstOrDefaultAsync(ct);
    }

    private async Task<ExamEntity?> LoadExamAsync(string id, CancellationToken ct, bool asTracking)
    {
        var query = examsDb.Exams
            .Include(x => x.Rules)
            .Include(x => x.QuestionLinks)
            .Include(x => x.Assignments)
            .Where(x => x.Id == id);
        if (!asTracking) query = query.AsNoTracking();
        return await query.FirstOrDefaultAsync(ct);
    }

    private static JsonObject ToQuestionJson(ExamQuestionEntity row)
    {
        var obj = new JsonObject
        {
            ["id"] = row.Id,
            ["category"] = row.Category,
            ["difficulty"] = row.Difficulty,
            ["type"] = row.Type,
            ["text"] = row.Text,
            ["options"] = new JsonArray(row.Options.OrderBy(x => x.OptionOrder).Select(x => JsonValue.Create(x.OptionText)).ToArray<JsonNode?>()),
            ["correctIndex"] = row.CorrectIndex,
            ["timeLimitSeconds"] = row.TimeLimitSeconds,
            ["status"] = row.Status,
            ["version"] = row.Version
        };
        if (!string.IsNullOrWhiteSpace(row.Classification)) obj["classification"] = row.Classification;
        if (!string.IsNullOrWhiteSpace(row.Notes)) obj["notes"] = row.Notes;
        if (!string.IsNullOrWhiteSpace(row.ImageUrl)) obj["imageUrl"] = row.ImageUrl;
        if (row.MatchingPairs.Count > 0)
        {
            obj["matchingPairs"] = new JsonArray(row.MatchingPairs
                .OrderBy(x => x.PairOrder)
                .Select(x => new JsonObject { ["prompt"] = x.Prompt, ["match"] = x.MatchText })
                .ToArray<JsonNode?>());
        }
        return obj;
    }

    private static JsonObject ToExamJson(ExamEntity row)
    {
        var obj = new JsonObject
        {
            ["id"] = row.Id,
            ["nameAr"] = row.NameAr,
            ["cycleId"] = row.CycleId,
            ["rules"] = new JsonArray(row.Rules
                .OrderBy(x => x.RuleOrder)
                .Select(x => new JsonObject
                {
                    ["category"] = x.Category,
                    ["difficultyMin"] = x.DifficultyMin,
                    ["difficultyMax"] = x.DifficultyMax,
                    ["count"] = x.QuestionCount,
                    ["minutes"] = x.Minutes
                })
                .ToArray<JsonNode?>()),
            ["questionIds"] = new JsonArray(row.QuestionLinks
                .OrderBy(x => x.QuestionOrder)
                .Select(x => JsonValue.Create(x.QuestionId))
                .ToArray<JsonNode?>()),
            ["status"] = row.Status
        };
        SetIfPresent(obj, "cycleName", row.CycleName);
        SetIfPresent(obj, "scheduledFor", row.ScheduledFor);
        SetIfPresent(obj, "accessStartAt", row.AccessStartAt);
        SetIfPresent(obj, "accessEndAt", row.AccessEndAt);
        SetIfPresent(obj, "displayMode", row.DisplayMode);
        if (row.DurationMinutes is not null) obj["durationMinutes"] = row.DurationMinutes;
        if (row.QuestionCount is not null) obj["questionCount"] = row.QuestionCount;
        if (row.RandomSelection is not null) obj["randomSelection"] = row.RandomSelection;
        if (row.RandomQuestionOrder is not null) obj["randomQuestionOrder"] = row.RandomQuestionOrder;
        foreach (var (kind, prop) in AssignmentProperties)
        {
            var values = row.Assignments
                .Where(x => x.AssignmentKind == kind)
                .OrderBy(x => x.AssignmentOrder)
                .Select(x => JsonValue.Create(x.Value))
                .ToArray<JsonNode?>();
            if (values.Length > 0) obj[prop] = new JsonArray(values);
        }
        return obj;
    }

    private static ExamQuestionEntity QuestionFromJson(string id, JsonObject payload, DateTimeOffset createdAt, DateTimeOffset updatedAt)
    {
        var entity = new ExamQuestionEntity
        {
            Id = id,
            Category = "",
            Difficulty = 1,
            Type = "",
            Text = "",
            CorrectIndex = 0,
            TimeLimitSeconds = 60,
            Status = "draft",
            Version = 1,
            CreatedAt = createdAt,
            UpdatedAt = updatedAt
        };
        ApplyQuestionJson(entity, payload, createdAt, updatedAt);
        return entity;
    }

    private static void ApplyQuestionJson(ExamQuestionEntity entity, JsonObject payload, DateTimeOffset createdAt, DateTimeOffset updatedAt)
    {
        entity.Category = StringProp(payload, "category") ?? entity.Category;
        entity.Classification = StringProp(payload, "classification");
        entity.Difficulty = IntProp(payload, "difficulty") ?? entity.Difficulty;
        entity.Type = StringProp(payload, "type") ?? entity.Type;
        entity.Text = StringProp(payload, "text") ?? entity.Text;
        entity.CorrectIndex = IntProp(payload, "correctIndex") ?? entity.CorrectIndex;
        entity.TimeLimitSeconds = IntProp(payload, "timeLimitSeconds") ?? entity.TimeLimitSeconds;
        entity.Notes = StringProp(payload, "notes");
        entity.Status = StringProp(payload, "status") ?? entity.Status;
        entity.Version = IntProp(payload, "version") ?? entity.Version;
        entity.ImageUrl = StringProp(payload, "imageUrl");
        entity.CreatedAt = createdAt;
        entity.UpdatedAt = updatedAt;
    }

    private static ExamEntity ExamFromJson(string id, JsonObject payload, DateTimeOffset createdAt, DateTimeOffset updatedAt)
    {
        return new ExamEntity
        {
            Id = id,
            NameAr = StringProp(payload, "nameAr") ?? id,
            CycleId = StringProp(payload, "cycleId") ?? "",
            CycleName = StringProp(payload, "cycleName"),
            ScheduledFor = StringProp(payload, "scheduledFor"),
            AccessStartAt = StringProp(payload, "accessStartAt"),
            AccessEndAt = StringProp(payload, "accessEndAt"),
            DurationMinutes = IntProp(payload, "durationMinutes"),
            QuestionCount = IntProp(payload, "questionCount"),
            RandomSelection = BoolProp(payload, "randomSelection"),
            RandomQuestionOrder = BoolProp(payload, "randomQuestionOrder"),
            DisplayMode = StringProp(payload, "displayMode"),
            Status = StringProp(payload, "status") ?? "draft",
            CreatedAt = createdAt,
            UpdatedAt = updatedAt
        };
    }

    private async Task ReplaceQuestionChildrenAsync(string id, JsonObject payload, CancellationToken ct)
    {
        examsDb.ExamQuestionOptions.RemoveRange(examsDb.ExamQuestionOptions.Where(x => x.QuestionId == id));
        examsDb.ExamQuestionMatchingPairs.RemoveRange(examsDb.ExamQuestionMatchingPairs.Where(x => x.QuestionId == id));
        var order = 0;
        foreach (var option in payload["options"] as JsonArray ?? [])
        {
            examsDb.ExamQuestionOptions.Add(new ExamQuestionOptionEntity
            {
                QuestionId = id,
                OptionOrder = order++,
                OptionText = option?.GetValue<string>() ?? ""
            });
        }
        order = 0;
        foreach (var pair in (payload["matchingPairs"] as JsonArray ?? []).OfType<JsonObject>())
        {
            examsDb.ExamQuestionMatchingPairs.Add(new ExamQuestionMatchingPairEntity
            {
                QuestionId = id,
                PairOrder = order++,
                Prompt = StringProp(pair, "prompt") ?? "",
                MatchText = StringProp(pair, "match") ?? ""
            });
        }
        await Task.CompletedTask;
    }

    private async Task ReplaceExamChildrenAsync(string id, JsonObject payload, CancellationToken ct)
    {
        examsDb.ExamRules.RemoveRange(examsDb.ExamRules.Where(x => x.ExamId == id));
        examsDb.ExamQuestionLinks.RemoveRange(examsDb.ExamQuestionLinks.Where(x => x.ExamId == id));
        examsDb.ExamAssignments.RemoveRange(examsDb.ExamAssignments.Where(x => x.ExamId == id));

        var order = 0;
        foreach (var rule in (payload["rules"] as JsonArray ?? []).OfType<JsonObject>())
        {
            examsDb.ExamRules.Add(new ExamRuleEntity
            {
                ExamId = id,
                RuleOrder = order++,
                Category = StringProp(rule, "category") ?? "",
                DifficultyMin = IntProp(rule, "difficultyMin") ?? 1,
                DifficultyMax = IntProp(rule, "difficultyMax") ?? 5,
                QuestionCount = IntProp(rule, "count") ?? 0,
                Minutes = IntProp(rule, "minutes") ?? 0
            });
        }

        order = 0;
        foreach (var questionId in payload["questionIds"] as JsonArray ?? [])
        {
            examsDb.ExamQuestionLinks.Add(new ExamQuestionLinkEntity
            {
                ExamId = id,
                QuestionOrder = order++,
                QuestionId = questionId?.GetValue<string>() ?? ""
            });
        }

        foreach (var (kind, prop) in AssignmentProperties)
        {
            order = 0;
            foreach (var value in payload[prop] as JsonArray ?? [])
            {
                examsDb.ExamAssignments.Add(new ExamAssignmentEntity
                {
                    ExamId = id,
                    AssignmentKind = kind,
                    AssignmentOrder = order++,
                    Value = value?.GetValue<string>() ?? ""
                });
            }
        }
        await Task.CompletedTask;
    }

    private static readonly (string Kind, string Prop)[] AssignmentProperties =
    [
        ("category", "assignedCategories"),
        ("type", "assignedTypes"),
        ("gender", "assignedGenders"),
        ("specialization", "assignedSpecializations"),
        ("reopenedApplicant", "reopenedApplicantIds")
    ];

    private static string? StringProp(JsonObject obj, string name) =>
        obj.TryGetPropertyValue(name, out var node) ? node?.GetValue<string>() : null;

    private static int? IntProp(JsonObject obj, string name)
    {
        if (!obj.TryGetPropertyValue(name, out var node) || node is null) return null;
        return node.GetValue<int>();
    }

    private static bool? BoolProp(JsonObject obj, string name)
    {
        if (!obj.TryGetPropertyValue(name, out var node) || node is null) return null;
        return node.GetValue<bool>();
    }

    private static void SetIfPresent(JsonObject obj, string name, string? value)
    {
        if (!string.IsNullOrWhiteSpace(value)) obj[name] = value;
    }
}
