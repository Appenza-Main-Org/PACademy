using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Modules.Admissions;
using PACademy.Admin.Api.Modules.Admissions.Eligibility;
using PACademy.Admin.Api.Modules.Lookups;
using PACademy.Admin.Api.Persistence;
using PACademy.Shared.Audit;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Tests;

public sealed class ApplicantEligibilityServiceTests
{
    [Fact]
    public async Task ValidApplicantWithExternalGradesPasses()
    {
        await using var db = CreateDb();
        await SeedBaseAsync(db, gradeSource: "استيراد خارجي");
        var service = CreateService(db);

        var response = await service.GetEligibleCategoriesAsync("30001010123457", CancellationToken.None, includeIneligible: true);

        var category = Assert.Single(response.Categories);
        Assert.True(category.Eligible);
        Assert.True(category.Checks.GradesCheck.Passed);
        Assert.Equal(new DateOnly(2026, 1, 1), category.ApplicationStartDate);
        Assert.Equal(new DateOnly(2026, 12, 31), category.ApplicationEndDate);
        Assert.Equal(new DateOnly(2026, 1, 1), category.AgeReferenceDate);
        Assert.Equal(30, category.MaxAge);
        Assert.Contains(category.Committees, x => x.CommitteeId == "CMT-1");
        Assert.Equal("cycle-2026", response.CycleId);
    }

