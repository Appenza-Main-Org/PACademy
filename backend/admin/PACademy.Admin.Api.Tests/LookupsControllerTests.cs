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
    public async Task GovernorateCreateAndEditUseCodeOnlyForNationalIdCode()
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
                ["isActive"] = true
            },
            TestContext.Current.CancellationToken);
        var created = Assert.IsType<CreatedResult>(createdResponse.Result);
        var createdBody = Assert.IsType<JsonObject>(created.Value);

        Assert.Equal("04", createdBody["code"]?.GetValue<string>());
        Assert.False(createdBody.ContainsKey("nationalIdCode"));
        Assert.False(createdBody.ContainsKey("region"));
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
                ["isActive"] = true
            },
            TestContext.Current.CancellationToken);
        var updated = Assert.IsType<OkObjectResult>(updatedResponse.Result);
        var updatedBody = Assert.IsType<JsonObject>(updated.Value);

        Assert.Equal("24", updatedBody["code"]?.GetValue<string>());
        Assert.False(updatedBody.ContainsKey("nationalIdCode"));
        Assert.False(updatedBody.ContainsKey("region"));
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
        SeedLookup(db, "governorates", "GOV-14", "المنيا", new JsonObject
        {
            ["region"] = "الوجه القبلي",
            ["nationalIdCode"] = "24"
        });
        SeedLookup(db, "governorates", "GOV-22", "السويس", new JsonObject
        {
            ["region"] = "القناة",
            ["nationalIdCode"] = "04"
        });
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
        var officialCodes = await db.LookupRows
            .Where(x => x.LookupKey == "governorates")
            .OrderBy(x => x.Code)
            .Select(x => x.Code)
            .ToListAsync(TestContext.Current.CancellationToken);

        Assert.Equal(
            [
                "01", "02", "03", "04",
                "11", "12", "13", "14", "15", "16", "17", "18", "19",
                "21", "22", "23", "24", "25", "26", "27", "28", "29",
                "31", "32", "33", "34", "35",
                "88"
            ],
            officialCodes);
        Assert.Equal("محافظة المنيا", minya.Name);
        Assert.Equal("محافظة السويس", suez.Name);
        var minyaPayload = LookupJson.ParseObject(minya.PayloadJson);
        var suezPayload = LookupJson.ParseObject(suez.PayloadJson);
        Assert.Equal("24", LookupJson.StringProp(minyaPayload, "code"));
        Assert.Equal("04", LookupJson.StringProp(suezPayload, "code"));
        Assert.False(minyaPayload.ContainsKey("nationalIdCode"));
        Assert.False(minyaPayload.ContainsKey("region"));
        Assert.False(suezPayload.ContainsKey("nationalIdCode"));
        Assert.False(suezPayload.ContainsKey("region"));
        Assert.Equal("24", LookupJson.StringProp(stationPayload, "governorateCode"));
        Assert.False(await db.LookupRows.AnyAsync(
            x => x.LookupKey == "governorates" && x.Code.StartsWith("GOV-"),
            TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task ListGovernoratesNormalizesLegacyGovCodesBeforeReturning()
    {
        await using var db = CreateDb();
        SeedLookup(db, "governorates", "GOV-19", "محافظة أسوان", new JsonObject
        {
            ["region"] = "الوجه القبلي",
            ["nationalIdCode"] = "28"
        });
        SeedLookup(db, "police-stations", "PST-ASWAN", "قسم أسوان", new JsonObject
        {
            ["governorateCode"] = "GOV-19",
            ["kind"] = "قسم"
        });
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        var service = new LookupsService(db, new LookupRowValidator());

        var rows = await service.ListAsync("governorates", null, null, TestContext.Current.CancellationToken);

        Assert.DoesNotContain(rows, row => LookupJson.StringProp(row, "code")?.StartsWith("GOV-", StringComparison.OrdinalIgnoreCase) == true);
        Assert.Contains(rows, row =>
            LookupJson.StringProp(row, "code") == "28" &&
            LookupJson.StringProp(row, "name") == "محافظة أسوان");
        Assert.Contains(rows, row =>
            LookupJson.StringProp(row, "code") == "19" &&
            LookupJson.StringProp(row, "name") == "محافظة الإسماعيلية");
        var station = await db.LookupRows.SingleAsync(
            x => x.LookupKey == "police-stations" && x.Code == "PST-ASWAN",
            TestContext.Current.CancellationToken);
        Assert.Equal("28", LookupJson.StringProp(LookupJson.ParseObject(station.PayloadJson), "governorateCode"));
    }

    [Fact]
    public async Task ListPoliceStationsNormalizesLegacyGovernorateRefsBeforeReturning()
    {
        await using var db = CreateDb();
        SeedLookup(db, "police-stations", "PST-MINYA", "قسم المنيا", new JsonObject
        {
            ["governorateCode"] = "GOV-14",
            ["kind"] = "قسم"
        });
        SeedLookup(db, "police-stations", "PST-ASWAN", "قسم أسوان", new JsonObject
        {
            ["governorateCode"] = "GOV-19",
            ["kind"] = "قسم"
        });
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        var service = new LookupsService(db, new LookupRowValidator());

        var rows = await service.ListAsync("police-stations", null, null, TestContext.Current.CancellationToken);

        Assert.Contains(rows, row =>
            LookupJson.StringProp(row, "code") == "PST-MINYA" &&
            LookupJson.StringProp(row, "governorateCode") == "24");
        Assert.Contains(rows, row =>
            LookupJson.StringProp(row, "code") == "PST-ASWAN" &&
            LookupJson.StringProp(row, "governorateCode") == "28");
        Assert.DoesNotContain(rows, row =>
            LookupJson.StringProp(row, "governorateCode")?.StartsWith("GOV-", StringComparison.OrdinalIgnoreCase) == true);
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
