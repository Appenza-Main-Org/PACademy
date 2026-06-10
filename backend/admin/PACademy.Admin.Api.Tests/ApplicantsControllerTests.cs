using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Controllers;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Modules.Admissions;
using PACademy.Admin.Api.Modules.Admissions.Eligibility;
using PACademy.Admin.Api.Persistence;
using PACademy.Shared.Audit;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Tests;

public sealed class ApplicantsControllerTests
{
    [Fact]
    public void ApplicantManagementProjectionPromotesSubmittedPortalDraft()
    {
        var createdAt = new DateTimeOffset(2026, 5, 31, 8, 30, 0, TimeSpan.Zero);
        var identity = new ApplicantIdentityProjection(
            TableId: "5d4f19bc-6b75-41da-bfe2-3374ecde9a4f",
            AdminRecordId: null,
            NationalId: "30412180103456",
            PhoneNumber: "01012345678",
            FullName: "أحمد محمد إبراهيم سعد",
            Email: "ahmed.ibrahim.saad@gmail.com",
            Gender: "male",
            Religion: "مسلم",
            BirthDate: "2004-12-18",
            BirthGovernorate: "القاهرة",
            BirthDistrict: "مدينة نصر",
            CertificateType: null,
            Source: "moi",
            CreatedAt: createdAt,
            UpdatedAt: createdAt);
        var draft = new JsonObject
        {
            ["applicantId"] = identity.TableId,
            ["furthestStage"] = 8,
            ["categoryKey"] = "officers_general",
            ["profile"] = new JsonObject
            {
                ["nationalId"] = identity.NationalId,
                ["fullName"] = "أحمد محمد إبراهيم سعيد",
                ["mobile"] = identity.PhoneNumber,
                ["email"] = "updated.ahmed@example.eg",
                ["religion"] = identity.Religion,
                ["maritalStatus"] = "single",
                ["thanawiType"] = "علمي علوم",
                ["thanawiTotal"] = 392,
                ["thanawiPercentage"] = 95.61,
                ["thanawiGrade"] = "ممتاز",
                ["schoolNameAr"] = "ثانوية النيل النموذجية",
                ["schoolAddress"] = "الجيزة — شارع التحرير — الدقي",
                ["addressGovernorate"] = "الجيزة",
                ["addressDistrict"] = "الدقي",
                ["currentAddressDetail"] = "12 شارع التحرير",
                ["homePhone"] = "0233456789",
                ["facebook"] = "ahmed.updated"
            },
            ["payment"] = new JsonObject
            {
                ["refNumber"] = "PAY-2026-0001",
                ["amount"] = 250
            },
            ["examSlot"] = new JsonObject
            {
                ["date"] = "2026-06-10",
                ["time"] = "08:00",
                ["location"] = "كلية الشرطة - مبنى الاختبارات - القاهرة"
            },
            ["family"] = new JsonObject
            {
                ["father"] = FamilyMember("محمد", "إبراهيم", "سعيد", "27901010101234", "engineer"),
                ["mother"] = FamilyMember("سعاد", "عبدالله", "محمد", "28102020202345", "teacher"),
                ["fatherWives"] = new JsonArray
                {
                    FamilyMember("ليلى", "حسن", "محمود", "28303030303456", "doctor")
                },
                ["grandparents"] = new JsonObject
                {
                    ["paternalGrandfather"] = FamilyMember("إبراهيم", "سعيد", "علي", "24904040404567", "retired"),
                    ["paternalGrandmother"] = FamilyMember("أمينة", "محمد", "حسن", "25205050505678", "housewife"),
                    ["maternalGrandfather"] = FamilyMember("عبدالله", "محمد", "سالم", "24806060606789", "retired"),
                    ["maternalGrandmother"] = FamilyMember("فاطمة", "محمود", "علي", "25107070707890", "housewife")
                },
                ["relatives"] = new JsonObject
                {
                    ["brothers"] = new JsonArray
                    {
                        FamilyMember("كريم", "محمد", "إبراهيم", "30608080808901", "student")
                    },
                    ["paternal_uncles"] = new JsonArray
                    {
                        FamilyMember("حسن", "إبراهيم", "سعيد", "27709090909012", "lawyer")
                    }
                },
                ["guardian"] = new JsonObject
                {
                    ["firstName"] = "محمد",
                    ["secondName"] = "إبراهيم",
                    ["thirdName"] = "سعيد",
                    ["profession"] = "engineer",
                    ["qualification"] = "bachelor",
                    ["workplaceDetail"] = "القاهرة"
                }
            }
        };

        var row = OperationalRecordsService.ProjectApplicantManagementPayload(draft, identity);

        Assert.Equal(identity.TableId, row["id"]?.GetValue<string>());
        Assert.Equal(identity.NationalId, row["nationalId"]?.GetValue<string>());
        Assert.Equal("أحمد محمد إبراهيم سعيد", row["name"]?.GetValue<string>());
        Assert.Equal("updated.ahmed@example.eg", row["email"]?.GetValue<string>());
        Assert.Equal("أعزب", row["maritalStatus"]?.GetValue<string>());
        Assert.Equal("الجيزة", row["governorate"]?.GetValue<string>());
        Assert.Equal("الدقي", row["city"]?.GetValue<string>());
        Assert.Equal("general_first", row["department"]?.GetValue<string>());
        Assert.Equal("12 شارع التحرير", row["currentAddress"]?["detail"]?.GetValue<string>());
        Assert.Equal("0233456789", row["contact"]?["homePhone"]?.GetValue<string>());
        Assert.Equal("ahmed.updated", row["contact"]?["socialFacebook"]?.GetValue<string>());
        Assert.Equal("ثانوية النيل النموذجية", row["education"]?["schoolName"]?.GetValue<string>());
        Assert.Equal("الجيزة — شارع التحرير — الدقي", row["education"]?["schoolAddress"]?.GetValue<string>());
        Assert.Equal("علمي علوم", row["education"]?["branch"]?.GetValue<string>());
        Assert.Equal("ممتاز", row["education"]?["grade"]?.GetValue<string>());
        Assert.Equal("under-review", row["status"]?.GetValue<string>());
        Assert.Equal(8, row["stage"]?.GetValue<int>());
        Assert.Equal("حجز الاختبارات", row["stageLabel"]?.GetValue<string>());
        Assert.Equal("paid", row["paymentStatus"]?.GetValue<string>());
        Assert.Equal(250, row["paymentAmount"]?.GetValue<double>());
        Assert.Equal("2026-06-10", row["firstExamDate"]?.GetValue<string>());
        Assert.Equal("كلية الشرطة - مبنى الاختبارات - القاهرة", row["examSlot"]?["location"]?.GetValue<string>());
        Assert.False(row.ContainsKey("committee"));
        Assert.Equal("محمد إبراهيم سعيد", row["family"]?["father"]?["fullName"]?.GetValue<string>());
        Assert.Equal("مهندس", row["family"]?["father"]?["occupation"]?.GetValue<string>());
        Assert.Equal("أمينة محمد حسن", row["family"]?["paternalGrandmother"]?["fullName"]?.GetValue<string>());
        Assert.Equal("ليلى حسن محمود", row["family"]?["fatherWives"]?[0]?["fullName"]?.GetValue<string>());
        Assert.Equal("الأخ", row["family"]?["siblings"]?[0]?["relationshipId"]?.GetValue<string>());
        Assert.Equal("العم", row["family"]?["relatives"]?[0]?["relationshipId"]?.GetValue<string>());
        Assert.Equal("ولي الأمر", row["family"]?["guardian"]?["relationshipId"]?.GetValue<string>());
        Assert.Equal(9, row["familySize"]?.GetValue<int>());
        Assert.Equal(1, row["relativesCount"]?.GetValue<int>());
        Assert.Equal("applicant-portal", row["source"]?.GetValue<string>());
    }

