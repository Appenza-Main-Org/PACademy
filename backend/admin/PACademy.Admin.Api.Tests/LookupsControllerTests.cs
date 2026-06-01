using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging.Abstractions;
using PACademy.Admin.Api.Controllers;
using PACademy.Admin.Api.Modules.Lookups;
using PACademy.Admin.Api.Persistence;

namespace PACademy.Admin.Api.Tests;

public sealed class LookupsControllerTests
{
    [Fact]
    public async Task GovernorateCreateAndEditUseNationalIdCodeAsLookupCode()
    {
        await using var db = CreateDb();
        var service = new LookupsService(db, new LookupRowValidator());
        var controller = new LookupsController(service);

        var createdResponse = await controller.Create(
            "governorates",
            new JsonObject
            {
                ["code"] = "04",
                ["name"] = "محافظة السويس",
                ["region"] = "القناة",
                ["isActive"] = true
            },
            TestContext.Current.CancellationToken);
        var created = Assert.IsType<CreatedResult>(createdResponse.Result);
        var createdBody = Assert.IsType<JsonObject>(created.Value);

        Assert.Equal("04", createdBody["code"]?.GetValue<string>());
        Assert.Equal("04", createdBody["nationalIdCode"]?.GetValue<string>());
        SeedLookup(db, "police-stations", "PST-SUEZ", "قسم السويس", new JsonObject
        {
            ["governorateCode"] = "04",
            ["kind"] = "قسم"
        });
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);

        var updatedResponse = await controller.Update(
            "governorates",
            "04",
            new JsonObject
            {
                ["code"] = "24",
                ["name"] = "محافظة المنيا",
                ["region"] = "الوجه القبلي",
                ["isActive"] = true
            },
            TestContext.Current.CancellationToken);
        var updated = Assert.IsType<OkObjectResult>(updatedResponse.Result);
        var updatedBody = Assert.IsType<JsonObject>(updated.Value);

        Assert.Equal("24", updatedBody["code"]?.GetValue<string>());
        Assert.Equal("24", updatedBody["nationalIdCode"]?.GetValue<string>());
        var station = await db.LookupRows.SingleAsync(
            x => x.LookupKey == "police-stations" && x.Code == "PST-SUEZ",
            TestContext.Current.CancellationToken);
        Assert.Equal("24", LookupJson.StringProp(LookupJson.ParseObject(station.PayloadJson), "governorateCode"));
        Assert.False(await db.LookupRows.AnyAsync(
            x => x.LookupKey == "governorates" && x.Code == "04",
            TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task SeederSynchronizesGovernoratesToNationalIdCodes()
    {
        await using var db = CreateDb();
        SeedLookup(db, "governorates", "GOV-14", "المنيا", new JsonObject { ["region"] = "الوجه القبلي" });
        SeedLookup(db, "governorates", "GOV-22", "السويس", new JsonObject { ["region"] = "القناة" });
        SeedLookup(db, "police-stations", "PST-1", "قسم المنيا", new JsonObject
        {
            ["governorateCode"] = "GOV-14",
            ["kind"] = "قسم"
        });
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        var seeder = new LookupsSeeder(new StubWebHostEnvironment(), NullLogger<LookupsSeeder>.Instance);

        await seeder.SeedAsync(db, TestContext.Current.CancellationToken);

        var minya = await db.LookupRows.SingleAsync(
            x => x.LookupKey == "governorates" && x.Code == "24",
            TestContext.Current.CancellationToken);
        var suez = await db.LookupRows.SingleAsync(
            x => x.LookupKey == "governorates" && x.Code == "04",
            TestContext.Current.CancellationToken);
        var station = await db.LookupRows.SingleAsync(
            x => x.LookupKey == "police-stations" && x.Code == "PST-1",
            TestContext.Current.CancellationToken);
        var stationPayload = LookupJson.ParseObject(station.PayloadJson);

        Assert.Equal("محافظة المنيا", minya.Name);
        Assert.Equal("محافظة السويس", suez.Name);
        Assert.Equal("24", LookupJson.StringProp(stationPayload, "governorateCode"));
        Assert.False(await db.LookupRows.AnyAsync(
            x => x.LookupKey == "governorates" && x.Code.StartsWith("GOV-"),
            TestContext.Current.CancellationToken));
    }

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

    private sealed class StubWebHostEnvironment : IWebHostEnvironment
    {
        public string ApplicationName { get; set; } = "PACademy.Admin.Api.Tests";
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
        public string ContentRootPath { get; set; } = Directory.GetCurrentDirectory();
        public string EnvironmentName { get; set; } = "Development";
        public string WebRootPath { get; set; } = Directory.GetCurrentDirectory();
        public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
    }
}
