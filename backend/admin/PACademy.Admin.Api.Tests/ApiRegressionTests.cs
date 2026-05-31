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
using PACademy.Admin.Api.Modules.Exams;
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

    private static JsonObject CommitteeInstance(string id, string categoryKey)
    {
        return new JsonObject
        {
            ["id"] = id,
            ["cycleId"] = "CYC-2026-M",
            ["categoryKey"] = categoryKey,
            ["definitionCode"] = "COM-GEN-01",
            ["date"] = "2026-07-10",
            ["capacity"] = 100,
            ["reserved"] = 0
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
