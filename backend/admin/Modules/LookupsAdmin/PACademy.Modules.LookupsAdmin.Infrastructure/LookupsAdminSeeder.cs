using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PACademy.Shared.Domain.Lookups;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace PACademy.Modules.LookupsAdmin.Infrastructure;

/// <summary>
/// One-shot startup seeder. Runs <see cref="DatabaseFacade.Migrate"/>
/// to bring the shared SQL Server DB up to schema, then inserts the
/// canonical 18-faculty list if the table is empty.
///
/// Mirrors the frontend mock data
/// (<c>frontend/src/features/lookups/mock/lookups.mock.ts</c> lines 169–188)
/// so the demo matches the existing UI screenshots.
/// </summary>
public static class LookupsAdminSeeder
{
    public static void MigrateAndSeed(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LookupsAdminDbContext>();

        db.Database.Migrate();

        if (!db.Faculties.Any())
        {
            foreach (var (code, name) in SeedFaculties)
            {
                db.Faculties.Add(Faculty.Create(code, name));
            }
            db.SaveChanges();
        }

        SeedGenericLookupItems(db);
    }

    private static void SeedGenericLookupItems(LookupsAdminDbContext db)
    {
        var seed = LoadSeed();
        var changed = false;

        foreach (var (lookupKey, rows) in seed)
        {
            if (db.LookupItems.Any(x => x.LookupKey == lookupKey)) continue;

            var order = 0;
            foreach (var row in rows)
            {
                var code = row["code"]?.GetValue<string>() ?? throw new InvalidOperationException($"Lookup {lookupKey} row missing code.");
                var name = row["name"]?.GetValue<string>() ?? throw new InvalidOperationException($"Lookup {lookupKey}/{code} row missing name.");
                var isActive = row["isActive"]?.GetValue<bool>() ?? true;

                db.LookupItems.Add(LookupItem.Create(
                    lookupKey,
                    code,
                    name,
                    isActive,
                    row.ToJsonString(JsonOptions),
                    order++));
                changed = true;
            }
        }

        if (changed)
        {
            db.SaveChanges();
        }
    }

    private static Dictionary<string, List<JsonObject>> LoadSeed()
    {
        var baseDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location)
            ?? AppContext.BaseDirectory;
        var path = Path.Combine(baseDir, "SeedData", "lookups.seed.json");
        if (!File.Exists(path))
        {
            path = Path.Combine(AppContext.BaseDirectory, "SeedData", "lookups.seed.json");
        }

        var json = File.ReadAllText(path);
        return JsonSerializer.Deserialize<Dictionary<string, List<JsonObject>>>(json, JsonOptions)
            ?? throw new InvalidOperationException("Lookup seed file is empty.");
    }

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = false,
    };

    private static readonly (string Code, string Name)[] SeedFaculties =
    [
        ("FAC-01", "الطب البشري"),
        ("FAC-02", "الصيدلة الإكلينيكية"),
        ("FAC-03", "الطب البيطري"),
        ("FAC-04", "التمريض"),
        ("FAC-05", "الهندسة"),
        ("FAC-06", "الحاسبات والمعلومات"),
        ("FAC-07", "التجارة"),
        ("FAC-08", "الزراعة"),
        ("FAC-09", "التربية الموسيقية"),
        ("FAC-10", "الفنون التطبيقية"),
        ("FAC-11", "الفنون الجميلة"),
        ("FAC-12", "العلوم"),
        ("FAC-13", "الاقتصاد والعلوم السياسية"),
        ("FAC-14", "الآداب"),
        ("FAC-15", "التربية"),
        ("FAC-16", "اللغات"),
        ("FAC-17", "الحقوق"),
        ("FAC-18", "التربية الرياضية"),
    ];
}
