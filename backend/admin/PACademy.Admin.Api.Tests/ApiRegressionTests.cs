using System.Reflection;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Controllers;
using PACademy.Admin.Api.Infrastructure;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Modules.Exams;
using PACademy.Admin.Api.Persistence;
using PACademy.Shared.Audit;

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
        var records = new AdminRecordsService(db, new HttpContextAccessor(), new NullAuditSink());
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
}
