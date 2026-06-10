using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Persistence;

namespace PACademy.Admin.Api.Modules.Exams;

/// <summary>
/// Seeds the Question Bank + Exams catalog into normalized exam tables.
/// Idempotent: only seeds when the bucket is empty, so manual edits via
/// the API are preserved across restarts.
/// </summary>
public sealed class ExamsSeeder(IWebHostEnvironment environment, ILogger<ExamsSeeder> logger)
{
    public async Task SeedAsync(AdminDbContext db, CancellationToken ct = default)
    {
        var path = Path.Combine(environment.ContentRootPath, "SeedData", "exams.seed.json");
        if (!File.Exists(path))
        {
            logger.LogWarning("Exams seed file missing at {Path}; skipping seed", path);
            return;
        }

        await using var stream = File.OpenRead(path);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        var root = doc.RootElement;
        var now = DateTimeOffset.UtcNow;

        // Exam operational buckets (committee users, devices, results, audit) seed
        // independently of the normalized question/exam catalog tables, so an
        // already-seeded database still picks them up. Each bucket is idempotent.
        var operationalInserted = await SeedOperationalBucketsAsync(db, root, ct);

        var hasQuestions = await db.ExamQuestions.AnyAsync(ct);
        var hasExams = await db.Exams.AnyAsync(ct);
        if (hasQuestions && hasExams)
        {
            var removed = await RemoveLegacyAdminRecordsAsync(db, ct);
            if (operationalInserted > 0 || removed > 0) await db.SaveChangesAsync(ct);
            return;
        }

        var inserted = 0;

        if (!hasQuestions && root.TryGetProperty("questions", out var questions) && questions.ValueKind == JsonValueKind.Array)
        {
            foreach (var row in questions.EnumerateArray())
            {
                var obj = JsonNode.Parse(row.GetRawText())!.AsObject();
                var id = AdminRecordJson.StringProp(obj, "id")
                    ?? $"Q-{Guid.NewGuid():N}".ToUpperInvariant();
                db.ExamQuestions.Add(new ExamQuestionEntity
                {
                    Id = id,
                    Category = AdminRecordJson.StringProp(obj, "category") ?? "",
                    Classification = AdminRecordJson.StringProp(obj, "classification"),
                    Difficulty = (int)(AdminRecordJson.NumberProp(obj, "difficulty") ?? 1),
                    Type = AdminRecordJson.StringProp(obj, "type") ?? "mcq",
                    Text = AdminRecordJson.StringProp(obj, "text") ?? "",
                    CorrectIndex = (int)(AdminRecordJson.NumberProp(obj, "correctIndex") ?? 0),
                    TimeLimitSeconds = (int)(AdminRecordJson.NumberProp(obj, "timeLimitSeconds") ?? 60),
                    Notes = AdminRecordJson.StringProp(obj, "notes"),
                    Status = AdminRecordJson.StringProp(obj, "status") ?? "draft",
                    Version = (int)(AdminRecordJson.NumberProp(obj, "version") ?? 1),
                    ImageUrl = AdminRecordJson.StringProp(obj, "imageUrl"),
                    CreatedAt = now,
                    UpdatedAt = now,
                    Options = (obj["options"] as JsonArray ?? [])
                        .Select((node, index) => new ExamQuestionOptionEntity
                        {
                            QuestionId = id,
                            OptionOrder = index,
                            OptionText = node?.GetValue<string>() ?? ""
                        })
                        .ToList(),
                    MatchingPairs = (obj["matchingPairs"] as JsonArray ?? [])
                        .OfType<JsonObject>()
                        .Select((pair, index) => new ExamQuestionMatchingPairEntity
                        {
                            QuestionId = id,
                            PairOrder = index,
                            Prompt = AdminRecordJson.StringProp(pair, "prompt") ?? "",
                            MatchText = AdminRecordJson.StringProp(pair, "match") ?? ""
                        })
                        .ToList()
                });
                inserted++;
            }
        }

        if (!hasExams && root.TryGetProperty("exams", out var exams) && exams.ValueKind == JsonValueKind.Array)
        {
            foreach (var row in exams.EnumerateArray())
            {
                var obj = JsonNode.Parse(row.GetRawText())!.AsObject();
                var id = AdminRecordJson.StringProp(obj, "id")
                    ?? $"EXAM-{Guid.NewGuid():N}".ToUpperInvariant();
                db.Exams.Add(new ExamEntity
                {
                    Id = id,
                    NameAr = AdminRecordJson.StringProp(obj, "nameAr") ?? id,
                    CycleId = AdminRecordJson.StringProp(obj, "cycleId") ?? "",
                    CycleName = AdminRecordJson.StringProp(obj, "cycleName"),
                    ScheduledFor = AdminRecordJson.StringProp(obj, "scheduledFor"),
                    AccessStartAt = AdminRecordJson.StringProp(obj, "accessStartAt"),
                    AccessEndAt = AdminRecordJson.StringProp(obj, "accessEndAt"),
                    DurationMinutes = (int?)AdminRecordJson.NumberProp(obj, "durationMinutes"),
                    QuestionCount = (int?)AdminRecordJson.NumberProp(obj, "questionCount"),
                    RandomSelection = BoolProp(obj, "randomSelection"),
                    RandomQuestionOrder = BoolProp(obj, "randomQuestionOrder"),
                    DisplayMode = AdminRecordJson.StringProp(obj, "displayMode"),
                    Status = AdminRecordJson.StringProp(obj, "status") ?? "draft",
                    CreatedAt = now,
                    UpdatedAt = now,
                    Rules = (obj["rules"] as JsonArray ?? [])
                        .OfType<JsonObject>()
                        .Select((rule, index) => new ExamRuleEntity
                        {
                            ExamId = id,
                            RuleOrder = index,
                            Category = AdminRecordJson.StringProp(rule, "category") ?? "",
                            DifficultyMin = (int)(AdminRecordJson.NumberProp(rule, "difficultyMin") ?? 1),
                            DifficultyMax = (int)(AdminRecordJson.NumberProp(rule, "difficultyMax") ?? 5),
                            QuestionCount = (int)(AdminRecordJson.NumberProp(rule, "count") ?? 0),
                            Minutes = (int)(AdminRecordJson.NumberProp(rule, "minutes") ?? 0)
                        })
                        .ToList(),
                    QuestionLinks = (obj["questionIds"] as JsonArray ?? [])
                        .Select((node, index) => new ExamQuestionLinkEntity
                        {
                            ExamId = id,
                            QuestionOrder = index,
                            QuestionId = node?.GetValue<string>() ?? ""
                        })
                        .ToList()
                });
                inserted++;
            }
        }

        var removedLegacyRows = await RemoveLegacyAdminRecordsAsync(db, ct);

        if (inserted == 0 && removedLegacyRows == 0 && operationalInserted == 0) return;
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Seeded {Count} Question Bank rows + {Rows} exam operational rows", inserted, operationalInserted);
    }

