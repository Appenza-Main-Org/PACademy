using System.Reflection;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging.Abstractions;
using PACademy.Admin.Api.Modules.Lookups;
using PACademy.Admin.Api.Controllers;
using PACademy.Admin.Api.Infrastructure;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Modules.Admissions;
using PACademy.Admin.Api.Modules.Exams;
using PACademy.Admin.Api.Modules.OperationalRecords;
using PACademy.Admin.Api.Modules.Payments;
using PACademy.Admin.Api.Modules.Reports.Dtos;
using PACademy.Admin.Api.Modules.Reports.Validators;
using PACademy.Admin.Api.Modules.Settings;
using PACademy.Admin.Api.Persistence;
using PACademy.Shared.Audit;
using PACademy.Shared.Contracts;
using PACademy.Shared.Web;

namespace PACademy.Admin.Api.Tests;

public sealed class ApiRegressionTests
{
    [Fact]
    public async Task QuestionAndExamModulesHaveTypedDbSets()
    {
        await using var db = CreateDb();

        Assert.NotNull(db.ExamQuestions);
        Assert.NotNull(db.Exams);
    }

    [Fact]
    public async Task CreatingQuestionAndExamDoesNotWriteAdminRecords()
    {
        await using var db = CreateDb();
        var records = new OperationalRecordsService(db, new HttpContextAccessor(), new NullAuditSink());
        var service = new ExamsService(records, db);

        _ = await service.CreateQuestionAsync(new JsonObject
        {
            ["id"] = "Q-NORMALIZED-1",
            ["category"] = "منطق",
            ["difficulty"] = 3,
            ["type"] = "mcq",
            ["text"] = "سؤال تجريبي",
            ["options"] = new JsonArray("أ", "ب"),
            ["correctIndex"] = 0,
            ["timeLimitSeconds"] = 60
        }, TestContext.Current.CancellationToken);

        _ = await service.CreateExamAsync(new JsonObject
        {
            ["id"] = "EXAM-NORMALIZED-1",
            ["nameAr"] = "اختبار تجريبي",
            ["cycleId"] = "CYC-TEST",
            ["scheduledFor"] = "2026-05-29T10:00:00Z",
            ["rules"] = new JsonArray(new JsonObject
            {
                ["category"] = "منطق",
                ["difficultyMin"] = 1,
                ["difficultyMax"] = 5,
                ["count"] = 1,
                ["minutes"] = 5
            }),
            ["questionIds"] = new JsonArray("Q-NORMALIZED-1")
        }, TestContext.Current.CancellationToken);

        var adminRecordCount = await db.AdminRecords.CountAsync(
            x => x.Module == "questions" || x.Module == "exams",
            TestContext.Current.CancellationToken);
        Assert.Equal(0, adminRecordCount);
    }

    [Fact]
    public async Task QuestionAndExamCreationAcceptMinimalValidPayloads()
    {
        await using var db = CreateDb();
        var records = new OperationalRecordsService(db, new HttpContextAccessor(), new NullAuditSink());
        var service = new ExamsService(records, db);

        var question = await service.CreateQuestionAsync(new JsonObject
        {
            ["category"] = "منطق",
            ["type"] = "mcq",
            ["text"] = "سؤال صالح",
            ["options"] = new JsonArray("أ", "ب"),
            ["correctIndex"] = 1
        }, TestContext.Current.CancellationToken);

        var exam = await service.CreateExamAsync(new JsonObject
        {
            ["nameAr"] = "اختبار صالح",
            ["cycleId"] = "CYC-TEST",
            ["rules"] = new JsonArray(new JsonObject { ["category"] = "منطق", ["count"] = 1 }),
            ["questionIds"] = new JsonArray(question["id"]!.GetValue<string>())
        }, TestContext.Current.CancellationToken);

        Assert.False(string.IsNullOrWhiteSpace(question["id"]?.GetValue<string>()));
        Assert.False(string.IsNullOrWhiteSpace(exam["id"]?.GetValue<string>()));
        Assert.Equal("اختبار صالح", exam["nameAr"]?.GetValue<string>());
    }

