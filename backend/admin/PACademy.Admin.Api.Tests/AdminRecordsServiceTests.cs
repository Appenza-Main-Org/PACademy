using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Persistence;
using PACademy.Shared.Audit;

namespace PACademy.Admin.Api.Tests;

public sealed class AdminRecordsServiceTests
{
    [Fact]
    public async Task SoftDeleteModuleAsyncProcessesRowsPastFirstBatch()
    {
        await using var db = CreateDb();
        var now = DateTimeOffset.UtcNow;
        for (var i = 1; i <= 5001; i++)
        {
            var id = i.ToString("D5");
            db.AdminRecords.Add(new AdminRecordEntity
            {
                Module = "grades",
                Id = id,
                PayloadJson = new JsonObject
                {
                    ["id"] = id,
                    ["seat"] = i,
                    ["deletedAt"] = null
                }.ToJsonString(),
                CreatedAt = now,
                UpdatedAt = now
            });
        }
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        var service = new AdminRecordsService(db, new HttpContextAccessor(), new NullAuditSink());

        var deleted = await service.SoftDeleteModuleAsync(
            "grades",
            "test-user",
            "regression",
            TestContext.Current.CancellationToken);

        Assert.Equal(5001, deleted);
        var liveRows = await db.AdminRecords
            .AsNoTracking()
            .Where(x => x.Module == "grades")
            .Select(x => AdminRecordJson.Parse(x.PayloadJson))
            .CountAsync(x => !AdminRecordJson.IsSoftDeleted(x), TestContext.Current.CancellationToken);
        Assert.Equal(0, liveRows);
    }

    private static AdminDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AdminDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new AdminDbContext(options);
    }
}
