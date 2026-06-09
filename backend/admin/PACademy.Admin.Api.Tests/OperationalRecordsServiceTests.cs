using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Modules.Lookups;
using PACademy.Admin.Api.Persistence;
using PACademy.Shared.Audit;

namespace PACademy.Admin.Api.Tests;

public sealed class OperationalRecordsServiceTests
{
    [Theory]
    [InlineData(true)]
    [InlineData("true")]
    [InlineData("TRUE")]
    public void IsSoftDeletedTreatsIsDeletedTrueAsTombstone(object marker)
    {
        var row = new JsonObject
        {
            ["id"] = "1",
            ["isDeleted"] = JsonValue.Create(marker)
        };

        Assert.True(AdminRecordJson.IsSoftDeleted(row));
    }

    [Fact]
    public async Task GenericAdminRecordWritesDoNotUseAdminRecordsTable()
    {
        await using var db = CreateDb();
        var service = new OperationalRecordsService(db, new HttpContextAccessor(), new NullAuditSink());

        var saved = await service.UpsertAsync("workflows", "WF-TEST", new JsonObject
        {
            ["id"] = "WF-TEST",
            ["department"] = "medical",
            ["steps"] = new JsonArray("review", "approve")
        }, TestContext.Current.CancellationToken);

        var rows = await service.ListAsync("workflows", TestContext.Current.CancellationToken);
        var adminRecordsCount = await db.AdminRecords.CountAsync(TestContext.Current.CancellationToken);

        Assert.Equal("WF-TEST", AdminRecordJson.StringProp(saved, "id"));
        Assert.Single(rows);
        Assert.Equal(0, adminRecordsCount);
    }

    [Fact]
    public void OperationalRecordsServiceDoesNotAddLegacyAdminRecordEntities()
    {
        var servicePath = Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory,
            "../../../../PACademy.Admin.Api/Modules/AdminRecords/OperationalRecordsService.cs"));
        var source = File.ReadAllText(servicePath);

        Assert.DoesNotMatch(
            new Regex(@"\bAdminRecords\s*\.\s*Add(?:Range)?\s*\(", RegexOptions.Multiline),
            source);
    }

    [Fact]
    public async Task SoftDeleteModuleAsyncProcessesRowsPastFirstBatch()
    {
        await using var db = CreateDb();
        var payloads = new List<JsonObject>();
        for (var i = 1; i <= 5001; i++)
        {
            var id = i.ToString("D5");
            payloads.Add(new JsonObject
            {
                ["id"] = id,
                ["seat"] = i,
                ["deletedAt"] = null
            });
        }
        var service = new OperationalRecordsService(db, new HttpContextAccessor(), new NullAuditSink());
        await service.InsertManyAsync("grades", payloads, TestContext.Current.CancellationToken);

        var deleted = await service.SoftDeleteModuleAsync(
            "grades",
            "test-user",
            "regression",
            TestContext.Current.CancellationToken);

        Assert.Equal(5001, deleted);
        var liveRows = (await service.ListAsync("grades", TestContext.Current.CancellationToken))
            .Count(x => !AdminRecordJson.IsSoftDeleted(x));
        Assert.Equal(0, liveRows);
    }

    [Fact]
    public async Task ApplicantListResolvesCommitteeNameFromBookedSlot()
    {
        await using var db = CreateDb();
        var service = new OperationalRecordsService(db, new HttpContextAccessor(), new NullAuditSink());
        db.LookupRows.Add(new LookupRowEntity
        {
            LookupKey = "committees",
            Code = "CMT-LAW-04",
            Name = "اللجنة الرابعة ليسانس حقوق",
            IsActive = true,
            PayloadJson = "{}",
            SourceSystem = "test"
        });
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        await service.UpsertAsync(
            "committeeInstances",
            "CI-LAW-04-20260617",
            new JsonObject
            {
                ["id"] = "CI-LAW-04-20260617",
                ["cycleId"] = "CYC-1780758679766",
                ["categoryKey"] = "law_bachelor",
                ["definitionCode"] = "CMT-LAW-04",
                ["date"] = "2026-06-17"
            },
            TestContext.Current.CancellationToken);
        await service.UpsertAsync(
            "applicants",
            "APP-SLOT",
            new JsonObject
            {
                ["id"] = "APP-SLOT",
                ["nationalId"] = "30501011234568",
                ["name"] = "محجوز",
                ["status"] = "exam_scheduled",
                ["cycleId"] = "CYC-1780758679766",
                ["categoryKey"] = "law_bachelor",
                ["examSlot"] = new JsonObject
                {
                    ["slotId"] = "CI-LAW-04-20260617",
                    ["date"] = "2026-06-17",
                    ["time"] = "08:00",
                    ["location"] = "كلية الشرطة - مبنى الاختبارات - القاهرة"
                }
            },
            TestContext.Current.CancellationToken);

        var applicants = await service.ListAsync("applicants", TestContext.Current.CancellationToken);

        var applicant = Assert.Single(applicants);
        Assert.Equal("اللجنة الرابعة ليسانس حقوق", applicant["committeeName"]?.GetValue<string>());
        Assert.Equal("كلية الشرطة - مبنى الاختبارات - القاهرة", applicant["examSlot"]?["location"]?.GetValue<string>());
    }

    private static AdminDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AdminDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new AdminDbContext(options);
    }
}