    [Theory]
    [InlineData("conflict", StatusCodes.Status409Conflict)]
    [InlineData("not-found", StatusCodes.Status404NotFound)]
    public async Task GlobalExceptionHandlerMapsDomainExceptionsTo4xx(string kind, int expectedStatus)
    {
        var handler = new GlobalExceptionHandler(
            NullLogger<GlobalExceptionHandler>.Instance,
            new TestHostEnvironment());
        var context = new DefaultHttpContext();
        Exception exception = kind == "conflict"
            ? new ConflictException(ErrorCodes.ActiveCycleExists, "توجد دورة قبول نشطة بالفعل")
            : new EntityNotFoundException("السجل غير موجود");

        var handled = await handler.TryHandleAsync(context, exception, TestContext.Current.CancellationToken);

        Assert.True(handled);
        Assert.Equal(expectedStatus, context.Response.StatusCode);
    }

    [Fact]
    public async Task CyclePublishSwapLeavesExactlyOneActiveCycle()
    {
        await using var db = CreateDb();
        var service = new CyclesService(db, new NullAuditSink(), new OperationalRecordStore(db));

        _ = await service.CreateAsync(CyclePayload("CYC-A", "دورة أولى", isActive: true), TestContext.Current.CancellationToken);
        _ = await service.CreateAsync(CyclePayload("CYC-B", "دورة ثانية", isActive: true), TestContext.Current.CancellationToken, swap: true);

        var rows = await db.AdmissionCycles.OrderBy(x => x.Id).ToListAsync(TestContext.Current.CancellationToken);
        Assert.Single(rows, x => x.IsActive);
        Assert.Equal("closed", rows.Single(x => x.Id == "CYC-A").Status);
        Assert.False(rows.Single(x => x.Id == "CYC-A").IsActive);
        Assert.Equal("active", rows.Single(x => x.Id == "CYC-B").Status);
        Assert.True(rows.Single(x => x.Id == "CYC-B").IsActive);
    }

    [Fact]
    public async Task CyclePublishWithoutSwapRejectsSecondActiveCycle()
    {
        await using var db = CreateDb();
        var service = new CyclesService(db, new NullAuditSink(), new OperationalRecordStore(db));

        _ = await service.CreateAsync(CyclePayload("CYC-A", "دورة أولى", isActive: true), TestContext.Current.CancellationToken);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            service.CreateAsync(CyclePayload("CYC-B", "دورة ثانية", isActive: true), TestContext.Current.CancellationToken));

