using System.Text.Json;
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
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Tests;

public sealed class ApplicantEligibilityServiceTests
{
    [Fact]
    public void SqlServerGradeLookupHandlesLegacySchemaWithoutPayloadJson()
    {
        var source = File.ReadAllText(FindRepoFile(
            "backend/admin/PACademy.Admin.Api/Modules/Admissions/Eligibility/ApplicantEligibilityService.cs"));

        Assert.Contains("SqlInvalidColumnName", source);
        Assert.Contains("LoadGradeFromLegacyApplicantGradesAsync", source);
        Assert.Contains("LoadCompatibilityDocumentPayloadAsync", source);
    }

    [Fact]
    public void AdminRecordsRuntimeUsesOperationalStoreInsteadOfDocumentStore()
    {
        var source = File.ReadAllText(FindRepoFile(
            "backend/admin/PACademy.Admin.Api/Modules/AdminRecords/OperationalRecordsService.cs"));

        Assert.Contains("OperationalRecordStore", source);
        Assert.DoesNotContain("DocumentsDb.AdminRecordDocuments", source);
        Assert.DoesNotContain("IsMissingDocumentStore", source);
    }

    [Fact]
    public async Task ValidApplicantWithExternalGradesPasses()
    {
        await using var db = CreateDb();
        await SeedBaseAsync(db, gradeSource: "استيراد خارجي");
        var service = CreateService(db);

        var response = await service.GetEligibleCategoriesAsync("30001010123457", CancellationToken.None, includeIneligible: true);

        var category = Assert.Single(response.Categories);
        Assert.True(category.Eligible);
        Assert.NotNull(response.Grade);
        Assert.Equal("30001010123457", EligibilityJson.StringProp(response.Grade, "nid"));
        Assert.True(category.Checks.GradesCheck.Passed);
        Assert.Equal(new DateOnly(2026, 1, 1), category.ApplicationStartDate);
        Assert.Equal(new DateOnly(2026, 12, 31), category.ApplicationEndDate);
        Assert.Equal(new DateOnly(2026, 1, 1), category.AgeReferenceDate);
        Assert.Equal(30, category.MaxAge);
        Assert.Contains(category.Committees, x => x.CommitteeId == "CMT-1");
        Assert.Equal("cycle-2026", response.CycleId);
    }

    [Fact]
    public async Task ImportedGradeWithoutSourceStillReturnsGradeAndExternalSource()
    {
        await using var db = CreateDb();
        await SeedBaseAsync(db, gradeSource: null, lookupGradesSource: null);
        var service = CreateService(db);

        var response = await service.GetEligibleCategoriesAsync("30001010123457", CancellationToken.None, includeIneligible: true);

        var category = Assert.Single(response.Categories);
        Assert.NotNull(response.Grade);
        Assert.True(category.Checks.GradesCheck.HasGrade);
        Assert.Equal("استيراد خارجي", EligibilityJson.StringProp(response.Grade, "gradesSource"));
        Assert.Equal("استيراد خارجي", category.Checks.GradesCheck.Source);
    }