    [Fact]
    public async Task EligibleCommitteeIncludesConfiguredExamDatesForActiveCycle()
    {
        await using var db = CreateDb();
        await SeedBaseAsync(db, gradeSource: "استيراد خارجي");
        db.AdminRecords.AddRange(
            CommitteeInstance("ci-1", "cycle-2026", "CAT-GEN", "CMT-1", "2026-06-10", capacity: 120, reserved: 7),
            CommitteeInstance("ci-2", "cycle-2026", "CAT-GEN", "CMT-1", "2026-06-12", capacity: 80, reserved: 3),
            CommitteeInstance("ci-other-cycle", "cycle-2025", "CAT-GEN", "CMT-1", "2025-06-10", capacity: 40, reserved: 0),
            CommitteeInstance("ci-other-committee", "cycle-2026", "CAT-GEN", "CMT-2", "2026-06-20", capacity: 50, reserved: 0));
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        var service = CreateService(db);

        var response = await service.GetEligibleCategoriesAsync("30001010123457", CancellationToken.None);

        var json = JsonSerializer.Serialize(response, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        var root = JsonNode.Parse(json)!.AsObject();
        var committee = root["categories"]![0]!["committees"]![0]!.AsObject();
        var dates = committee["examDates"]!.AsArray();
        Assert.Equal(["2026-06-10", "2026-06-12"], dates.Select(x => x!.GetValue<string>()).ToArray());
        Assert.Equal(120, committee["examSlots"]![0]!["capacity"]!.GetValue<int>());
        Assert.Equal(7, committee["examSlots"]![0]!["reserved"]!.GetValue<int>());
    }

    [Fact]
    public async Task SameApplicantWithInternalSourceFailsGradesCheck()
    {
        await using var db = CreateDb();
        await SeedBaseAsync(db, gradeSource: "إدخال داخلي", schoolCategoryCode: "SCH-INT");
        var service = CreateService(db);

        var response = await service.GetEligibleCategoriesAsync("30001010123457", CancellationToken.None, includeIneligible: true);

        var category = Assert.Single(response.Categories);
        Assert.False(category.Eligible);
        Assert.False(category.Checks.GradesCheck.Passed);
        Assert.Contains(category.FailedReasons, x => x.Contains("مصدر الدرجات", StringComparison.Ordinal));
    }

    [Fact]
    public async Task DefaultResponseReturnsEligibleCategoriesOnly()
    {
        await using var db = CreateDb();
        await SeedBaseAsync(db, gradeSource: "إدخال داخلي", schoolCategoryCode: "SCH-INT");
        var service = CreateService(db);

        var response = await service.GetEligibleCategoriesAsync("30001010123457", CancellationToken.None);

        Assert.Empty(response.Categories);
    }

    [Fact]
    public async Task UnderAgeApplicantFailsAgeCheck()
    {
        await using var db = CreateDb();
        await SeedBaseAsync(db, categoryMinAge: 18);
        var service = CreateService(db);

        var response = await service.GetEligibleCategoriesAsync("31001010123457", CancellationToken.None, includeIneligible: true);

        Assert.False(Assert.Single(response.Categories).Checks.AgeCheck.Passed);
    }

    [Fact]
    public async Task CategoryLookupMinAgeIsUsedWhenCycleRuleDoesNotOverrideIt()
    {
        await using var db = CreateDb();
        await SeedBaseAsync(db, categoryMinAge: 27);
        var service = CreateService(db);

        var response = await service.GetEligibleCategoriesAsync("30001010123457", CancellationToken.None, includeIneligible: true);

        Assert.False(Assert.Single(response.Categories).Checks.AgeCheck.Passed);
    }

    [Fact]
    public async Task WrongGenderApplicantFailsGenderCheck()
    {
        await using var db = CreateDb();
        await SeedBaseAsync(db, genders: ["ذكر"]);
        var service = CreateService(db);

        var response = await service.GetEligibleCategoriesAsync("30001010123467", CancellationToken.None, includeIneligible: true);

        var category = Assert.Single(response.Categories);
        Assert.False(category.Eligible);
        Assert.False(category.Checks.GenderCheck.Passed);
    }

    [Fact]
    public async Task LookupSourceMismatchFailsEvenWhenCertificateTypeMatches()
    {
        await using var db = CreateDb();
        await SeedBaseAsync(db, gradeSource: "إدخال داخلي", schoolCategoryCode: "SCH-INT", requiredCodes: ["SCH-INT"]);
        var service = CreateService(db);

        var response = await service.GetEligibleCategoriesAsync("30001010123457", CancellationToken.None, includeIneligible: true);

        var grades = Assert.Single(response.Categories).Checks.GradesCheck;
        Assert.False(grades.Passed);
        Assert.Empty(grades.MatchedLookup);
    }

    [Fact]
    public async Task DynamicConfigChangesFlipEligibilityBetweenRequests()
    {
        await using var db = CreateDb();
        await SeedBaseAsync(db, maxAge: 30, genders: ["ذكر"]);
        var service = CreateService(db);

        var first = await service.GetEligibleCategoriesAsync("30001010123457", CancellationToken.None);
        Assert.True(Assert.Single(first.Categories).Eligible);

        var ct = TestContext.Current.CancellationToken;
        var row = await db.ApplicationSettingsGraduationYears.SingleAsync(ct);
        row.MaxAge = 20;
        row.GenderTypesJson = JsonSerializer.Serialize(new[] { "أنثى" });
        await db.SaveChangesAsync(ct);

        var second = await service.GetEligibleCategoriesAsync("30001010123457", CancellationToken.None, includeIneligible: true);
        var category = Assert.Single(second.Categories);
        Assert.False(category.Eligible);
        Assert.False(category.Checks.AgeCheck.Passed);
        Assert.False(category.Checks.GenderCheck.Passed);
    }

    [Fact]
    public async Task ThrowsNotFoundWhenNoActiveCycleExists()
    {
        await using var db = CreateDb();
        var service = CreateService(db);

        await Assert.ThrowsAsync<EntityNotFoundException>(
            () => service.GetEligibleCategoriesAsync("30001010123457", CancellationToken.None));
    }

    private static AdminDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AdminDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new AdminDbContext(options);
    }

    private static ApplicantEligibilityService CreateService(AdminDbContext db)
    {
        return new ApplicantEligibilityService(db, new AdminRecordsService(db, new HttpContextAccessor(), new NullAuditSink()));
    }