        Assert.Equal(ErrorCodes.ActiveCycleExists, ex.ConflictCode);
        Assert.Single(await db.AdmissionCycles.Where(x => x.IsActive).ToListAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task ReportsWideFiltersAreAccepted()
    {
        var validator = new ReportsFiltersValidator();

        var result = await validator.ValidateAsync(new ReportsFiltersDto
        {
            AgeMax = 120,
            StoppedAtStage = 0
        }, TestContext.Current.CancellationToken);

        Assert.True(result.IsValid);
    }

    [Fact]
    public void ReportedUnauthenticatedEndpointsRequireBearerAuth()
    {
        AssertRequireBearerAuth(typeof(CommitteesController));
        AssertRequireBearerAuth(typeof(RolesController).GetMethod(nameof(RolesController.Create)));
        AssertRequireBearerAuth(typeof(UsersController).GetMethod(nameof(UsersController.GetStatus)));
        AssertRequireBearerAuth(typeof(ExamsController).GetMethod(nameof(ExamsController.ListExams)));
        AssertRequireBearerAuth(typeof(ExamsController).GetMethod(nameof(ExamsController.CreateExam)));
        AssertRequireBearerAuth(typeof(OperationalAdminController).GetMethod(nameof(OperationalAdminController.CreateWorkflow)));
        AssertRequireBearerAuth(typeof(OperationalAdminController).GetMethod(nameof(OperationalAdminController.WorkflowByDepartment)));
    }

    [Fact]
    public async Task TransitionResultRejectsZeroUuid()
    {
        var controller = new ExamPlansController(null!, null!);

        var response = await controller.TransitionResult(
            "00000000-0000-0000-0000-000000000000",
            [],
            TestContext.Current.CancellationToken);

        Assert.IsType<BadRequestObjectResult>(response.Result);
    }

    [Fact]
    public async Task AuditDiffReturnsErrorEnvelopeForMissingId()
    {
        await using var db = CreateDb();
        var controller = new AuditController(db);

        var response = await controller.Diff("AUD-MISSING", TestContext.Current.CancellationToken);

        Assert.IsType<NotFoundObjectResult>(response.Result);
    }

    [Fact]
    public async Task ElectronicDeclarationDefaultMatchesFrontendContract()
    {
        await using var db = CreateDb();
        var records = new OperationalRecordsService(db, new HttpContextAccessor(), new NullAuditSink());
        var controller = new AdmissionSetupController(records, null!);

        var response = await controller.Declaration("CYC-TEST", TestContext.Current.CancellationToken);

        var ok = Assert.IsType<OkObjectResult>(response.Result);
        var body = Assert.IsType<JsonObject>(ok.Value);
        Assert.Equal("DECL-CYC-TEST", body["id"]?.GetValue<string>());
        Assert.Equal("CYC-TEST", body["cycleId"]?.GetValue<string>());
        Assert.Equal("text", body["mode"]?.GetValue<string>());
        Assert.Equal(1, body["version"]?.GetValue<int>());
        Assert.Equal("", body["bodyAr"]?.GetValue<string>());
        Assert.False(string.IsNullOrWhiteSpace(body["effectiveFrom"]?.GetValue<string>()));
        Assert.False(string.IsNullOrWhiteSpace(body["createdAt"]?.GetValue<string>()));
        Assert.Equal("system", body["createdBy"]?.GetValue<string>());
    }

    [Fact]
    public async Task ElectronicDeclarationPdfUploadPersistsDocumentMetadata()
    {
        await using var db = CreateDb();
        var records = new OperationalRecordsService(db, new HttpContextAccessor(), new NullAuditSink());
        var controller = new AdmissionSetupController(records, null!);
        await using var stream = new MemoryStream([0x25, 0x50, 0x44, 0x46]);
        var file = new FormFile(stream, 0, stream.Length, "document", "declaration.pdf")
        {
            Headers = new HeaderDictionary(),
            ContentType = "application/pdf"
        };

        var response = await controller.SaveDeclarationPdf(
            "CYC-TEST",
            "pdf",
            "",
            "2026-06-03T00:00:00.000Z",
            file,
            TestContext.Current.CancellationToken);

        var ok = Assert.IsType<OkObjectResult>(response.Result);
        var body = Assert.IsType<JsonObject>(ok.Value);
        var document = Assert.IsType<JsonObject>(body["document"]);
        Assert.Equal("pdf", body["mode"]?.GetValue<string>());
        Assert.Equal(1, body["version"]?.GetValue<int>());
        Assert.Equal("declaration.pdf", document["fileName"]?.GetValue<string>());
        Assert.Equal(4, document["size"]?.GetValue<int>());
        Assert.StartsWith("data:application/pdf;base64,", document["fileUrl"]?.GetValue<string>());
    }

    [Fact]
    public async Task ElectronicDeclarationExplicitNullDocumentClearsSavedPdf()
    {
        await using var db = CreateDb();
        var records = new OperationalRecordsService(db, new HttpContextAccessor(), new NullAuditSink());
        var controller = new AdmissionSetupController(records, null!);
        await using var stream = new MemoryStream([0x25, 0x50, 0x44, 0x46]);
        var file = new FormFile(stream, 0, stream.Length, "document", "declaration.pdf")
        {
            Headers = new HeaderDictionary(),
            ContentType = "application/pdf"
        };
        await controller.SaveDeclarationPdf(
            "CYC-TEST",
            "pdf",
            "",
            "2026-06-03T00:00:00.000Z",
            file,
            TestContext.Current.CancellationToken);

        var response = await controller.SaveDeclaration("CYC-TEST", new JsonObject
        {
            ["mode"] = "pdf",
            ["bodyAr"] = "",
            ["document"] = null,
            ["effectiveFrom"] = "2026-06-03T00:00:00.000Z"
        }, TestContext.Current.CancellationToken);

        var ok = Assert.IsType<OkObjectResult>(response.Result);
        var body = Assert.IsType<JsonObject>(ok.Value);
        Assert.True(body.TryGetPropertyValue("document", out var document));
        Assert.Null(document);
        Assert.Equal(2, body["version"]?.GetValue<int>());
    }

    [Fact]
    public async Task ElectronicDeclarationMissingDocumentKeyPreservesSavedPdf()
    {
        await using var db = CreateDb();
        var records = new OperationalRecordsService(db, new HttpContextAccessor(), new NullAuditSink());
        var controller = new AdmissionSetupController(records, null!);
        await using var stream = new MemoryStream([0x25, 0x50, 0x44, 0x46]);
        var file = new FormFile(stream, 0, stream.Length, "document", "declaration.pdf")
        {
            Headers = new HeaderDictionary(),
            ContentType = "application/pdf"
        };
        await controller.SaveDeclarationPdf(
            "CYC-TEST",
            "pdf",
            "",
            "2026-06-03T00:00:00.000Z",
            file,
            TestContext.Current.CancellationToken);

        var response = await controller.SaveDeclaration("CYC-TEST", new JsonObject
        {
            ["mode"] = "pdf",
            ["bodyAr"] = "",
            ["effectiveFrom"] = "2026-06-03T00:00:00.000Z"
        }, TestContext.Current.CancellationToken);

        var ok = Assert.IsType<OkObjectResult>(response.Result);
        var body = Assert.IsType<JsonObject>(ok.Value);
        var document = Assert.IsType<JsonObject>(body["document"]);
        Assert.Equal("declaration.pdf", document["fileName"]?.GetValue<string>());
    }

    [Fact]
    public async Task BlockedLookupDeleteReturnsConflict()
    {
        await using var db = CreateDb();
        SeedLookup(db, "applicant-categories", "CAT-02", "قسم الضباط المتخصصين");
        SeedLookup(db, "announcements", "ANN-01", "تنبيه", new JsonObject
        {
            ["categoryCode"] = "CAT-02"
        });
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        var service = new LookupsService(db, new LookupRowValidator());
        var controller = new LookupsController(service);

        var response = await controller.Delete("applicant-categories", "CAT-02", force: false, TestContext.Current.CancellationToken);

        var conflict = Assert.IsType<ConflictObjectResult>(response.Result);
        var body = Assert.IsType<DeleteLookupRowResult>(conflict.Value);
        Assert.False(body.Deleted);
        Assert.Equal(1, body.ReferenceCount);
        Assert.Contains("تنبيه مرتبط بهذه الفئة", body.Reason);
    }

    [Fact]
    public async Task ApplicationSettingsCategoryConfigsReturnExcellenceCriteriaArrays()
    {
        await using var db = CreateDb();
        SeedLookup(db, "applicant-categories", "officers_general", "الضباط", new JsonObject
        {
            ["type"] = "university",
            ["facultyCodes"] = new JsonArray("law"),
            ["specializationCodes"] = new JsonArray(),
            ["genderScope"] = new JsonArray("male", "female"),
            ["excellenceCriterion"] = new JsonArray("EXC-01")
        });
        SeedLookup(db, "submission-types", "university", "جامعي", new JsonObject
        {
            ["metadata"] = new JsonObject { ["gradingMode"] = "GRADES" }
        });
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        var service = new ApplicationSettingsService(db);

        var rows = await service.ListCategoryConfigsAsync(TestContext.Current.CancellationToken);

        var row = Assert.Single(rows);
        var criteria = Assert.IsType<JsonArray>(row["excellenceCriterion"]);
        Assert.Equal("EXC-01", criteria[0]?.GetValue<string>());
    }

    [Fact]
    public async Task CommitteeInstancesExcludeInactiveAndDeletedCategories()
    {
        await using var db = CreateDb();
        SeedLookup(db, "applicant-categories", "CAT-ACTIVE", "فئة نشطة");
        SeedLookup(db, "applicant-categories", "CAT-INACTIVE", "فئة موقوفة", isActive: false);
        var records = new OperationalRecordsService(db, new HttpContextAccessor(), new NullAuditSink());
        await records.UpsertAsync("committeeInstances", "CI-ACTIVE", CommitteeInstance("CI-ACTIVE", "CAT-ACTIVE"), TestContext.Current.CancellationToken);
        await records.UpsertAsync("committeeInstances", "CI-INACTIVE", CommitteeInstance("CI-INACTIVE", "CAT-INACTIVE"), TestContext.Current.CancellationToken);
        await records.UpsertAsync("committeeInstances", "CI-DELETED", CommitteeInstance("CI-DELETED", "CAT-DELETED"), TestContext.Current.CancellationToken);
        var controller = new OperationalAdminController(records, db, new GeneralSettingsService(db));

        var response = await controller.CommitteeInstances(TestContext.Current.CancellationToken);

        var ok = Assert.IsType<OkObjectResult>(response.Result);
        var rows = Assert.IsAssignableFrom<IReadOnlyList<JsonObject>>(ok.Value);
        var row = Assert.Single(rows);
        Assert.Equal("CI-ACTIVE", row["id"]?.GetValue<string>());
    }

    [Fact]
    public async Task DeleteCommitteeInstanceRejectsReservedBookings()
    {
        await using var db = CreateDb();
        var records = new OperationalRecordsService(db, new HttpContextAccessor(), new NullAuditSink());
        await records.UpsertAsync(
            "committeeInstances",
            "CI-BOOKED",
            CommitteeInstance("CI-BOOKED", "CAT-ACTIVE", reservedCount: 3),
            TestContext.Current.CancellationToken);
        var controller = new OperationalAdminController(records, db, new GeneralSettingsService(db));

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            controller.DeleteCommitteeInstance("CI-BOOKED", TestContext.Current.CancellationToken));

        Assert.Equal("COMMITTEE_INSTANCE_HAS_BOOKINGS", ex.ConflictCode);
        Assert.Contains("حجوزات", ex.Message);
    }

