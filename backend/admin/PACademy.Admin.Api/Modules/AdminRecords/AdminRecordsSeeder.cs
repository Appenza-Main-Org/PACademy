using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.OperationalRecords;
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

        var store = new OperationalRecordStore(db);
        await RemoveMockSeedRecordsAsync(store, ct);
        // Seed writes route through OperationalRecordsService so normalized modules
        // (applicants, payments, committeeInstances, …) land in their typed tables
        // via the same MERGE the runtime uses; JSON modules fall through to the
        // operational store. NullAuditSink keeps seeding out of audit_entries.
        var records = new OperationalRecordsService(db, new HttpContextAccessor(), new PACademy.Shared.Audit.NullAuditSink());
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
                await records.UpsertAsync(module, id, obj, ct);
                count++;
            }
        }

        foreach (var singleton in MockSeedModules.Where(x => x == "kpis"))
        {
            if (!root.TryGetProperty(singleton, out var value)) continue;
            var obj = JsonNode.Parse(value.GetRawText())!.AsObject();
            await records.UpsertAsync(singleton, singleton, obj, ct);
            count++;
        }

        logger.LogInformation("Seeded {Count} admin JSON records", count);
    }

    private static bool ShouldSeedMockRecords() =>
        string.Equals(Environment.GetEnvironmentVariable("SEED_ADMIN_MOCK_RECORDS"), "true", StringComparison.OrdinalIgnoreCase);

    private async Task RemoveMockSeedRecordsAsync(OperationalRecordStore store, CancellationToken ct)
    {
        var deleted = 0;
        foreach (var module in MockSeedModules)
        {
            deleted += await store.DeleteModuleAsync(module, ct);
        }
        if (deleted == 0) return;

        logger.LogInformation("Removed {Count} seeded admin mock records", deleted);
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

        // Legacy admin_records rows re-home through the service so rows whose module
        // is now normalized (payments, committeeInstances, exam-results, …) land in
        // their typed tables rather than the dead JSON bucket.
        var records = new OperationalRecordsService(db, new HttpContextAccessor(), new PACademy.Shared.Audit.NullAuditSink());
        var legacyRows = await db.AdminRecords.ToListAsync(ct);
        foreach (var row in legacyRows)
        {
            var exists = await records.GetAsync(row.Module, row.Id, ct) is not null;
            if (exists) continue;
            var payload = AdminRecordJson.Parse(row.PayloadJson);
            payload["id"] ??= row.Id;
            await records.UpsertAsync(row.Module, row.Id, payload, ct);
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