    [Fact]
    public void ApplicantManagementProjectionKeepsHigherAndSecondaryEducationFields()
    {
        var createdAt = new DateTimeOffset(2026, 5, 31, 8, 30, 0, TimeSpan.Zero);
        var identity = new ApplicantIdentityProjection(
            TableId: "5d4f19bc-6b75-41da-bfe2-3374ecde9a4f",
            AdminRecordId: null,
            NationalId: "30412180103456",
            PhoneNumber: "01012345678",
            FullName: "أحمد محمد إبراهيم سعد",
            Email: "ahmed.ibrahim.saad@gmail.com",
            Gender: "male",
            Religion: "مسلم",
            BirthDate: "2004-12-18",
            BirthGovernorate: "القاهرة",
            BirthDistrict: "مدينة نصر",
            CertificateType: null,
            Source: "moi",
            CreatedAt: createdAt,
            UpdatedAt: createdAt);
        var draft = new JsonObject
        {
            ["applicantId"] = identity.TableId,
            ["furthestStage"] = 4,
            ["categoryKey"] = "specialized_officers",
            ["profile"] = new JsonObject
            {
                ["qualificationLevel"] = "bachelor",
                ["bachelorFaculty"] = "كلية الهندسة",
                ["bachelorUniversity"] = "القاهرة",
                ["bachelorSpecialization"] = "هندسة اتصالات",
                ["bachelorGrade"] = "جيد جداً",
                ["bachelorPercentage"] = 87.5,
                ["bachelorYear"] = 2025,
                ["thanawiType"] = "علمي رياضة",
                ["thanawiTotal"] = 388,
                ["thanawiPercentage"] = 94.63,
                ["thanawiGradDate"] = "2021-07-15",
                ["thanawiGrade"] = "ممتاز",
                ["schoolNameAr"] = "مدرسة المتفوقين",
                ["schoolAddress"] = "القاهرة — التجمع الخامس"
            }
        };

        var row = OperationalRecordsService.ProjectApplicantManagementPayload(draft, identity);
        var education = Assert.IsType<JsonObject>(row["education"]);
        var secondary = Assert.IsType<JsonObject>(education["secondary"]);

        Assert.Equal("higher", education["kind"]?.GetValue<string>());
        Assert.Equal("كلية الهندسة", education["faculty"]?.GetValue<string>());
        Assert.Equal("القاهرة", education["university"]?.GetValue<string>());
        Assert.Equal("هندسة اتصالات", education["specialization"]?.GetValue<string>());
        Assert.Equal("جيد جداً", education["grade"]?.GetValue<string>());
        Assert.Equal(2025, education["graduationYear"]?.GetValue<double>());
        Assert.Equal(87.5, education["percentage"]?.GetValue<double>());
        Assert.Null(education["totalScore"]);
        Assert.Equal("مدرسة المتفوقين", secondary["schoolName"]?.GetValue<string>());
        Assert.Equal("القاهرة — التجمع الخامس", secondary["schoolAddress"]?.GetValue<string>());
        Assert.Equal(388, secondary["totalScore"]?.GetValue<double>());
        Assert.Equal(94.63, secondary["percentage"]?.GetValue<double>());
        Assert.Equal(2021, secondary["graduationYear"]?.GetValue<double>());
        Assert.Equal("ممتاز", secondary["grade"]?.GetValue<string>());
    }