    [Fact]
    public async Task UpdatingCommitteeInstanceReturnsSyncedCapacityReservationsAndTimestamp()
    {
        await using var db = CreateDb();
        SeedLookup(db, "applicant-categories", "CAT-ACTIVE", "فئة نشطة");
        SeedLookup(db, "committees", "COM-GEN-01", "اللجنة الأولى");
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        var records = new OperationalRecordsService(db, new HttpContextAccessor(), new NullAuditSink());
        await records.UpsertAsync(
            "committeeInstances",
            "CI-ACTIVE",
            new JsonObject
            {
                ["id"] = "CI-ACTIVE",
                ["cycleId"] = "CYC-2026-M",
                ["categoryKey"] = "CAT-ACTIVE",
                ["definitionCode"] = "COM-GEN-01",
                ["date"] = "2026-07-10",
                ["capacity"] = 100,
                ["reserved"] = 0,
                ["reservedRefreshedAt"] = "2026-01-01T00:00:00.0000000Z",
                ["updatedAt"] = "2026-01-01T00:00:00.0000000Z"
            },
            TestContext.Current.CancellationToken);
        await records.UpsertAsync(
            "applicants",
            "APP-1",
            new JsonObject
            {
                ["id"] = "APP-1",
                ["committeeId"] = "COM-GEN-01"
            },
            TestContext.Current.CancellationToken);
        var controller = new OperationalAdminController(records, db, new GeneralSettingsService(db));

        var response = await controller.UpdateCommitteeInstance(
            "CI-ACTIVE",
            new JsonObject { ["capacity"] = 125 },
            TestContext.Current.CancellationToken);

        var ok = Assert.IsType<OkObjectResult>(response.Result);
        var row = Assert.IsType<JsonObject>(ok.Value);
        Assert.Equal(125, row["capacity"]?.GetValue<int>());
        Assert.Equal(1, row["reserved"]?.GetValue<int>());
        Assert.NotEqual("2026-01-01T00:00:00.0000000Z", row["reservedRefreshedAt"]?.GetValue<string>());
        Assert.NotEqual("2026-01-01T00:00:00.0000000Z", row["updatedAt"]?.GetValue<string>());
    }