    [Fact]
    public async Task UniversityCategoriesUseNationalIdAgeAndGenderWithoutGradeGate()
    {
        await using var db = CreateDb();
        await SeedBaseAsync(db, schoolCategoryCode: "SCH-EXT");
        var now = DateTimeOffset.UtcNow;
        db.ApplicationSettingsCategoryConfigs.Add(new ApplicationSettingsCategoryConfigEntity
        {
            Id = "acc-law",
            CategoryId = "law_bachelor",
            IsActive = true,
            SortOrder = 2,
            CreatedAt = now,
            UpdatedAt = now
        });
        db.ApplicationSettingsCategorySpecializations.Add(new ApplicationSettingsCategorySpecializationEntity
        {
            Id = "acs-law",
            ConfigId = "acc-law",
            SpecializationId = "SPC-70",
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        });
        db.LookupRows.AddRange(
            Lookup("applicant-categories", "law_bachelor", "ليسانس حقوق", new JsonObject
            {
                ["minAge"] = 17,
                ["type"] = "university",
                ["genderScope"] = new JsonArray("male", "female")
            }),
            Lookup("committees", "CMT-LAW-M", "لجنة ليسانس حقوق طلبة", new JsonObject
            {
                ["applicantCategoryId"] = "law_bachelor"
            }),
            Lookup("committees", "CMT-LAW-F", "لجنة ليسانس حقوق طالبات", new JsonObject
            {
                ["applicantCategoryId"] = "law_bachelor"
            }));
        await new OperationalRecordStore(db).UpsertAsync(
            "admissionSetup.applicationSettings.cycle-2026",
            "admissionSetup.applicationSettings.cycle-2026",
            new JsonObject
            {
                ["id"] = "admissionSetup.applicationSettings.cycle-2026",
                ["cycleId"] = "cycle-2026",
                ["approved"] = new JsonArray(
                    new JsonObject
                    {
                        ["id"] = "law-draft-male",
                        ["categoryCode"] = "law_bachelor",
                        ["header"] = new JsonObject
                        {
                            ["applicationStart"] = "2026-06-01",
                            ["applicationEnd"] = "2026-06-30",
                            ["ageReferenceDate"] = "2026-06-01",
                            ["maxAge"] = 30
                        },
                        ["facultyCode"] = "FAC-17",
                        ["specializationCode"] = "SPC-70",
                        ["type"] = new JsonArray("male"),
                        ["grade"] = "AGR-03",
                        ["committees"] = new JsonArray("CMT-LAW-M"),
                        ["graduationYears"] = new JsonArray(2026)
                    },
                    new JsonObject
                    {
                        ["id"] = "law-draft-female",
                        ["categoryCode"] = "law_bachelor",
                        ["header"] = new JsonObject
                        {
                            ["applicationStart"] = "2026-06-01",
                            ["applicationEnd"] = "2026-06-30",
                            ["ageReferenceDate"] = "2026-06-01",
                            ["maxAge"] = 30
                        },
                        ["facultyCode"] = "FAC-17",
                        ["specializationCode"] = "SPC-70",
                        ["type"] = new JsonArray("female"),
                        ["grade"] = "AGR-03",
                        ["committees"] = new JsonArray("CMT-LAW-F"),
                        ["graduationYears"] = new JsonArray(2026)
                    }),
                ["local"] = new JsonArray()
            },
            TestContext.Current.CancellationToken);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        var service = CreateService(db);

        var response = await service.GetEligibleCategoriesAsync("30001010123457", CancellationToken.None);

        var law = Assert.Single(response.Categories, x => x.CategoryId == "law_bachelor");
        Assert.True(law.Eligible);
        Assert.True(law.Checks.GradesCheck.Passed);
        Assert.Contains(law.Committees, x => x.CommitteeId == "CMT-LAW-M");
        Assert.DoesNotContain(law.Committees, x => x.CommitteeId == "CMT-LAW-F");
        Assert.Empty(law.FailedReasons);
    }

