using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.Lookups;
using PACademy.Admin.Api.Persistence;

namespace PACademy.Admin.Api.Modules.Admissions;

public sealed class AdmissionsSeeder(IWebHostEnvironment environment, ILogger<AdmissionsSeeder> logger)
{
    public async Task SeedAsync(AdminDbContext db, CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        var cycleCount = 0;
        var categoryCount = 0;
        var ruleCount = 0;

        if (!await db.AdmissionCycles.AnyAsync(ct))
        {
            var path = Path.Combine(environment.ContentRootPath, "SeedData", "admissions.seed.json");
            await using var stream = File.OpenRead(path);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
            var root = doc.RootElement;

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

        await SeedApplicationSettingsAsync(db, now, ct);
    }

    private async Task SeedApplicationSettingsAsync(AdminDbContext db, DateTimeOffset now, CancellationToken ct)
    {
        await RemoveLegacyApplicationSettingsYearSeedsAsync(db, ct);

        if (await db.ApplicationSettingsCategoryConfigs.AnyAsync(ct)) return;

        var categoriesFromDb = await db.LookupRows
            .AsNoTracking()
            .Where(x => x.LookupKey == "applicant-categories")
            .ToListAsync(ct);
        var categoryOrder = new[] { "officers_general", "law_bachelor", "physical_education_bachelor", "specialized_officers" };
        var categories = categoryOrder
            .Select(code => categoriesFromDb.FirstOrDefault(x => x.Code == code))
            .OfType<LookupRowEntity>()
            .Concat(categoriesFromDb.Where(x => !categoryOrder.Contains(x.Code)).OrderBy(x => x.Code))
            .ToList();
        var configByCategory = new Dictionary<string, ApplicationSettingsCategoryConfigEntity>(StringComparer.Ordinal);
        var serial = 1;
        foreach (var category in categories)
        {
            var config = new ApplicationSettingsCategoryConfigEntity
            {
                Id = $"acc-{serial}",
                CategoryId = category.Code,
                IsActive = true,
                SortOrder = serial,
                CreatedAt = DateTimeOffset.Parse("2026-05-11T08:00:00.000Z"),
                UpdatedAt = DateTimeOffset.Parse("2026-05-11T08:00:00.000Z")
            };
            configByCategory[category.Code] = config;
            db.ApplicationSettingsCategoryConfigs.Add(config);
            serial++;
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Seeded application settings category shells only: {ConfigCount} configs", configByCategory.Count);
    }

    private async Task RemoveLegacyApplicationSettingsYearSeedsAsync(AdminDbContext db, CancellationToken ct)
    {
        var yearRows = await db.ApplicationSettingsGraduationYears.ToListAsync(ct);
        if (yearRows.Count == 0) return;

        var specs = await db.ApplicationSettingsCategorySpecializations
            .AsNoTracking()
            .ToDictionaryAsync(x => x.Id, ct);
        var configs = await db.ApplicationSettingsCategoryConfigs
            .AsNoTracking()
            .ToDictionaryAsync(x => x.Id, ct);
        var currentYear = DateTime.UtcNow.Year;
        var legacyRows = yearRows
            .Where(row =>
                specs.TryGetValue(row.CategorySpecializationId, out var spec) &&
                configs.TryGetValue(spec.ConfigId, out var config) &&
                LegacyApplicationSettingsSeed.IsSeedBlueprint(config.CategoryId, row, currentYear))
            .ToList();

        if (legacyRows.Count == 0) return;

        db.ApplicationSettingsGraduationYears.RemoveRange(legacyRows);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Removed {Count} legacy application-settings demo year rows", legacyRows.Count);
    }
}

file static class LegacyApplicationSettingsSeed
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);

    private sealed record Blueprint(
        int[] GraduationYears,
        string[] GenderTypes,
        string[] MaritalStatusCodes,
        int? AgeMin,
        int? MaxAge,
        string[] DivisionCodes,
        string[] SchoolCategoryCodes,
        string ApplicationStartDate,
        string ApplicationEndDate,
        string AgeReferenceDate,
        bool IsActive,
        decimal MinPercentage,
        string AcademicGradeId);

    public static bool IsSeedBlueprint(string categoryCode, ApplicationSettingsGraduationYearEntity row, int currentYear)
    {
        return BlueprintsFor(categoryCode, currentYear).Any(blueprint => Matches(blueprint, row));
    }