    [Fact]
    public async Task ListingCommitteeInstancesKeepsTimestampWhenReservationCountIsUnchanged()
    {
        await using var db = CreateDb();
        SeedLookup(db, "applicant-categories", "CAT-ACTIVE", "فئة نشطة");
        SeedLookup(db, "committees", "COM-GEN-01", "اللجنة الأولى");
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        var records = new OperationalRecordsService(db, new HttpContextAccessor(), new NullAuditSink());
        await records.UpsertAsync(
            "committeeInstances",
            "CI-ACTIVE",
            CommitteeInstance(
                "CI-ACTIVE",
                "CAT-ACTIVE",
                reservedCount: 1,
                reservedRefreshedAt: "2026-01-01T00:00:00.0000000Z"),
            TestContext.Current.CancellationToken);
        await records.UpsertAsync(
            "applicants",
            "APP-1",
            new JsonObject
            {
                ["id"] = "APP-1",
                ["committeeId"] = "COM-GEN-01"
            },
            TestContext.Current.CancellationToken);
        var controller = new OperationalAdminController(records, db, new GeneralSettingsService(db));

        var response = await controller.CommitteeInstances(TestContext.Current.CancellationToken);

        var ok = Assert.IsType<OkObjectResult>(response.Result);
        var row = Assert.Single(Assert.IsAssignableFrom<IReadOnlyList<JsonObject>>(ok.Value));
        Assert.Equal(1, row["reserved"]?.GetValue<int>());
        Assert.Equal("2026-01-01T00:00:00.0000000Z", row["reservedRefreshedAt"]?.GetValue<string>());
    }

