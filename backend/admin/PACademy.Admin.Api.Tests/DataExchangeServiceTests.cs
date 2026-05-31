using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Modules.Audit;
using PACademy.Admin.Api.Modules.DataExchangeAdmin;
using PACademy.Admin.Api.Modules.Lookups;
using PACademy.Admin.Api.Modules.OperationalRecords;
using PACademy.Admin.Api.Persistence;
using PACademy.Shared.Persistence.ChangeTracking;

namespace PACademy.Admin.Api.Tests;

public sealed class DataExchangeServiceTests
{
    private static DataExchangeService Build(AdminDbContext db)
    {
        var sink = new DbAuditSink(db);
        var records = new OperationalRecordsService(db, new HttpContextAccessor(), sink, new OperationalRecordStore(db));
        return new DataExchangeService(db, records, sink, new SystemActorProvider());
    }

    private static Task SeedOperationalAsync(AdminDbContext db, string module, string id, string payloadJson)
        => new OperationalRecordStore(db).UpsertAsync(module, id, JsonNode.Parse(payloadJson)!.AsObject(), default);

    private static (DataExchangeService svc, AdminDbContext db) Create()
    {
        var options = new DbContextOptionsBuilder<AdminDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .AddInterceptors(new ChangeTrackingInterceptor(new SystemActorProvider()))
            .Options;
        var db = new AdminDbContext(options);
        return (Build(db), db);
    }

