using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Modules.Audit;
using PACademy.Admin.Api.Modules.DataExchangeAdmin;
using PACademy.Admin.Api.Modules.Lookups;
using PACademy.Admin.Api.Persistence;
using PACademy.Shared.Persistence.ChangeTracking;

namespace PACademy.Admin.Api.Tests;

public sealed class DataExchangeServiceTests
{
    private static (DataExchangeService svc, AdminDbContext db) Create()
    {
        var options = new DbContextOptionsBuilder<AdminDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .AddInterceptors(new ChangeTrackingInterceptor(new SystemActorProvider()))
            .Options;
        var db = new AdminDbContext(options);
        var svc = new DataExchangeService(db, new DbAuditSink(db), new SystemActorProvider());
        return (svc, db);
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

    [Fact]
    public async Task Export_emits_tracking_columns_and_checksum()
    {
        var (svc, db) = Create();
        await SeedLookupAsync(db, "EXC-01", "ممتاز");

        var result = await svc.ExportAsync([ExchangeDomain.SystemCodes], "single-workbook", ExportFilter.Default, default);

        var sheet = Assert.Single(result.Sheets);
        Assert.Equal("SystemCodes", sheet.SheetName);
        Assert.Single(sheet.Rows);
        foreach (var col in new[] { "id", "business_key", "created_at", "updated_at", "row_version", "last_modified_by", "source_system", "checksum" })
            Assert.Contains(col, sheet.Columns);
        var row = sheet.Rows[0];
        Assert.Equal("academic-grades|EXC-01", row["business_key"]);
        Assert.False(string.IsNullOrEmpty(row["checksum"]));
    }

    [Fact]
    public async Task Preview_classifies_unchanged_as_skipped_and_edited_as_changed()
    {
        var (svc, db) = Create();
        await SeedLookupAsync(db, "EXC-01", "ممتاز");
        await SeedLookupAsync(db, "EXC-02", "جيد جداً");
        var export = await svc.ExportAsync([ExchangeDomain.SystemCodes], "single-workbook", ExportFilter.Default, default);
        var rows = AsImportRows(export.Sheets[0]);

        // Edit one row's name (offline cell edit — checksum cell untouched).
        rows[0]["name"] = "ممتاز (معدّل)";
        rows[0]["payload_json"] = """{"code":"EXC-01","name":"ممتاز (معدّل)"}""";
        // Add a brand-new row.
        rows.Add(new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            ["id"] = "academic-grades|EXC-09", ["business_key"] = "academic-grades|EXC-09",
            ["lookup_key"] = "academic-grades", ["code"] = "EXC-09", ["name"] = "مقبول",
            ["is_active"] = "true", ["payload_json"] = """{"code":"EXC-09","name":"مقبول"}""",
        });

        var preview = await svc.PreviewAsync(new ImportPreviewRequest([new("SystemCodes", rows)]), default);

        Assert.Equal(1, preview.Counts["changed"]);
        Assert.Equal(1, preview.Counts["skipped"]);
        Assert.Equal(1, preview.Counts["new"]);
        Assert.Equal(0, preview.Counts["invalid"]);
    }

    [Fact]
    public async Task Apply_new_and_changed_inserts_and_updates_and_never_duplicates_keys()
    {
        var (svc, db) = Create();
        await SeedLookupAsync(db, "EXC-01", "ممتاز");
        var export = await svc.ExportAsync([ExchangeDomain.SystemCodes], "single-workbook", ExportFilter.Default, default);
        var rows = AsImportRows(export.Sheets[0]);
        rows[0]["name"] = "ممتاز (معدّل)";
        rows[0]["payload_json"] = """{"code":"EXC-01","name":"ممتاز (معدّل)"}""";
        rows.Add(new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            ["id"] = "academic-grades|EXC-09", ["business_key"] = "academic-grades|EXC-09",
            ["lookup_key"] = "academic-grades", ["code"] = "EXC-09", ["name"] = "مقبول",
            ["is_active"] = "true", ["payload_json"] = """{"code":"EXC-09","name":"مقبول"}""",
        });

        var apply = await svc.ApplyAsync(
            new ImportApplyRequest([new("SystemCodes", rows)], "new-and-changed", SkipConflicts: false, ForceUpdate: false), default);