    [Fact]
    public async Task ListingCommitteeInstancesCountsReservationsByCommitteeDateAndCycleWhenPresent()
    {
        await using var db = CreateDb();
        SeedLookup(db, "applicant-categories", "CAT-ACTIVE", "فئة نشطة");
        SeedLookup(db, "committees", "COM-GEN-01", "اللجنة الأولى");
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        var records = new OperationalRecordsService(db, new HttpContextAccessor(), new NullAuditSink());
        await records.UpsertAsync(
            "committeeInstances",
            "CI-FIRST-DAY",
            CommitteeInstance("CI-FIRST-DAY", "CAT-ACTIVE", date: "2026-07-10"),
            TestContext.Current.CancellationToken);
        await records.UpsertAsync(
            "committeeInstances",
            "CI-SECOND-DAY",
            CommitteeInstance("CI-SECOND-DAY", "CAT-ACTIVE", date: "2026-07-11"),
            TestContext.Current.CancellationToken);
        await records.UpsertAsync(
            "applicants",
            "APP-1",
            new JsonObject
            {
                ["id"] = "APP-1",
                ["cycleId"] = "CYC-2026-M",
                ["committeeId"] = "COM-GEN-01",
                ["examSlot"] = new JsonObject { ["date"] = "2026-07-10T08:00:00.000Z" }
            },
            TestContext.Current.CancellationToken);
        var controller = new OperationalAdminController(records, db, new GeneralSettingsService(db));

        var response = await controller.CommitteeInstances(TestContext.Current.CancellationToken);

        var ok = Assert.IsType<OkObjectResult>(response.Result);
        var rows = Assert.IsAssignableFrom<IReadOnlyList<JsonObject>>(ok.Value);
        Assert.Equal(1, Assert.Single(rows, x => x["id"]?.GetValue<string>() == "CI-FIRST-DAY")["reserved"]?.GetValue<int>());
        Assert.Equal(0, Assert.Single(rows, x => x["id"]?.GetValue<string>() == "CI-SECOND-DAY")["reserved"]?.GetValue<int>());
    }

