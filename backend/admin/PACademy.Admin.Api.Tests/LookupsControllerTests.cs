using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Controllers;
using PACademy.Admin.Api.Modules.Lookups;
using PACademy.Admin.Api.Persistence;

namespace PACademy.Admin.Api.Tests;

public sealed class LookupsControllerTests
{
    [Fact]
    public async Task ForcedLookupDeleteRemovesRowDespiteDependencies()
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

        var response = await controller.Delete(
            "applicant-categories",
            "CAT-02",
            force: true,
            TestContext.Current.CancellationToken);

        var ok = Assert.IsType<OkObjectResult>(response.Result);
        var body = Assert.IsType<DeleteLookupRowResult>(ok.Value);
        Assert.True(body.Deleted);
        Assert.False(await db.LookupRows.AnyAsync(
            x => x.LookupKey == "applicant-categories" && x.Code == "CAT-02",
            TestContext.Current.CancellationToken));
        Assert.True(await db.LookupRows.AnyAsync(
            x => x.LookupKey == "announcements" && x.Code == "ANN-01",
            TestContext.Current.CancellationToken));
    }

    private static AdminDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AdminDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new AdminDbContext(options);
    }

    private static void SeedLookup(AdminDbContext db, string key, string code, string name, JsonObject? extra = null)
    {
        var payload = extra is null ? [] : LookupJson.Clone(extra);
        payload["code"] = code;
        payload["name"] = name;
        payload["isActive"] = true;
        var now = DateTimeOffset.UtcNow;
        db.LookupRows.Add(new LookupRowEntity
        {
            LookupKey = key,
            Code = code,
            Name = name,
            IsActive = true,
            PayloadJson = payload.ToJsonString(LookupJson.Options),
            CreatedAt = now,
            UpdatedAt = now
        });
    }
}
