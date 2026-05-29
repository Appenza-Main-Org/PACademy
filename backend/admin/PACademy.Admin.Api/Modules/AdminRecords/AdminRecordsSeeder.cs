using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Persistence;

namespace PACademy.Admin.Api.Modules.AdminRecords;

public sealed class AdminRecordsSeeder(IWebHostEnvironment environment, ILogger<AdminRecordsSeeder> logger)
{
    private static readonly string[] MockSeedModules =
    [
        "applicants",
        "payments",
        "notifications",
        "committeeInstances",
        "workflows",
        "applicantWorkflowProgress",
        "workflowTransitions",
        "committees",
        "kpis"
    ];

    public async Task SeedAsync(AdminDbContext db, CancellationToken ct = default)
    {
        await RemoveLegacyAuditRecordsAsync(db, ct);
        if (!ShouldSeedMockRecords()) return;

        await RemoveMockSeedRecordsAsync(db, ct);
        if (await db.AdminRecordDocuments.AnyAsync(ct)) return;
        var path = Path.Combine(environment.ContentRootPath, "SeedData", "admin-records.seed.json");
        await using var stream = File.OpenRead(path);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        var root = doc.RootElement;
        var now = DateTimeOffset.UtcNow;
        var count = 0;

        foreach (var module in MockSeedModules.Where(x => x != "kpis"))
        {
            if (!root.TryGetProperty(module, out var rows) || rows.ValueKind != JsonValueKind.Array) continue;
            foreach (var row in rows.EnumerateArray())
            {
                var obj = JsonNode.Parse(row.GetRawText())!.AsObject();
                var id = ResolveId(module, obj);
                db.AdminRecordDocuments.Add(new AdminRecordDocumentEntity
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

        foreach (var singleton in MockSeedModules.Where(x => x == "kpis"))
        {
            if (!root.TryGetProperty(singleton, out var value)) continue;
            var obj = JsonNode.Parse(value.GetRawText())!.AsObject();
            db.AdminRecordDocuments.Add(new AdminRecordDocumentEntity
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

    private static bool ShouldSeedMockRecords() =>
        string.Equals(Environment.GetEnvironmentVariable("SEED_ADMIN_MOCK_RECORDS"), "true", StringComparison.OrdinalIgnoreCase);

    private async Task RemoveMockSeedRecordsAsync(AdminDbContext db, CancellationToken ct)
    {
        var query = db.AdminRecordDocuments.Where(x => MockSeedModules.Contains(x.Module));
        var deleted = await RemoveRowsAsync(query, db, ct);
        if (deleted == 0) return;

        logger.LogInformation("Removed {Count} seeded admin mock records", deleted);
    }

    private static async Task<int> RemoveRowsAsync(
        IQueryable<AdminRecordDocumentEntity> query,
        AdminDbContext db,
        CancellationToken ct)
    {
        try
        {
            return await query.ExecuteDeleteAsync(ct);
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("ExecuteDelete", StringComparison.Ordinal))
        {
            var rows = await query.ToListAsync(ct);
            db.AdminRecordDocuments.RemoveRange(rows);
            await db.SaveChangesAsync(ct);
            return rows.Count;
        }
    }

    private async Task RemoveLegacyAuditRecordsAsync(AdminDbContext db, CancellationToken ct)
    {
        var rows = await db.AdminRecords.Where(x => x.Module == "audit").ToListAsync(ct);
        if (rows.Count > 0)
        {
            db.AdminRecords.RemoveRange(rows);
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Removed {Count} legacy seeded audit records; /api/audit now reads durable audit_entries only", rows.Count);
        }

        var legacyRows = await db.AdminRecords.ToListAsync(ct);
        foreach (var row in legacyRows)
        {
            var exists = await db.AdminRecordDocuments.AnyAsync(x => x.Module == row.Module && x.Id == row.Id, ct);
            if (exists) continue;
            db.AdminRecordDocuments.Add(new AdminRecordDocumentEntity
            {
                Module = row.Module,
                Id = row.Id,
                PayloadJson = row.PayloadJson,
                CreatedAt = row.CreatedAt,
                UpdatedAt = row.UpdatedAt
            });
        }
        db.AdminRecords.RemoveRange(legacyRows);
        if (legacyRows.Count > 0) await db.SaveChangesAsync(ct);
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
