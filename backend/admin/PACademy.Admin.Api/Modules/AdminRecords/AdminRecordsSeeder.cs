using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;

namespace PACademy.Admin.Api.Modules.AdminRecords;

public sealed class AdminRecordsSeeder(IWebHostEnvironment environment, ILogger<AdminRecordsSeeder> logger)
{
    public async Task SeedAsync(IAdminRecordsDbContext db, CancellationToken ct = default)
    {
        if (await db.AdminRecords.AnyAsync(ct)) return;
        var path = Path.Combine(environment.ContentRootPath, "SeedData", "admin-records.seed.json");
        await using var stream = File.OpenRead(path);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        var root = doc.RootElement;
        var now = DateTimeOffset.UtcNow;
        var count = 0;

        foreach (var module in new[] { "applicants", "payments", "notifications", "committeeInstances", "workflows", "applicantWorkflowProgress", "workflowTransitions", "audit", "committees" })
        {
            if (!root.TryGetProperty(module, out var rows) || rows.ValueKind != JsonValueKind.Array) continue;
            foreach (var row in rows.EnumerateArray())
            {
                var obj = JsonNode.Parse(row.GetRawText())!.AsObject();
                var id = ResolveId(module, obj);
                db.AdminRecords.Add(new AdminRecordEntity
                {
                    Module = module,
                    Id = id,
                    PayloadJson = obj.ToJsonString(AdminRecordJson.Options),
                    CreatedAt = now,
                    UpdatedAt = now
                });
                count++;
            }
        }

        foreach (var singleton in new[] { "kpis" })
        {
            if (!root.TryGetProperty(singleton, out var value)) continue;
            var obj = JsonNode.Parse(value.GetRawText())!.AsObject();
            db.AdminRecords.Add(new AdminRecordEntity
            {
                Module = singleton,
                Id = singleton,
                PayloadJson = obj.ToJsonString(AdminRecordJson.Options),
                CreatedAt = now,
                UpdatedAt = now
            });
            count++;
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Seeded {Count} admin JSON records", count);
    }

    private static string ResolveId(string module, JsonObject obj)
    {
        return AdminRecordJson.StringProp(obj, "id")
            ?? AdminRecordJson.StringProp(obj, "fawryReference")
            ?? AdminRecordJson.StringProp(obj, "reference")
            ?? AdminRecordJson.StringProp(obj, "applicantId")
            ?? $"{module}-{Guid.NewGuid():N}";
    }
}
