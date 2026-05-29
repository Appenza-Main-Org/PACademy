using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using PACademy.Admin.Api.Controllers;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Persistence;
using PACademy.Shared.Audit;

namespace PACademy.Admin.Api.Tests;

public sealed class GradesControllerTests
{
    [Fact]
    public async Task CommitV2UpdatesExistingGradeMatchedBySeatingNumberWhenNationalIdDiffers()
    {
        await using var db = CreateDb();
        var records = new AdminRecordsService(db, new HttpContextAccessor(), new NullAuditSink());
        await SeedGradeAsync(
            records,
            seat: 1,
            seatingNumber: "1000992",
            nid: "30601232335315",
            name: "عمرو عبدالرحمن عبدالرحمن النجار",
            total: 665);
        var controller = CreateController(db, records);
        var body = new JsonObject
        {
            ["graduationYear"] = 2026,
            ["selectedSchoolCategories"] = new JsonArray("SCH-03"),
            ["maxGradeByCategory"] = new JsonObject { ["SCH-03"] = 700d },
            ["existingDiffDecisions"] = new JsonObject { ["30601200000000"] = "accept" },
            ["rows"] = new JsonArray
            {
                new JsonObject
                {
                    ["nationalId"] = "30601200000000",
                    ["seatingNumber"] = "1000992",
                    ["nameAr"] = "عمرو عبدالرحمن عبدالرحمن النجار",
                    ["totalGrade"] = 346d,
                    ["maxGrade"] = 700d,
                    ["schoolCategory"] = "SCH-03",
                    ["track"] = "الأدبى",
                    ["schoolName"] = "شبرا الخازندارة",
                    ["regionName"] = "القاهرة",
                    ["sourceRowIndex"] = 1
                }
            }
        };

        var response = await controller.CommitV2(body, TestContext.Current.CancellationToken);

        var ok = Assert.IsType<OkObjectResult>(response.Result);
        var result = JsonSerializer.SerializeToNode(ok.Value)?.AsObject();
        Assert.Equal(1, result?["insertedCount"]?.GetValue<int>());
        var rows = await records.ListAsync("grades", TestContext.Current.CancellationToken);
        var row = Assert.Single(rows);
        var payload = row;
        Assert.Equal(346, AdminRecordJson.NumberProp(payload, "total"));
        Assert.Equal("30601232335315", AdminRecordJson.StringProp(payload, "nid"));
        Assert.Equal(665, AdminRecordJson.NumberProp(payload, "previousGrade"));
    }

    private static AdminDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AdminDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new AdminDbContext(options);
    }

    private static GradesController CreateController(AdminDbContext db, AdminRecordsService? records = null)
    {
        records ??= new AdminRecordsService(db, new HttpContextAccessor(), new NullAuditSink());
        var controller = new GradesController(records, db, new MemoryCache(new MemoryCacheOptions()))
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };
        return controller;
    }

    private static async Task SeedGradeAsync(
        AdminRecordsService records,
        int seat,
        string seatingNumber,
        string nid,
        string name,
        double total)
    {
        await records.UpsertAsync("grades", seat.ToString(), new JsonObject
            {
                ["id"] = seat.ToString(),
                ["seat"] = seat,
                ["seatingNumber"] = seatingNumber,
                ["nid"] = nid,
                ["name"] = name,
                ["kind"] = "azhar",
                ["gender"] = "male",
                ["branch"] = "الشعبة العلمية - رياضيات",
                ["graduationYear"] = 2026,
                ["schoolCategoryCode"] = "SCH-03",
                ["school"] = "المتفوقين للعلوم والتكنولوجيا ث م بنين بشمال الاسماعيلية",
                ["region"] = "شمال الاسماعيلية",
                ["examRound"] = null,
                ["total"] = total,
                ["importMax"] = 700,
                ["overrideMax"] = null,
                ["lastEditedAt"] = null,
                ["lastEditedBy"] = null,
                ["gradeChangedAt"] = null,
                ["previousGrade"] = null,
                ["status"] = "مستجد",
                ["log"] = new JsonArray()
            }, TestContext.Current.CancellationToken);
    }
}
