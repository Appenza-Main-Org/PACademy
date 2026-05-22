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
        var submissionTypes = await db.LookupRows
            .AsNoTracking()
            .Where(x => x.LookupKey == "submission-types")
            .ToListAsync(ct);

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

        var attachmentPlan = new Dictionary<string, string[]>(StringComparer.Ordinal)
        {
            ["officers_general"] = [ApplicationSettingsSeed.ImplicitDefaultSpecCode],
            ["law_bachelor"] = [ApplicationSettingsSeed.ImplicitDefaultSpecCode],
            ["physical_education_bachelor"] = [ApplicationSettingsSeed.ImplicitDefaultSpecCode],
            ["specialized_officers"] = ["SPC-01", "SPC-04", "SPC-12"]
        };

        var specs = new List<ApplicationSettingsCategorySpecializationEntity>();
        var specSerial = 1;
        foreach (var (categoryCode, plan) in attachmentPlan)
        {
            if (!configByCategory.TryGetValue(categoryCode, out var config)) continue;
            foreach (var specializationId in plan)
            {
                var spec = new ApplicationSettingsCategorySpecializationEntity
                {
                    Id = $"acs-{specSerial}",
                    ConfigId = config.Id,
                    SpecializationId = specializationId,
                    IsActive = true,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                specs.Add(spec);
                db.ApplicationSettingsCategorySpecializations.Add(spec);
                specSerial++;
            }
        }

        var yearSerial = 1;
        foreach (var spec in specs)
        {
            var config = configByCategory.Values.First(x => x.Id == spec.ConfigId);
            var mode = ResolveGradingMode(config.CategoryId, categories, submissionTypes) ?? "GRADES";
            foreach (var blueprint in ApplicationSettingsSeed.BlueprintsFor(config.CategoryId, DateTime.UtcNow.Year))
            {
                db.ApplicationSettingsGraduationYears.Add(ApplicationSettingsSeed.ToEntity($"asy-{yearSerial}", spec.Id, mode, blueprint, now));
                yearSerial++;
            }
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Seeded application settings data: {ConfigCount} configs, {SpecCount} specializations, {YearCount} year rows", configByCategory.Count, specs.Count, yearSerial - 1);
    }

    private static string? ResolveGradingMode(string categoryCode, IReadOnlyList<LookupRowEntity> categories, IReadOnlyList<LookupRowEntity> submissionTypes)
    {
        var category = JsonNode.Parse(categories.First(x => x.Code == categoryCode).PayloadJson)?.AsObject();
        var metadata = category?["metadata"] as JsonObject;
        var submissionTypeCode = metadata is not null && metadata.TryGetPropertyValue("submissionTypeCode", out var st) ? st?.GetValue<string>() : null;
        if (submissionTypeCode is null) return null;
        var submissionType = submissionTypes.FirstOrDefault(x => x.Code == submissionTypeCode);
        var submissionTypeJson = submissionType is null ? null : JsonNode.Parse(submissionType.PayloadJson)?.AsObject();
        var submissionMetadata = submissionTypeJson?["metadata"] as JsonObject;
        return submissionMetadata is not null && submissionMetadata.TryGetPropertyValue("gradingMode", out var mode) ? mode?.GetValue<string>() : null;
    }
}

file static class ApplicationSettingsSeed
{
    public const string ImplicitDefaultSpecCode = "__default__";
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);

    public sealed record Blueprint(
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

    public static IReadOnlyList<Blueprint> BlueprintsFor(string categoryCode, int currentYear)
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

    public static ApplicationSettingsGraduationYearEntity ToEntity(string id, string specId, string gradeKind, Blueprint blueprint, DateTimeOffset now)
    {
        return new ApplicationSettingsGraduationYearEntity
        {
            Id = id,
            CategorySpecializationId = specId,
            GraduationYearsJson = JsonSerializer.Serialize(blueprint.GraduationYears, Options),
            GenderTypesJson = JsonSerializer.Serialize(blueprint.GenderTypes, Options),
            MaritalStatusCodesJson = JsonSerializer.Serialize(blueprint.MaritalStatusCodes, Options),
            AgeMin = blueprint.AgeMin,
            MaxAge = blueprint.MaxAge,
            DivisionCodesJson = JsonSerializer.Serialize(blueprint.DivisionCodes, Options),
            SchoolCategoryCodesJson = JsonSerializer.Serialize(blueprint.SchoolCategoryCodes, Options),
            ApplicationStartDate = DateOnly.Parse(blueprint.ApplicationStartDate),
            ApplicationEndDate = DateOnly.Parse(blueprint.ApplicationEndDate),
            AgeReferenceDate = DateOnly.Parse(blueprint.AgeReferenceDate),
            IsActive = blueprint.IsActive,
            GradeKind = gradeKind,
            MinPercentage = gradeKind == "GRADES" ? blueprint.MinPercentage : null,
            AcademicGradeId = gradeKind == "TAGDIR" ? blueprint.AcademicGradeId : null,
            CreatedAt = now,
            UpdatedAt = now
        };
    }
}
