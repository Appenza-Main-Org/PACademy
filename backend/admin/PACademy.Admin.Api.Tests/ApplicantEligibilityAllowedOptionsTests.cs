using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Modules.Admissions;
using PACademy.Admin.Api.Modules.Admissions.Eligibility;
using PACademy.Admin.Api.Modules.OperationalRecords;
using PACademy.Admin.Api.Modules.Lookups;
using PACademy.Admin.Api.Persistence;
using PACademy.Shared.Audit;

namespace PACademy.Admin.Api.Tests;

public sealed class ApplicantEligibilityAllowedOptionsTests
{
    [Fact]
    public async Task EligibleCategoryReturnsAllowedMaritalStatusesAndAcademicDegreesFromDraftRules()
    {
        await using var db = CreateDb();
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
            Id = "acc-specialized",
            CategoryId = "specialized_officers",
            IsActive = true,
            SortOrder = 1,
            CreatedAt = now,
            UpdatedAt = now
        });
        db.ApplicationSettingsCategorySpecializations.Add(new ApplicationSettingsCategorySpecializationEntity
        {
            Id = "acs-specialized",
            ConfigId = "acc-specialized",
            SpecializationId = "SPC-01",
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        });
        db.LookupRows.AddRange(
            Lookup("applicant-categories", "specialized_officers", "الضباط المتخصصون", new JsonObject
            {
                ["minAge"] = 17,
                ["type"] = "university",
                ["genderScope"] = new JsonArray("male", "female")
            }),
            Lookup("academic-grades", "AGR-01", "امتياز", new JsonObject()),
            Lookup("academic-grades", "AGR-02", "جيد جداً", new JsonObject()),
            Lookup("academic-grades", "AGR-03", "جيد", new JsonObject()),
            Lookup("academic-grades", "AGR-04", "مقبول", new JsonObject()));
        await new OperationalRecordStore(db).UpsertAsync(
            "admissionSetup.applicationSettings.cycle-2026",
            "admissionSetup.applicationSettings.cycle-2026",
            new JsonObject
            {
                ["id"] = "admissionSetup.applicationSettings.cycle-2026",
                ["cycleId"] = "cycle-2026",
                ["approved"] = new JsonArray(new JsonObject
                {
                    ["id"] = "specialized-rule",
                    ["categoryCode"] = "specialized_officers",
                    ["header"] = new JsonObject
                    {
                        ["applicationStart"] = "2026-06-01",
                        ["applicationEnd"] = "2026-06-30",
                        ["ageReferenceDate"] = "2026-06-01",
                        ["maxAge"] = 30,
                        ["maritalStatus"] = new JsonArray("MAR-01")
                    },
                    ["facultyCode"] = "FAC-01",
                    ["facultyNameAr"] = "الطب البشري",
                    ["specializationCode"] = "SPC-01",
                    ["specializationNameAr"] = "جراحة عامة",
                    ["type"] = new JsonArray("male"),
                    ["academicDegrees"] = new JsonArray("DEG-02", "DEG-03"),
                    ["grade"] = "AGR-03",
                    ["gradeMax"] = "AGR-01",
                    ["graduationYears"] = new JsonArray(2026)
                }),
                ["local"] = new JsonArray()
            },
            TestContext.Current.CancellationToken);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        var service = new ApplicantEligibilityService(
            db,
            new OperationalRecordsService(db, new HttpContextAccessor(), new NullAuditSink()));

        var response = await service.GetEligibleCategoriesAsync("30001010123457", CancellationToken.None);

        var category = Assert.Single(response.Categories);
        Assert.Equal(["MAR-01"], category.AllowedMaritalStatusCodes);
        Assert.Equal(["DEG-02", "DEG-03"], category.AllowedAcademicDegreeCodes);
        Assert.Equal(["AGR-01", "AGR-02", "AGR-03"], category.AllowedAcademicGradeCodes);
        Assert.Equal([2026], category.AllowedGraduationYears);
    }

    private static AdminDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AdminDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new AdminDbContext(options);
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
}
