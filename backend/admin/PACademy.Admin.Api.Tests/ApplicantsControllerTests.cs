using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Controllers;
using PACademy.Admin.Api.Modules.AdminRecords;
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
                ["schoolNameAr"] = "ثانوية النيل النموذجية",
                ["addressGovernorate"] = "الجيزة",
                ["addressDistrict"] = "الدقي",
                ["currentAddressDetail"] = "12 شارع التحرير",
                ["homePhone"] = "0233456789",
                ["facebook"] = "ahmed.updated"
            },
            ["payment"] = new JsonObject
            {
                ["refNumber"] = "PAY-2026-0001"
            },
            ["examSlot"] = new JsonObject
            {
                ["date"] = "2026-06-10",
                ["time"] = "08:00",
                ["location"] = "كلية الشرطة - مبنى الاختبارات - القاهرة"
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
        Assert.Equal("12 شارع التحرير", row["currentAddress"]?["detail"]?.GetValue<string>());
        Assert.Equal("0233456789", row["contact"]?["homePhone"]?.GetValue<string>());
        Assert.Equal("ahmed.updated", row["contact"]?["socialFacebook"]?.GetValue<string>());
        Assert.Equal("ثانوية النيل النموذجية", row["education"]?["schoolName"]?.GetValue<string>());
        Assert.Equal("علمي علوم", row["education"]?["branch"]?.GetValue<string>());
        Assert.Equal("under-review", row["status"]?.GetValue<string>());
        Assert.Equal(8, row["stage"]?.GetValue<int>());
        Assert.Equal("حجز الاختبارات", row["stageLabel"]?.GetValue<string>());
        Assert.Equal("paid", row["paymentStatus"]?.GetValue<string>());
        Assert.Equal("2026-06-10", row["firstExamDate"]?.GetValue<string>());
        Assert.Equal("applicant-portal", row["source"]?.GetValue<string>());
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
        return new ApplicantsController(records, eligibility)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };
    }
}
