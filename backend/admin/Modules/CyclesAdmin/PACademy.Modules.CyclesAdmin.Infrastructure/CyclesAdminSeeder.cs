using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace PACademy.Modules.CyclesAdmin.Infrastructure;

public static class CyclesAdminSeeder
{
    public static void MigrateAndSeed(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CyclesAdminDbContext>();
        db.Database.Migrate();

        var seed = LoadSeed();
        SeedBucket(db, "cycles", seed["cycles"]!.AsArray());
        SeedBucket(db, "applicantCategoryConfigs", seed["applicantCategoryConfigs"]!.AsArray());
        SeedBucket(db, "applicantCategorySpecializations", seed["applicantCategorySpecializations"]!.AsArray());
        SeedBucket(db, "applicantSpecializationYears", seed["applicantSpecializationYears"]!.AsArray());
        SeedBucket(db, "examScheduleDays", seed["examScheduleDays"]!.AsArray());
        SeedBucket(db, "categoryCommittees", seed["categoryCommittees"]!.AsArray());
        SeedBucket(db, "committeeDayBindings", seed["committeeDayBindings"]!.AsArray());
        SeedBucket(db, "committeeInstances", seed["committeeInstances"]!.AsArray());
        SeedBucket(db, "declarations", seed["declarations"]!.AsArray());
        SeedBucket(db, "examDateConfigs", seed["examDateConfigs"]!.AsArray());

        if (!db.Items.Any(x => x.Bucket == "meta" && x.Id == "activeCycleId"))
        {
            var value = seed["activeCycleId"]?.GetValue<string>() ?? "CYC-2026-M";
            db.Items.Add(AdminJsonItem.Create("meta", "activeCycleId", JsonSerializer.Serialize(new { value }, JsonOptions), 0));
        }

        db.SaveChanges();
    }

    private static void SeedBucket(CyclesAdminDbContext db, string bucket, JsonArray rows)
    {
        var existingIds = db.Items
            .Where(x => x.Bucket == bucket)
            .Select(x => x.Id)
            .ToHashSet(StringComparer.Ordinal);

        var order = db.Items
            .Where(x => x.Bucket == bucket)
            .Select(x => (int?)x.SortOrder)
            .Max() ?? -1;
        foreach (var node in rows)
        {
            if (node is not JsonObject obj) continue;
            var id = obj["id"]?.GetValue<string>();
            if (string.IsNullOrWhiteSpace(id)) continue;
            if (existingIds.Contains(id)) continue;
            db.Items.Add(AdminJsonItem.Create(bucket, id, obj.ToJsonString(JsonOptions), ++order));
        }
    }

    private static JsonObject LoadSeed()
    {
        var baseDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location)
            ?? AppContext.BaseDirectory;
        var path = Path.Combine(baseDir, "SeedData", "cycles-admin.seed.json");
        if (!File.Exists(path))
        {
            path = Path.Combine(AppContext.BaseDirectory, "SeedData", "cycles-admin.seed.json");
        }

        return JsonNode.Parse(File.ReadAllText(path))?.AsObject()
            ?? throw new InvalidOperationException("Cycles admin seed file is empty.");
    }

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = false,
    };
}