    private static readonly (string JsonKey, string Module)[] OperationalBuckets =
    [
        ("committeeUsers", ExamsService.CommitteeUsersModule),
        ("devices", ExamsService.DevicesModule),
        ("results", ExamsService.ResultsModule),
        ("audit", ExamsService.AuditModule)
    ];

    private static async Task<int> SeedOperationalBucketsAsync(AdminDbContext db, JsonElement root, CancellationToken ct)
    {
        // Route through OperationalRecordsService so normalized buckets
        // (exam-committee-users, exam-devices, exam-results) land in their typed
        // tables via the same MERGE the runtime uses; JSON buckets (exam-audit)
        // fall through to the operational store. NullAuditSink keeps seeding
        // out of audit_entries.
        var records = new OperationalRecordsService(db, new HttpContextAccessor(), new PACademy.Shared.Audit.NullAuditSink());
        var inserted = 0;
        foreach (var (jsonKey, module) in OperationalBuckets)
        {
            if ((await records.ListAsync(module, ct)).Count > 0) continue;
            if (!root.TryGetProperty(jsonKey, out var rows) || rows.ValueKind != JsonValueKind.Array) continue;
            foreach (var row in rows.EnumerateArray())
            {
                var obj = JsonNode.Parse(row.GetRawText())!.AsObject();
                var id = AdminRecordJson.StringProp(obj, "id") ?? $"{module}-{Guid.NewGuid():N}".ToUpperInvariant();
                await records.UpsertAsync(module, id, obj, ct);
                inserted++;
            }
        }
        return inserted;
    }

    private static async Task<int> RemoveLegacyAdminRecordsAsync(AdminDbContext db, CancellationToken ct)
    {
        var staleRows = await db.AdminRecords
            .Where(x => x.Module == ExamsService.QuestionsModule || x.Module == ExamsService.ExamsModule)
            .ToListAsync(ct);
        db.AdminRecords.RemoveRange(staleRows);
        if (staleRows.Count > 0) await db.SaveChangesAsync(ct);
        return staleRows.Count;
    }

    private static bool? BoolProp(JsonObject obj, string name)
    {
        if (!obj.TryGetPropertyValue(name, out var node) || node is null) return null;
        return node.GetValue<bool>();
    }
}
