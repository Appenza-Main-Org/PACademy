using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;

namespace PACademy.Admin.Api.Modules.Admissions;

public sealed class AdmissionsSeeder(IWebHostEnvironment environment, ILogger<AdmissionsSeeder> logger)
{
    public async Task SeedAsync(IAdmissionsDbContext db, CancellationToken ct = default)
    {
        if (await db.AdmissionCycles.AnyAsync(ct)) return;

        var path = Path.Combine(environment.ContentRootPath, "SeedData", "admissions.seed.json");
        await using var stream = File.OpenRead(path);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        var root = doc.RootElement;
        var now = DateTimeOffset.UtcNow;
        var cycleCount = 0;
        var categoryCount = 0;
        var ruleCount = 0;

        foreach (var cycle in root.GetProperty("cycles").EnumerateArray())
        {
            var obj = JsonNode.Parse(cycle.GetRawText())!.AsObject();
            db.AdmissionCycles.Add(new AdmissionCycleEntity
            {
                Id = AdmissionJson.StringProp(obj, "id")!,
                NameAr = AdmissionJson.StringProp(obj, "nameAr")!,
                Year = AdmissionJson.IntProp(obj, "year") ?? 0,
                Status = AdmissionJson.StringProp(obj, "status") ?? "draft",
                IsActive = AdmissionJson.BoolProp(obj, "isActive") ?? false,
                PayloadJson = obj.ToJsonString(AdmissionJson.Options),
                CreatedAt = now,
                UpdatedAt = now
            });
            cycleCount++;
        }

        foreach (var category in root.GetProperty("categories").EnumerateArray())
        {
            var obj = JsonNode.Parse(category.GetRawText())!.AsObject();
            db.ApplicantCategories.Add(new ApplicantCategoryEntity
            {
                Key = AdmissionJson.StringProp(obj, "key")!,
                LabelAr = AdmissionJson.StringProp(obj, "labelAr")!,
                IsOpen = AdmissionJson.BoolProp(obj, "isOpen") ?? true,
                PayloadJson = obj.ToJsonString(AdmissionJson.Options),
                CreatedAt = now,
                UpdatedAt = now
            });
            categoryCount++;
        }

        foreach (var rule in root.GetProperty("admissionRules").EnumerateArray())
        {
            var obj = JsonNode.Parse(rule.GetRawText())!.AsObject();
            db.AdmissionRules.Add(new AdmissionRuleEntity
            {
                Id = AdmissionJson.StringProp(obj, "id")!,
                CycleId = AdmissionJson.StringProp(obj, "cycleId")!,
                Version = AdmissionJson.IntProp(obj, "version") ?? 1,
                PayloadJson = obj.ToJsonString(AdmissionJson.Options),
                CreatedAt = now,
                UpdatedAt = now
            });
            ruleCount++;
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Seeded admissions data: {CycleCount} cycles, {CategoryCount} categories, {RuleCount} rules", cycleCount, categoryCount, ruleCount);
    }
}
