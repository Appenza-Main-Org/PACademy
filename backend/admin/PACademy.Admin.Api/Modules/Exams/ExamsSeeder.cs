using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.AdminRecords;

namespace PACademy.Admin.Api.Modules.Exams;

/// <summary>
/// Seeds the Question Bank + Exams catalog into the shared <c>admin_records</c>
/// JSON store. Uses two module buckets:
///   <c>questions</c> — <see cref="ExamsService.QuestionsModule"/>
///   <c>exams</c>     — <see cref="ExamsService.ExamsModule"/>
/// Idempotent: only seeds when the bucket is empty, so manual edits via
/// the API are preserved across restarts.
/// </summary>
public sealed class ExamsSeeder(IWebHostEnvironment environment, ILogger<ExamsSeeder> logger)
{
    public async Task SeedAsync(IAdminRecordsDbContext db, CancellationToken ct = default)
    {
        var path = Path.Combine(environment.ContentRootPath, "SeedData", "exams.seed.json");
        if (!File.Exists(path))
        {
            logger.LogWarning("Exams seed file missing at {Path}; skipping seed", path);
            return;
        }

        var hasQuestions = await db.AdminRecords.AnyAsync(x => x.Module == ExamsService.QuestionsModule, ct);
        var hasExams = await db.AdminRecords.AnyAsync(x => x.Module == ExamsService.ExamsModule, ct);
        if (hasQuestions && hasExams) return;

        await using var stream = File.OpenRead(path);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        var root = doc.RootElement;
        var now = DateTimeOffset.UtcNow;
        var inserted = 0;

        if (!hasQuestions && root.TryGetProperty("questions", out var questions) && questions.ValueKind == JsonValueKind.Array)
        {
            foreach (var row in questions.EnumerateArray())
            {
                var obj = JsonNode.Parse(row.GetRawText())!.AsObject();
                var id = AdminRecordJson.StringProp(obj, "id")
                    ?? $"Q-{Guid.NewGuid():N}".ToUpperInvariant();
                db.AdminRecords.Add(new AdminRecordEntity
                {
                    Module = ExamsService.QuestionsModule,
                    Id = id,
                    PayloadJson = obj.ToJsonString(AdminRecordJson.Options),
                    CreatedAt = now,
                    UpdatedAt = now,
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
                db.AdminRecords.Add(new AdminRecordEntity
                {
                    Module = ExamsService.ExamsModule,
                    Id = id,
                    PayloadJson = obj.ToJsonString(AdminRecordJson.Options),
                    CreatedAt = now,
                    UpdatedAt = now,
                });
                inserted++;
            }
        }

        if (inserted == 0) return;
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Seeded {Count} Question Bank rows", inserted);
    }
}