    [Fact]
    public async Task SpecializedOfficersReturnsEveryAcademicProgramMatchingApplicantRules()
    {
        await using var db = CreateDb();
        await SeedBaseAsync(db, schoolCategoryCode: "SCH-EXT");
        var now = DateTimeOffset.UtcNow;
        db.ApplicationSettingsCategoryConfigs.Add(new ApplicationSettingsCategoryConfigEntity
        {
            Id = "acc-specialized",
            CategoryId = "specialized_officers",
            IsActive = true,
            SortOrder = 2,
            CreatedAt = now,
            UpdatedAt = now
        });
        db.ApplicationSettingsCategorySpecializations.AddRange(
            new ApplicationSettingsCategorySpecializationEntity
            {
                Id = "acs-specialized-general-surgery",
                ConfigId = "acc-specialized",
                SpecializationId = "SPC-01",
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now
            },
            new ApplicationSettingsCategorySpecializationEntity
            {
                Id = "acs-specialized-neuro-surgery",
                ConfigId = "acc-specialized",
                SpecializationId = "SPC-02",
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now
            });
        db.LookupRows.Add(Lookup("applicant-categories", "specialized_officers", "الضباط المتخصصون", new JsonObject
        {
            ["minAge"] = 17,
            ["type"] = "university",
            ["genderScope"] = new JsonArray("male", "female")
        }));
        await new OperationalRecordStore(db).UpsertAsync(
            "admissionSetup.applicationSettings.cycle-2026",
            "admissionSetup.applicationSettings.cycle-2026",
            new JsonObject
            {
                ["id"] = "admissionSetup.applicationSettings.cycle-2026",
                ["cycleId"] = "cycle-2026",
                ["approved"] = new JsonArray(
                    new JsonObject
                    {
                        ["id"] = "specialized-general-surgery",
                        ["categoryCode"] = "specialized_officers",
                        ["header"] = new JsonObject
                        {
                            ["applicationStart"] = "2026-06-01",
                            ["applicationEnd"] = "2026-06-30",
                            ["ageReferenceDate"] = "2026-06-01",
                            ["maxAge"] = 30
                        },
                        ["facultyCode"] = "FAC-01",
                        ["facultyNameAr"] = "الطب البشري",
                        ["specializationCode"] = "SPC-01",
                        ["specializationNameAr"] = "جراحة عامة",
                        ["type"] = new JsonArray("male"),
                        ["graduationYears"] = new JsonArray(2026)
                    },
                    new JsonObject
                    {
                        ["id"] = "specialized-neuro-surgery",
                        ["categoryCode"] = "specialized_officers",
                        ["header"] = new JsonObject
                        {
                            ["applicationStart"] = "2026-06-01",
                            ["applicationEnd"] = "2026-06-30",
                            ["ageReferenceDate"] = "2026-06-01",
                            ["maxAge"] = 30
                        },
                        ["facultyCode"] = "FAC-01",
                        ["facultyNameAr"] = "الطب البشري",
                        ["specializationCode"] = "SPC-02",
                        ["specializationNameAr"] = "جراحة مخ وأعصاب",
                        ["type"] = new JsonArray("male"),
                        ["graduationYears"] = new JsonArray(2026)
                    }),
                ["local"] = new JsonArray()
            },
            TestContext.Current.CancellationToken);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        var service = CreateService(db);

        var response = await service.GetEligibleCategoriesAsync("30001010123457", CancellationToken.None);

        var specialized = Assert.Single(response.Categories, x => x.CategoryId == "specialized_officers");
        Assert.True(specialized.Eligible);
        Assert.Equal(
            ["SPC-01", "SPC-02"],
            specialized.AcademicPrograms.Select(x => x.SpecializationCode).ToArray());
    }

    [Fact]
    public async Task GradeResponseDoesNotExposeNestedPayload()
    {
        await using var db = CreateDb();
        await SeedBaseAsync(db, includeNestedGradePayload: true);
        var service = CreateService(db);

        var response = await service.GetEligibleCategoriesAsync("30001010123457", CancellationToken.None, includeIneligible: true);

        Assert.NotNull(response.Grade);
        Assert.False(response.Grade.ContainsKey("payload"));
        Assert.Equal("FAC-01", EligibilityJson.StringProp(response.Grade, "facultyCode"));
    }

    [Fact]
    public async Task EligibleCommitteeIncludesConfiguredExamDatesForActiveCycle()
    {
        await using var db = CreateDb();
        await SeedBaseAsync(db, gradeSource: "استيراد خارجي");
        var store = new OperationalRecordStore(db);
        await store.UpsertAsync("committeeInstances", "ci-1", CommitteeInstance("ci-1", "cycle-2026", "CAT-GEN", "CMT-1", "2026-06-10", capacity: 120, reserved: 7), TestContext.Current.CancellationToken);
        await store.UpsertAsync("committeeInstances", "ci-2", CommitteeInstance("ci-2", "cycle-2026", "CAT-GEN", "CMT-1", "2026-06-12", capacity: 80, reserved: 3), TestContext.Current.CancellationToken);
        await store.UpsertAsync("committeeInstances", "ci-other-cycle", CommitteeInstance("ci-other-cycle", "cycle-2025", "CAT-GEN", "CMT-1", "2025-06-10", capacity: 40, reserved: 0), TestContext.Current.CancellationToken);
        await store.UpsertAsync("committeeInstances", "ci-other-committee", CommitteeInstance("ci-other-committee", "cycle-2026", "CAT-GEN", "CMT-2", "2026-06-20", capacity: 50, reserved: 0), TestContext.Current.CancellationToken);
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
        return new ApplicantEligibilityService(db, new OperationalRecordsService(db, new HttpContextAccessor(), new NullAuditSink()));
    }