    private static async Task SeedLookupAsync(AdminDbContext db, string code, string name)
    {
        db.LookupRows.Add(new LookupRowEntity
        {
            LookupKey = "academic-grades", Code = code, Name = name, IsActive = true,
            PayloadJson = $$"""{"code":"{{code}}","name":"{{name}}"}""",
            CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();
    }

    private static List<Dictionary<string, string?>> AsImportRows(ExportSheetDto sheet)
        => sheet.Rows.Select(r => new Dictionary<string, string?>(r, StringComparer.Ordinal)).ToList();

    private static Dictionary<string, string?> NewLookupRow(string code, string name) => new(StringComparer.Ordinal)
    {
        ["id"] = $"academic-grades|{code}", ["business_key"] = $"academic-grades|{code}",
        ["lookup_key"] = "academic-grades", ["code"] = code, ["name"] = name, ["is_active"] = "true",
    };

    [Fact]
    public async Task Export_emits_normalized_columns_not_payload_json()
    {
        var (svc, db) = Create();
        await SeedLookupAsync(db, "EXC-01", "ممتاز");
        var result = await svc.ExportAsync([ExchangeDomain.SystemCodes], "single-workbook", ExportFilter.Default, default);

        var sheet = Assert.Single(result.Sheets);
        Assert.DoesNotContain("payload_json", sheet.Columns);             // normalized — no JSON blob column
        foreach (var col in new[] { "id", "business_key", "lookup_key", "code", "name", "is_active", "checksum" })
            Assert.Contains(col, sheet.Columns);
        Assert.Equal("academic-grades|EXC-01", sheet.Rows[0]["business_key"]);
        Assert.Equal("ممتاز", sheet.Rows[0]["name"]);
        Assert.False(string.IsNullOrEmpty(sheet.Rows[0]["checksum"]));
    }

    [Fact]
    public async Task DocStore_payload_flattens_into_columns()
    {
        var (svc, db) = Create();
        await SeedOperationalAsync(db, "applicants", "APP-1",
            """{"id":"APP-1","nationalId":"29801011234567","fullName":"متقدم","address":{"governorate":"القاهرة"}}""");

        var result = await svc.ExportAsync([ExchangeDomain.Applicants], "single-workbook", ExportFilter.Default, default);
        var sheet = result.Sheets[0];

        Assert.Contains("nationalId", sheet.Columns);
        Assert.Contains("fullName", sheet.Columns);
        Assert.Contains("address.governorate", sheet.Columns);            // nested → dotted column
        Assert.DoesNotContain("payload_json", sheet.Columns);
        Assert.Equal(1, sheet.Columns.Count(c => c == "id"));             // no duplicate id column
        Assert.Equal("القاهرة", sheet.Rows[0]["address.governorate"]);
        Assert.Equal("29801011234567", sheet.Rows[0]["business_key"]);    // business key from nationalId
    }

    [Fact]
    public async Task Preview_classifies_unchanged_skipped_edited_changed_new_new()
    {
        var (svc, db) = Create();
        await SeedLookupAsync(db, "EXC-01", "ممتاز");
        await SeedLookupAsync(db, "EXC-02", "جيد جداً");
        var export = await svc.ExportAsync([ExchangeDomain.SystemCodes], "single-workbook", ExportFilter.Default, default);
        var rows = AsImportRows(export.Sheets[0]);

        rows[0]["name"] = "ممتاز (معدّل)";                                 // edited normalized column → Changed
        rows.Add(NewLookupRow("EXC-09", "مقبول"));                         // New

        var preview = await svc.PreviewAsync(new ImportPreviewRequest([new("SystemCodes", rows)]), default);

        Assert.Equal(1, preview.Counts["changed"]);
        Assert.Equal(1, preview.Counts["skipped"]);
        Assert.Equal(1, preview.Counts["new"]);
        Assert.Equal(0, preview.Counts["invalid"]);
    }

    [Fact]
    public async Task Apply_new_and_changed_inserts_updates_and_never_duplicates_keys()
    {
        var (svc, db) = Create();
        await SeedLookupAsync(db, "EXC-01", "ممتاز");
        var export = await svc.ExportAsync([ExchangeDomain.SystemCodes], "single-workbook", ExportFilter.Default, default);
        var rows = AsImportRows(export.Sheets[0]);
        rows[0]["name"] = "ممتاز (معدّل)";
        rows.Add(NewLookupRow("EXC-09", "مقبول"));

        var apply = await svc.ApplyAsync(new ImportApplyRequest([new("SystemCodes", rows)], "new-and-changed", false, false), default);

        Assert.Equal(1, apply.InsertedCount);
        Assert.Equal(1, apply.UpdatedCount);
        Assert.Equal(0, apply.FailedCount);
        Assert.Equal("ممتاز (معدّل)", db.LookupRows.Single(x => x.Code == "EXC-01").Name);
        Assert.Equal(2, db.LookupRows.Count());

        var apply2 = await svc.ApplyAsync(new ImportApplyRequest([new("SystemCodes", rows)], "new-and-changed", false, false), default);
        Assert.Equal(0, apply2.InsertedCount);
        Assert.Equal(2, db.LookupRows.Count()); // key never duplicated
    }

    [Fact]
    public async Task Apply_new_only_skips_changed_rows()
    {
        var (svc, db) = Create();
        await SeedLookupAsync(db, "EXC-01", "ممتاز");
        var export = await svc.ExportAsync([ExchangeDomain.SystemCodes], "single-workbook", ExportFilter.Default, default);
        var rows = AsImportRows(export.Sheets[0]);
        rows[0]["name"] = "تغيير";

        var apply = await svc.ApplyAsync(new ImportApplyRequest([new("SystemCodes", rows)], "new-only", false, false), default);

        Assert.Equal(0, apply.InsertedCount);
        Assert.Equal(1, apply.SkippedCount);
        Assert.Equal("ممتاز", db.LookupRows.Single().Name);
    }

    [Fact]
    public async Task Intra_file_duplicate_key_is_invalid()
    {
        var (svc, _) = Create();
        var dup = NewLookupRow("EXC-01", "ممتاز");
        var rows = new List<Dictionary<string, string?>> { dup, new(dup, StringComparer.Ordinal) };

        var preview = await svc.PreviewAsync(new ImportPreviewRequest([new("SystemCodes", rows)]), default);

        Assert.Equal(1, preview.Counts["new"]);
        Assert.Equal(1, preview.Counts["invalid"]);
    }

    [Fact]
    public async Task Outdated_row_held_unless_force_update()
    {
        var (svc, db) = Create();
        await SeedLookupAsync(db, "EXC-01", "ممتاز");
        var export = await svc.ExportAsync([ExchangeDomain.SystemCodes], "single-workbook", ExportFilter.Default, default);
        var rows = AsImportRows(export.Sheets[0]);
        rows[0]["name"] = "محاولة قديمة";

        var dbRow = db.LookupRows.Single();
        dbRow.UpdatedAt = DateTimeOffset.UtcNow.AddHours(1);
        dbRow.Name = "تحديث أحدث";
        await db.SaveChangesAsync();

        var preview = await svc.PreviewAsync(new ImportPreviewRequest([new("SystemCodes", rows)]), default);
        Assert.Equal(1, preview.Counts["outdated"]);

        var held = await svc.ApplyAsync(new ImportApplyRequest([new("SystemCodes", rows)], "new-and-changed", false, false), default);
        Assert.Equal(0, held.UpdatedCount);
        Assert.Equal("تحديث أحدث", db.LookupRows.Single().Name);

        var forced = await svc.ApplyAsync(new ImportApplyRequest([new("SystemCodes", rows)], "new-and-changed", false, true), default);
        Assert.Equal(1, forced.UpdatedCount);
        Assert.Equal("محاولة قديمة", db.LookupRows.Single().Name);
    }

    [Fact]
    public async Task Unknown_sheet_name_is_reported_as_file_level_issue()
    {
        var (svc, _) = Create();
        var preview = await svc.PreviewAsync(new ImportPreviewRequest(
            [new("NotARealSheet", [new(StringComparer.Ordinal) { ["id"] = "x" }])]), default);

        var issue = Assert.Single(preview.SheetIssues);
        Assert.Equal("NotARealSheet", issue.SheetName);
        Assert.Empty(preview.Rows);
    }

    [Fact]
    public async Task Applicant_invalid_national_id_is_invalid()
    {
        var (svc, _) = Create();
        var badRow = new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            ["id"] = "APP-2", ["business_key"] = "123", ["nationalId"] = "123",
        };
        var preview = await svc.PreviewAsync(new ImportPreviewRequest([new("Applicants", [badRow])]), default);

        Assert.Equal(1, preview.Counts["invalid"]);
    }

    [Fact]
    public async Task DocStore_round_trip_preserves_types_and_persists_edits()
    {
        var (svc, db) = Create();
        await SeedOperationalAsync(db, "committeeInstances", "CMT-1",
            """{"id":"CMT-1","name":"لجنة أ","capacity":50,"active":true}""");

        var export = await svc.ExportAsync([ExchangeDomain.Committees], "single-workbook", ExportFilter.Default, default);
        var rows = AsImportRows(export.Sheets[0]);
        rows[0]["name"] = "لجنة أ معدلة";       // edit string column
        rows[0]["capacity"] = "60";             // edit numeric column

        var apply = await svc.ApplyAsync(new ImportApplyRequest([new("Committees", rows)], "new-and-changed", false, false), default);

        Assert.Equal(1, apply.UpdatedCount);
        var p = (await new OperationalRecordStore(db).GetAsync("committeeInstances", "CMT-1", default))!;
        Assert.Equal("لجنة أ معدلة", p["name"]!.GetValue<string>());           // edit persisted
        Assert.Equal(60, p["capacity"]!.GetValue<int>());                       // stayed a NUMBER (type-safe), not "60"
        Assert.True(p["active"]!.GetValue<bool>());                             // untouched field preserved with type
        Assert.Equal("data-exchange-import", p["sourceSystem"]!.GetValue<string>());
    }

    [Fact]
    public async Task Export_and_apply_write_audit_history()
    {
        var (svc, db) = Create();
        await SeedLookupAsync(db, "EXC-01", "ممتاز");
        await svc.ExportAsync([ExchangeDomain.SystemCodes], "single-workbook", ExportFilter.Default, default);
        await svc.ApplyAsync(new ImportApplyRequest(
            [new("SystemCodes", [NewLookupRow("EXC-09", "مقبول")])], "new-and-changed", false, false), default);

        var history = await svc.HistoryAsync(default);
        Assert.Equal(2, history.Count);
        Assert.Contains(history, h => h.Action == "export");
        Assert.Contains(history, h => h.Action == "import" && h.Inserted == 1);
    }

    [Fact]
    public async Task ModifiedSinceCreation_filter_only_returns_touched_rows()
    {
        var options = new DbContextOptionsBuilder<AdminDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N")).Options;
        var db = new AdminDbContext(options);
        var svc = Build(db);
        var created = DateTimeOffset.UtcNow.AddDays(-3);
        db.LookupRows.Add(new LookupRowEntity
        {
            LookupKey = "academic-grades", Code = "FRESH", Name = "جديد", IsActive = true,
            PayloadJson = "{}", CreatedAt = created, UpdatedAt = created,
        });
        db.LookupRows.Add(new LookupRowEntity
        {
            LookupKey = "academic-grades", Code = "TOUCHED", Name = "معدّل", IsActive = true,
            PayloadJson = "{}", CreatedAt = created, UpdatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var result = await svc.ExportAsync([ExchangeDomain.SystemCodes], "single-workbook",
            new ExportFilter(ExportFilterKind.ModifiedSinceCreation, null, null), default);

        var row = Assert.Single(result.Sheets[0].Rows);
        Assert.Equal("academic-grades|TOUCHED", row["business_key"]);
    }
}