    [Fact]
    public async Task EligibleCategoriesReturnsConflictWhenNoActiveCycleExists()
    {
        await using var db = CreateDb();
        var controller = CreateController(db);

        var response = await controller.EligibleCategories("30001010123457", ct: CancellationToken.None);

        var result = Assert.IsType<ConflictObjectResult>(response.Result);
        var envelope = Assert.IsType<ApiErrorEnvelope>(result.Value);
        Assert.Equal(ErrorCodes.Conflict, envelope.Code);
        Assert.Equal(ErrorCodes.NoActiveCycle, envelope.ConflictCode);
        Assert.Equal("لا توجد دورة قبول نشطة حالياً", envelope.Message);
    }

    [Fact]
    public async Task CreateDefaultsCycleIdToActiveCycleWhenOmitted()
    {
        await using var db = CreateDb();
        SeedActiveCycle(db, "CYC-ACTIVE-1");
        await db.SaveChangesAsync();
        var controller = CreateController(db);

        var response = await controller.Create(ValidApplicantBody(), CancellationToken.None);

        var result = Assert.IsType<OkObjectResult>(response.Result);
        var applicant = Assert.IsType<JsonObject>(result.Value);
        Assert.Equal("CYC-ACTIVE-1", applicant["cycleId"]?.GetValue<string>());
    }