    private static string FindRepoFile(string relativePath)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            var candidate = Path.Combine(dir.FullName, relativePath);
            if (File.Exists(candidate)) return candidate;
            dir = dir.Parent;
        }

        throw new FileNotFoundException(relativePath);
    }

    private static async Task SeedBaseAsync(
        AdminDbContext db,
        string? gradeSource = "استيراد خارجي",
        string? lookupGradesSource = "استيراد خارجي",
        string schoolCategoryCode = "SCH-EXT",
        IReadOnlyList<string>? requiredCodes = null,
        IReadOnlyList<string>? genders = null,
        int maxAge = 30,
        int? ageMin = null,
        int categoryMinAge = 17,
        bool includeNestedGradePayload = false)
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
        var externalSchoolPayload = new JsonObject
        {
            ["certificateType"] = "ثانوية عامة",
            ["externalGradesImport"] = true
        };
        if (lookupGradesSource is not null)
        {
            externalSchoolPayload["gradesSource"] = lookupGradesSource;
        }

        db.LookupRows.AddRange(
            Lookup("applicant-categories", "CAT-GEN", "قسم الضباط (قسم عام)", new JsonObject
            {
                ["minAge"] = categoryMinAge,
                ["requiredStage"] = "general",
                ["metadata"] = new JsonObject { ["requiredGradesSource"] = "استيراد خارجي" }
            }),
            Lookup("school-categories", "SCH-EXT", "ثانوية عامة", externalSchoolPayload),
            Lookup("school-categories", "SCH-INT", "ثانوية عامة", new JsonObject
            {
                ["certificateType"] = "ثانوية عامة",
                ["gradesSource"] = "إدخال داخلي"
            }),
            Lookup("committees", "CMT-1", "اللجنة الأولى قسم عام", new JsonObject
            {
                ["applicantCategoryId"] = "CAT-GEN"
            }));
        var gradePayload = new JsonObject
        {
            ["id"] = "1",
            ["nid"] = "30001010123457",
            ["schoolCategoryCode"] = schoolCategoryCode,
            ["schoolCategoryName"] = "ثانوية عامة",
            ["certificateType"] = "ثانوية عامة",
            ["graduationYear"] = 2026,
            ["total"] = 80,
            ["max"] = 100,
            ["kind"] = "general"
        };
        if (gradeSource is not null)
        {
            gradePayload["gradesSource"] = gradeSource;
        }
        if (includeNestedGradePayload)
        {
            gradePayload["payload"] = new JsonObject
            {
                ["facultyCode"] = "FAC-01",
                ["specializationCode"] = "SPC-01"
            };
        }

        await db.SaveChangesAsync();
        await new OperationalRecordStore(db).UpsertAsync("grades", "1", gradePayload, CancellationToken.None);
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

    private static JsonObject CommitteeInstance(
        string id,
        string cycleId,
        string categoryKey,
        string definitionCode,
        string date,
        int capacity,
        int reserved)
    {
        var now = DateTimeOffset.UtcNow;
        return new JsonObject
        {
            ["id"] = id,
            ["cycleId"] = cycleId,
            ["categoryKey"] = categoryKey,
            ["definitionCode"] = definitionCode,
            ["date"] = date,
            ["capacity"] = capacity,
            ["reserved"] = reserved,
            ["reservedRefreshedAt"] = now.ToString("O")
        };
    }
}