    private static async Task SeedBaseAsync(
        AdminDbContext db,
        string gradeSource = "استيراد خارجي",
        string schoolCategoryCode = "SCH-EXT",
        IReadOnlyList<string>? requiredCodes = null,
        IReadOnlyList<string>? genders = null,
        int maxAge = 30,
        int? ageMin = null,
        int categoryMinAge = 17)
    {
        var now = DateTimeOffset.UtcNow;
        db.AdmissionCycles.Add(new AdmissionCycleEntity
        {
            Id = "cycle-2026",
            NameAr = "دورة 2026",
            Year = 2026,
            Status = "active",
            IsActive = true,
            PayloadJson = "{}",
            CreatedAt = now,
            UpdatedAt = now
        });
        db.ApplicationSettingsCategoryConfigs.Add(new ApplicationSettingsCategoryConfigEntity
        {
            Id = "acc-1",
            CategoryId = "CAT-GEN",
            IsActive = true,
            SortOrder = 1,
            CreatedAt = now,
            UpdatedAt = now
        });
        db.ApplicationSettingsCategorySpecializations.Add(new ApplicationSettingsCategorySpecializationEntity
        {
            Id = "acs-1",
            ConfigId = "acc-1",
            SpecializationId = "__default__",
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        });
        db.ApplicationSettingsGraduationYears.Add(new ApplicationSettingsGraduationYearEntity
        {
            Id = "asy-1",
            CategorySpecializationId = "acs-1",
            GraduationYearsJson = "[2026]",
            GenderTypesJson = JsonSerializer.Serialize(genders ?? ["ذكر"]),
            MaritalStatusCodesJson = "[]",
            AgeMin = ageMin,
            MaxAge = maxAge,
            DivisionCodesJson = "[]",
            SchoolCategoryCodesJson = JsonSerializer.Serialize(requiredCodes ?? ["SCH-EXT"]),
            ApplicationStartDate = new DateOnly(2026, 1, 1),
            ApplicationEndDate = new DateOnly(2026, 12, 31),
            AgeReferenceDate = new DateOnly(2026, 1, 1),
            IsActive = true,
            GradeKind = "GRADES",
            MinPercentage = 50,
            AcademicGradeId = null,
            CreatedAt = now,
            UpdatedAt = now
        });
        db.LookupRows.AddRange(
            Lookup("applicant-categories", "CAT-GEN", "قسم الضباط (قسم عام)", new JsonObject
            {
                ["minAge"] = categoryMinAge,
                ["requiredStage"] = "general",
                ["metadata"] = new JsonObject { ["requiredGradesSource"] = "استيراد خارجي" }
            }),
            Lookup("school-categories", "SCH-EXT", "ثانوية عامة", new JsonObject
            {
                ["certificateType"] = "ثانوية عامة",
                ["gradesSource"] = "استيراد خارجي"
            }),
            Lookup("school-categories", "SCH-INT", "ثانوية عامة", new JsonObject
            {
                ["certificateType"] = "ثانوية عامة",
                ["gradesSource"] = "إدخال داخلي"
            }),
            Lookup("committees", "CMT-1", "اللجنة الأولى قسم عام", new JsonObject
            {
                ["applicantCategoryId"] = "CAT-GEN"
            }));
        db.AdminRecords.Add(new AdminRecordEntity
        {
            Module = "grades",
            Id = "1",
            PayloadJson = new JsonObject
            {
                ["id"] = "1",
                ["nid"] = "30001010123457",
                ["schoolCategoryCode"] = schoolCategoryCode,
                ["schoolCategoryName"] = "ثانوية عامة",
                ["certificateType"] = "ثانوية عامة",
                ["graduationYear"] = 2026,
                ["total"] = 80,
                ["max"] = 100,
                ["kind"] = "general",
                ["gradesSource"] = gradeSource
            }.ToJsonString(),
            CreatedAt = now,
            UpdatedAt = now
        });
        await db.SaveChangesAsync();
    }

    private static LookupRowEntity Lookup(string key, string code, string name, JsonObject payload)
    {
        payload["code"] = code;
        payload["name"] = name;
        return new LookupRowEntity
        {
            LookupKey = key,
            Code = code,
            Name = name,
            IsActive = true,
            PayloadJson = payload.ToJsonString(),
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
    }

    private static AdminRecordEntity CommitteeInstance(
        string id,
        string cycleId,
        string categoryKey,
        string definitionCode,
        string date,
        int capacity,
        int reserved)
    {
        var now = DateTimeOffset.UtcNow;
        return new AdminRecordEntity
        {
            Module = "committeeInstances",
            Id = id,
            PayloadJson = new JsonObject
            {
                ["id"] = id,
                ["cycleId"] = cycleId,
                ["categoryKey"] = categoryKey,
                ["definitionCode"] = definitionCode,
                ["date"] = date,
                ["capacity"] = capacity,
                ["reserved"] = reserved,
                ["reservedRefreshedAt"] = now.ToString("O")
            }.ToJsonString(),
            CreatedAt = now,
            UpdatedAt = now
        };
    }
}