    private static IReadOnlyList<Blueprint> BlueprintsFor(string categoryCode, int currentYear)
    {
        Blueprint Basic(int year, string gender) => new(
            [year],
            [gender],
            ["MAR-01"],
            17,
            22,
            [],
            [],
            $"{year}-06-01",
            $"{year}-07-31",
            $"{year}-04-01",
            true,
            70,
            "AGR-03");

        return categoryCode switch
        {
            "officers_general" =>
            [
                Basic(currentYear - 1, "male") with { AgeMin = 17, MaxAge = 22, MinPercentage = 75, SchoolCategoryCodes = ["SCH-01", "SCH-03"] },
                Basic(currentYear, "male") with { AgeMin = 17, MaxAge = 22, MinPercentage = 80, SchoolCategoryCodes = ["SCH-01", "SCH-03", "SCH-05"] }
            ],
            "law_bachelor" =>
            [
                Basic(currentYear - 2, "male") with { AgeMin = 21, MaxAge = 28, AcademicGradeId = "AGR-02", MaritalStatusCodes = ["MAR-01", "MAR-02"] },
                Basic(currentYear - 1, "female") with { AgeMin = 21, MaxAge = 28, AcademicGradeId = "AGR-03", MaritalStatusCodes = ["MAR-01", "MAR-02"] }
            ],
            "physical_education_bachelor" =>
            [
                Basic(currentYear - 2, "female") with { AgeMin = 21, MaxAge = 26, AcademicGradeId = "AGR-03" },
                Basic(currentYear, "female") with { AgeMin = 21, MaxAge = 26, AcademicGradeId = "AGR-02" }
            ],
            "specialized_officers" =>
            [
                Basic(currentYear - 3, "male") with { AgeMin = 21, MaxAge = 28, AcademicGradeId = "AGR-02" },
                Basic(currentYear - 1, "male") with { AgeMin = 21, MaxAge = 28, AcademicGradeId = "AGR-03" },
                Basic(currentYear, "female") with { AgeMin = 21, MaxAge = 28, AcademicGradeId = "AGR-03", MaritalStatusCodes = ["MAR-01", "MAR-02"] }
            ],
            _ => []
        };
    }

    private static bool Matches(Blueprint blueprint, ApplicationSettingsGraduationYearEntity row)
    {
        return SameInts(IntArray(row.GraduationYearsJson), blueprint.GraduationYears) &&
            SameStrings(StringArray(row.GenderTypesJson), blueprint.GenderTypes) &&
            SameStrings(StringArray(row.MaritalStatusCodesJson), blueprint.MaritalStatusCodes) &&
            row.AgeMin == blueprint.AgeMin &&
            row.MaxAge == blueprint.MaxAge &&
            SameStrings(StringArray(row.DivisionCodesJson), blueprint.DivisionCodes) &&
            SameStrings(StringArray(row.SchoolCategoryCodesJson), blueprint.SchoolCategoryCodes) &&
            row.ApplicationStartDate == DateOnly.Parse(blueprint.ApplicationStartDate) &&
            row.ApplicationEndDate == DateOnly.Parse(blueprint.ApplicationEndDate) &&
            row.AgeReferenceDate == DateOnly.Parse(blueprint.AgeReferenceDate) &&
            row.IsActive == blueprint.IsActive &&
            (row.MinPercentage == blueprint.MinPercentage || row.AcademicGradeId == blueprint.AcademicGradeId);
    }

    private static IReadOnlyList<int> IntArray(string json) =>
        JsonSerializer.Deserialize<int[]>(json, Options) ?? [];

    private static IReadOnlyList<string> StringArray(string json) =>
        JsonSerializer.Deserialize<string[]>(json, Options) ?? [];

    private static bool SameInts(IReadOnlyList<int> left, IReadOnlyList<int> right) =>
        left.Count == right.Count && left.OrderBy(x => x).SequenceEqual(right.OrderBy(x => x));

    private static bool SameStrings(IReadOnlyList<string> left, IReadOnlyList<string> right) =>
        left.Count == right.Count && left.OrderBy(x => x, StringComparer.Ordinal).SequenceEqual(right.OrderBy(x => x, StringComparer.Ordinal));
}