    [Fact]
    public async Task CreateKeepsExplicitCycleIdOverActiveCycle()
    {
        await using var db = CreateDb();
        SeedActiveCycle(db, "CYC-ACTIVE-1");
        await db.SaveChangesAsync();
        var controller = CreateController(db);
        var body = ValidApplicantBody();
        body["cycleId"] = "CYC-HISTORIC-7";

        var response = await controller.Create(body, CancellationToken.None);

        var result = Assert.IsType<OkObjectResult>(response.Result);
        var applicant = Assert.IsType<JsonObject>(result.Value);
        Assert.Equal("CYC-HISTORIC-7", applicant["cycleId"]?.GetValue<string>());
    }

    private static void SeedActiveCycle(AdminDbContext db, string cycleId)
    {
        var now = DateTimeOffset.UtcNow;
        db.AdmissionCycles.Add(new AdmissionCycleEntity
        {
            Id = cycleId,
            NameAr = "دورة نشطة",
            Year = 2026,
            Status = "active",
            IsActive = true,
            PayloadJson = "{}",
            CreatedAt = now,
            UpdatedAt = now
        });
    }

    private static JsonObject ValidApplicantBody() => new()
    {
        ["nationalId"] = "30412180103456",
        ["religion"] = "مسلم",
        ["maritalStatus"] = "أعزب",
        ["department"] = "general_first",
        ["fullName"] = new JsonObject
        {
            ["first"] = "أحمد",
            ["second"] = "محمد",
            ["third"] = "إبراهيم",
            ["fourth"] = "سعد"
        },
        ["currentAddress"] = new JsonObject
        {
            ["governorate"] = "القاهرة",
            ["city"] = "مدينة نصر",
            ["detail"] = "شارع الطيران"
        },
        ["contact"] = new JsonObject { ["mobilePhone"] = "01012345678" },
        ["education"] = new JsonObject
        {
            ["kind"] = "general",
            ["certificateName"] = "الثانوية العامة",
            ["schoolName"] = "مدرسة النصر",
            ["totalScore"] = 380,
            ["graduationYear"] = 2021
        }
    };

    private static AdminDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AdminDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new AdminDbContext(options);
    }

    private static ApplicantsController CreateController(AdminDbContext db)
    {
        var records = new OperationalRecordsService(db, new HttpContextAccessor(), new NullAuditSink());
        var eligibility = new ApplicantEligibilityService(db, records);
        var cycles = new CyclesService(db, new NullAuditSink(), records);
        return new ApplicantsController(records, eligibility, cycles)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };
    }

    private static JsonObject FamilyMember(
        string firstName,
        string secondName,
        string thirdName,
        string nationalId,
        string profession) => new()
        {
            ["firstName"] = firstName,
            ["secondName"] = secondName,
            ["thirdName"] = thirdName,
            ["nationalId"] = nationalId,
            ["profession"] = profession,
            ["qualification"] = "bachelor",
            ["residenceGovernorate"] = "القاهرة",
            ["deceased"] = false
        };
}