    [Fact]
    public async Task PaymentsListIncludesSuccessfulPortalPayments()
    {
        await using var db = CreateDb();
        var now = DateTimeOffset.UtcNow;
        var records = new OperationalRecordsService(db, new HttpContextAccessor(), new NullAuditSink());
        await records.UpsertAsync(
            "applicants",
            "APP-PAY-1",
            new JsonObject
            {
                ["id"] = "APP-PAY-1",
                ["applicantId"] = "APP-PAY-1",
                ["name"] = "أحمد محمود",
                ["nationalId"] = "29901011234567",
                ["cycleId"] = "CYC-2026"
            },
            TestContext.Current.CancellationToken);
        db.ApplicantPortalRecords.Add(new ApplicantPortalRecordEntity
        {
            Type = "payment",
            RecordId = "FW-123456",
            ApplicantId = "APP-PAY-1",
            PayloadJson = new JsonObject
            {
                ["refNumber"] = "FW-123456",
                ["applicantId"] = "APP-PAY-1",
                ["amount"] = 1500,
                ["status"] = "success",
                ["paidAt"] = now.ToUnixTimeMilliseconds()
            }.ToJsonString(AdminRecordJson.Options),
            CreatedAt = now,
            UpdatedAt = now
        });
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        var service = new PaymentsLedgerService(records, db);
        var controller = new PaymentsController(service);

        var response = await controller.List(
            status: "paid",
            search: "29901011234567",
            cycleId: "CYC-2026",
            TestContext.Current.CancellationToken);

        var ok = Assert.IsType<OkObjectResult>(response.Result);
        var rows = Assert.IsAssignableFrom<IReadOnlyList<JsonObject>>(ok.Value);
        var row = Assert.Single(rows);
        Assert.Equal("أحمد محمود", row["applicantName"]?.GetValue<string>());
        Assert.Equal("29901011234567", row["nationalId"]?.GetValue<string>());
        Assert.Equal("FW-123456", row["fawryReference"]?.GetValue<string>());
        Assert.Equal("paid", row["status"]?.GetValue<string>());
        Assert.Equal(1500, row["amount"]?.GetValue<double>());
        Assert.False(string.IsNullOrWhiteSpace(row["lastSyncAt"]?.GetValue<string>()));
    }

    private static void AssertRequireBearerAuth(MemberInfo? target)
    {
        Assert.NotNull(target);
        Assert.Contains(target.GetCustomAttributes(inherit: true), attr => attr is RequireBearerAuthAttribute);
    }

    private static AdminDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AdminDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new AdminDbContext(options);
    }

    private static void SeedLookup(AdminDbContext db, string key, string code, string name, JsonObject? extra = null, bool isActive = true)
    {
        var payload = extra is null ? [] : LookupJson.Clone(extra);
        payload["code"] = code;
        payload["name"] = name;
        payload["isActive"] = isActive;
        var now = DateTimeOffset.UtcNow;
        db.LookupRows.Add(new LookupRowEntity
        {
            LookupKey = key,
            Code = code,
            Name = name,
            IsActive = isActive,
            PayloadJson = payload.ToJsonString(LookupJson.Options),
            CreatedAt = now,
            UpdatedAt = now
        });
    }

    private static JsonObject CyclePayload(string id, string nameAr, bool isActive)
    {
        return new JsonObject
        {
            ["id"] = id,
            ["nameAr"] = nameAr,
            ["year"] = 2026,
            ["status"] = isActive ? "active" : "draft",
            ["isActive"] = isActive,
            ["openDate"] = "2026-01-01T00:00:00.000Z",
            ["closeDate"] = "2026-04-15T23:59:59.000Z"
        };
    }

    private static JsonObject CommitteeInstance(
        string id,
        string categoryKey,
        int reservedCount = 0,
        string date = "2026-07-10",
        string? reservedRefreshedAt = null)
    {
        return new JsonObject
        {
            ["id"] = id,
            ["cycleId"] = "CYC-2026-M",
            ["categoryKey"] = categoryKey,
            ["definitionCode"] = "COM-GEN-01",
            ["date"] = date,
            ["capacity"] = 100,
            ["reserved"] = reservedCount,
            ["reservedRefreshedAt"] = reservedRefreshedAt
        };
    }

    private sealed class TestHostEnvironment : IWebHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Production";
        public string ApplicationName { get; set; } = "PACademy.Admin.Api.Tests";
        public string WebRootPath { get; set; } = "";
        public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
        public string ContentRootPath { get; set; } = Directory.GetCurrentDirectory();
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