        Assert.Equal(1, apply.InsertedCount);
        Assert.Equal(1, apply.UpdatedCount);
        Assert.Equal(0, apply.FailedCount);
        Assert.Equal("ممتاز (معدّل)", db.LookupRows.Single(x => x.Code == "EXC-01").Name);
        Assert.Equal(2, db.LookupRows.Count());

        // Re-apply the SAME workbook → no new rows; the edited row is now Skipped.
        var apply2 = await svc.ApplyAsync(
            new ImportApplyRequest([new("SystemCodes", rows)], "new-and-changed", SkipConflicts: false, ForceUpdate: false), default);
        Assert.Equal(0, apply2.InsertedCount);
        Assert.Equal(2, db.LookupRows.Count()); // still 2 — key never duplicated
    }

    [Fact]
    public async Task Apply_new_only_skips_changed_rows()
    {
        var (svc, db) = Create();
        await SeedLookupAsync(db, "EXC-01", "ممتاز");
        var export = await svc.ExportAsync([ExchangeDomain.SystemCodes], "single-workbook", ExportFilter.Default, default);
        var rows = AsImportRows(export.Sheets[0]);
        rows[0]["name"] = "تغيير";
        rows[0]["payload_json"] = """{"code":"EXC-01","name":"تغيير"}""";

        var apply = await svc.ApplyAsync(
            new ImportApplyRequest([new("SystemCodes", rows)], "new-only", SkipConflicts: false, ForceUpdate: false), default);

        Assert.Equal(0, apply.InsertedCount);
        Assert.Equal(0, apply.UpdatedCount);
        Assert.Equal(1, apply.SkippedCount);
        Assert.Equal("ممتاز", db.LookupRows.Single().Name); // unchanged
    }

    [Fact]
    public async Task Intra_file_duplicate_key_is_invalid()
    {
        var (svc, _) = Create();
        var dup = new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            ["id"] = "academic-grades|EXC-01", ["business_key"] = "academic-grades|EXC-01",
            ["lookup_key"] = "academic-grades", ["code"] = "EXC-01", ["name"] = "ممتاز",
            ["is_active"] = "true", ["payload_json"] = "{}",
        };
        var rows = new List<Dictionary<string, string?>> { dup, new(dup, StringComparer.Ordinal) };

        var preview = await svc.PreviewAsync(new ImportPreviewRequest([new("SystemCodes", rows)]), default);

        Assert.Equal(1, preview.Counts["new"]);
        Assert.Equal(1, preview.Counts["invalid"]); // the second occurrence
    }

    [Fact]
    public async Task Outdated_row_held_unless_force_update()
    {
        var (svc, db) = Create();
        await SeedLookupAsync(db, "EXC-01", "ممتاز");
        var export = await svc.ExportAsync([ExchangeDomain.SystemCodes], "single-workbook", ExportFilter.Default, default);
        var rows = AsImportRows(export.Sheets[0]);
        rows[0]["name"] = "محاولة قديمة";
        rows[0]["payload_json"] = """{"code":"EXC-01","name":"محاولة قديمة"}""";

        // DB row changes AFTER the export snapshot → DB is newer than the import.
        var dbRow = db.LookupRows.Single();
        dbRow.UpdatedAt = DateTimeOffset.UtcNow.AddHours(1);
        dbRow.Name = "تحديث أحدث";
        await db.SaveChangesAsync();

        var preview = await svc.PreviewAsync(new ImportPreviewRequest([new("SystemCodes", rows)]), default);
        Assert.Equal(1, preview.Counts["outdated"]);

        // Without forceUpdate → held.
        var held = await svc.ApplyAsync(
            new ImportApplyRequest([new("SystemCodes", rows)], "new-and-changed", SkipConflicts: false, ForceUpdate: false), default);
        Assert.Equal(0, held.UpdatedCount);
        Assert.Equal("تحديث أحدث", db.LookupRows.Single().Name);

        // With forceUpdate → overwrites.
        var forced = await svc.ApplyAsync(
            new ImportApplyRequest([new("SystemCodes", rows)], "new-and-changed", SkipConflicts: false, ForceUpdate: true), default);
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
        var (svc, db) = Create();
        db.AdminRecordDocuments.Add(new AdminRecordDocumentEntity
        {
            Module = "applicants", Id = "APP-1",
            PayloadJson = """{"id":"APP-1","nationalId":"29801011234567"}""",
            CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var badRow = new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            ["id"] = "APP-2", ["business_key"] = "123", ["nationalId"] = "123",
            ["payload_json"] = """{"id":"APP-2","nationalId":"123"}""",
        };
        var preview = await svc.PreviewAsync(new ImportPreviewRequest([new("Applicants", [badRow])]), default);

        Assert.Equal(1, preview.Counts["invalid"]);
    }

    [Fact]
    public async Task DocStore_round_trip_export_then_apply_persists_payload()
    {
        var (svc, db) = Create();
        db.AdminRecordDocuments.Add(new AdminRecordDocumentEntity
        {
            Module = "committees", Id = "CMT-1",
            PayloadJson = """{"id":"CMT-1","name":"لجنة أ","capacity":50}""",
            CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var export = await svc.ExportAsync([ExchangeDomain.Committees], "single-workbook", ExportFilter.Default, default);
        var rows = AsImportRows(export.Sheets[0]);
        rows[0]["payload_json"] = """{"id":"CMT-1","name":"لجنة أ معدلة","capacity":60}""";

        var apply = await svc.ApplyAsync(
            new ImportApplyRequest([new("Committees", rows)], "new-and-changed", SkipConflicts: false, ForceUpdate: false), default);

        Assert.Equal(1, apply.UpdatedCount);
        var saved = db.AdminRecordDocuments.Single(x => x.Module == "committees" && x.Id == "CMT-1");
        Assert.Contains("لجنة أ معدلة", saved.PayloadJson);
        Assert.Equal("data-exchange-import", saved.SourceSystem);
    }

    [Fact]
    public async Task Export_and_apply_write_audit_history()
    {
        var (svc, db) = Create();
        await SeedLookupAsync(db, "EXC-01", "ممتاز");
        await svc.ExportAsync([ExchangeDomain.SystemCodes], "single-workbook", ExportFilter.Default, default);
        await svc.ApplyAsync(new ImportApplyRequest(
            [new("SystemCodes", [new(StringComparer.Ordinal)
            {
                ["id"] = "academic-grades|EXC-09", ["business_key"] = "academic-grades|EXC-09",
                ["lookup_key"] = "academic-grades", ["code"] = "EXC-09", ["name"] = "مقبول",
                ["is_active"] = "true", ["payload_json"] = "{}",
            }])], "new-and-changed", false, false), default);

        var history = await svc.HistoryAsync(default);
        Assert.Equal(2, history.Count);
        Assert.Contains(history, h => h.Action == "export");
        Assert.Contains(history, h => h.Action == "import" && h.Inserted == 1);
    }

    [Fact]
    public async Task ModifiedSinceCreation_filter_only_returns_touched_rows()
    {
        // Seed WITHOUT the interceptor so the hand-set updated_at==created_at on the
        // "never touched" row survives (the interceptor would refresh updated_at).
        var options = new DbContextOptionsBuilder<AdminDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N")).Options;
        var db = new AdminDbContext(options);
        var svc = new DataExchangeService(db, new DbAuditSink(db), new SystemActorProvider());
        var created = DateTimeOffset.UtcNow.AddDays(-3);
        db.LookupRows.Add(new LookupRowEntity
        {
            LookupKey = "academic-grades", Code = "FRESH", Name = "جديد", IsActive = true,
            PayloadJson = "{}", CreatedAt = created, UpdatedAt = created, // never touched
        });
        db.LookupRows.Add(new LookupRowEntity
        {
            LookupKey = "academic-grades", Code = "TOUCHED", Name = "معدّل", IsActive = true,
            PayloadJson = "{}", CreatedAt = created, UpdatedAt = DateTimeOffset.UtcNow, // touched after creation
        });
        await db.SaveChangesAsync();

        var result = await svc.ExportAsync([ExchangeDomain.SystemCodes], "single-workbook",
            new ExportFilter(ExportFilterKind.ModifiedSinceCreation, null, null), default);

        var row = Assert.Single(result.Sheets[0].Rows);
        Assert.Equal("academic-grades|TOUCHED", row["business_key"]);
    }
}
