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
        // status `exam_scheduled` clears the applicant export-eligibility gate
        // (first exam appointment booked) so the row is included in the export.
        await SeedOperationalAsync(db, "applicants", "APP-1",
            """{"id":"APP-1","nationalId":"29801011234567","fullName":"متقدم","status":"exam_scheduled","address":{"governorate":"القاهرة"}}""");

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
    public async Task Reconcile_preview_returns_field_diffs_matched_unmatched_and_writeback()
    {
        var (svc, db) = Create();
        db.LookupRows.Add(new LookupRowEntity
        {
            LookupKey = "test-results", Code = "RES-01", Name = "ناجح", IsActive = true,
            PayloadJson = """{"code":"RES-01","name":"ناجح","outcome":"pass"}""",
            CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow,
        });
        db.LookupRows.Add(new LookupRowEntity
        {
            LookupKey = "test-results", Code = "RES-02", Name = "راسب", IsActive = true,
            PayloadJson = """{"code":"RES-02","name":"راسب","outcome":"fail"}""",
            CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();
        await SeedOperationalAsync(db, "applicants", "APP-1",
            """{"id":"APP-1","nationalId":"29801011230501","fullName":"اسم قديم","gender":"male","status":"exam_scheduled"}""");

        var matchedRow = new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            ["nationalId"] = "29801011230501",
            ["fullName"] = "اسم مُصحَّح",
            ["gender"] = "male",
            ["result"] = "ناجح",
            ["next_exam_date"] = "2026-07-01",
            ["round"] = "1",
            ["test_code"] = "TST-01",
        };
        var unmatchedRow = new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            ["nationalId"] = "29801011239999",
            ["fullName"] = "غير معروف",
            ["result"] = "راسب",
        };

        var preview = await svc.PreviewApplicantsReconciliationAsync(
            new ImportSheetInput("Applicants", new List<Dictionary<string, string?>> { matchedRow, unmatchedRow }), default);

        Assert.Equal(2, preview.Rows.Count);
        Assert.Equal(1, preview.Counts["matched"]);
        Assert.Equal(1, preview.Counts["unmatched"]);

        var matched = preview.Rows[0];
        Assert.False(matched.Unmatched);
        var nameDiff = Assert.Single(matched.FieldDiffs.Where(d => d.Field == "fullName"));
        Assert.Equal("اسم قديم", nameDiff.Before);
        Assert.Equal("اسم مُصحَّح", nameDiff.After);
        Assert.DoesNotContain(matched.FieldDiffs, d => d.Field == "gender");
        Assert.Equal("passed", matched.Writeback?.Outcome);
        Assert.Equal("2026-07-01", matched.Writeback?.NextExamDate);
        Assert.Equal("TST-01", matched.Writeback?.TestCode);
        Assert.Equal(1, matched.Writeback?.Round);

        var unmatched = preview.Rows[1];
        Assert.True(unmatched.Unmatched);
        Assert.Contains("APPLICANT_NID_UNMATCHED", unmatched.Errors);
    }

    [Fact]
    public async Task Reconcile_preview_unknown_result_value_records_typed_error()
    {
        var (svc, db) = Create();
        db.LookupRows.Add(new LookupRowEntity
        {
            LookupKey = "test-results", Code = "RES-01", Name = "ناجح", IsActive = true,
            PayloadJson = """{"code":"RES-01","name":"ناجح","outcome":"pass"}""",
            CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();
        await SeedOperationalAsync(db, "applicants", "APP-2",
            """{"id":"APP-2","nationalId":"29801011230701","status":"exam_scheduled"}""");

        var preview = await svc.PreviewApplicantsReconciliationAsync(
            new ImportSheetInput("Applicants", new List<Dictionary<string, string?>>
            {
                new(StringComparer.Ordinal) { ["nationalId"] = "29801011230701", ["result"] = "متذبذب" },
            }), default);

        Assert.Contains("RESULT_VALUE_UNKNOWN", preview.Rows[0].Writeback!.Errors);
    }

    [Fact]
    public async Task Reconcile_preview_passed_without_next_exam_date_flags_missing()
    {
        var (svc, db) = Create();
        db.LookupRows.Add(new LookupRowEntity
        {
            LookupKey = "test-results", Code = "RES-01", Name = "ناجح", IsActive = true,
            PayloadJson = """{"code":"RES-01","name":"ناجح","outcome":"pass"}""",
            CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();
        await SeedOperationalAsync(db, "applicants", "APP-3",
            """{"id":"APP-3","nationalId":"29801011230801","status":"exam_scheduled"}""");

        var preview = await svc.PreviewApplicantsReconciliationAsync(
            new ImportSheetInput("Applicants", new List<Dictionary<string, string?>>
            {
                new(StringComparer.Ordinal) { ["nationalId"] = "29801011230801", ["result"] = "ناجح" },
            }), default);

        Assert.Contains("WRITEBACK_NEXT_EXAM_MISSING", preview.Rows[0].Writeback!.Errors);
    }

    [Fact]
    public async Task Reconcile_commit_writes_only_accepted_fields_and_result_writeback()
    {
        var (svc, db) = Create();
        db.LookupRows.Add(new LookupRowEntity
        {
            LookupKey = "test-results", Code = "RES-01", Name = "ناجح", IsActive = true,
            PayloadJson = """{"code":"RES-01","name":"ناجح","outcome":"pass"}""",
            CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();
        await SeedOperationalAsync(db, "applicants", "APP-COMMIT-1",
            """{"id":"APP-COMMIT-1","nationalId":"29801011231101","fullName":"اسم قديم","gender":"male","email":"old@example.com","status":"exam_scheduled","examSlot":{"date":"2026-06-12"}}""");

        var sheet = new ImportSheetInput("Applicants", new List<Dictionary<string, string?>>
        {
            new(StringComparer.Ordinal)
            {
                ["nationalId"] = "29801011231101",
                ["fullName"] = "اسم مُصحَّح",
                ["email"] = "fixed@example.com",
                ["result"] = "ناجح",
                ["next_exam_date"] = "2026-07-20",
                ["test_code"] = "TST-01",
                ["round"] = "1",
            },
        });

        // Admin accepts ONLY `fullName` + the writeback. `email` correction is rejected.
        var decisions = new List<ApplicantReconciliationDecision>
        {
            new("29801011231101", ["fullName"], ApplyWriteback: true),
        };
        var commit = await svc.CommitApplicantsReconciliationAsync(
            new ApplicantReconciliationCommitRequest(decisions, sheet), default);

        Assert.Equal(1, commit.SuccessCount);
        Assert.Equal(1, commit.FieldsWrittenCount);
        Assert.Equal(1, commit.WritebacksAppliedCount);
        Assert.Equal(0, commit.FailedCount);

        var refreshed = (await new OperationalRecordStore(db).GetAsync("applicants", "APP-COMMIT-1", default))!;
        Assert.Equal("اسم مُصحَّح", refreshed["fullName"]!.GetValue<string>()); // accepted
        Assert.Equal("old@example.com", refreshed["email"]!.GetValue<string>()); // rejected → unchanged
        Assert.Equal("passed", refreshed["followUp"]!["TST-01"]!.GetValue<string>()); // result wrote
        Assert.Equal("2026-07-20", refreshed["examSlot"]!["date"]!.GetValue<string>()); // next slot wrote
    }

    [Fact]
    public async Task Reconcile_commit_is_idempotent_per_round()
    {
        var (svc, db) = Create();
        db.LookupRows.Add(new LookupRowEntity
        {
            LookupKey = "test-results", Code = "RES-01", Name = "ناجح", IsActive = true,
            PayloadJson = """{"code":"RES-01","name":"ناجح","outcome":"pass"}""",
            CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();
        await SeedOperationalAsync(db, "applicants", "APP-IDEMP",
            """{"id":"APP-IDEMP","nationalId":"29801011231201","status":"exam_scheduled","examSlot":{"date":"2026-06-12"}}""");

        var sheet = new ImportSheetInput("Applicants", new List<Dictionary<string, string?>>
        {
            new(StringComparer.Ordinal)
            {
                ["nationalId"] = "29801011231201",
                ["result"] = "ناجح",
                ["next_exam_date"] = "2026-07-20",
                ["test_code"] = "TST-01",
                ["round"] = "1",
            },
        });
        var decisions = new List<ApplicantReconciliationDecision> { new("29801011231201", [], ApplyWriteback: true) };

        await svc.CommitApplicantsReconciliationAsync(new(decisions, sheet), default);
        await svc.CommitApplicantsReconciliationAsync(new(decisions, sheet), default);

        var refreshed = (await new OperationalRecordStore(db).GetAsync("applicants", "APP-IDEMP", default))!;
        var followUp = refreshed["followUp"]!.AsObject();
        Assert.Single(followUp); // single TST-01 entry, not duplicated
        Assert.Equal("passed", followUp["TST-01"]!.GetValue<string>());
        Assert.Equal("2026-07-20", refreshed["examSlot"]!["date"]!.GetValue<string>());
    }

    [Fact]
    public async Task Reconcile_commit_fails_unmatched_per_applicant_without_blocking_others()
    {
        var (svc, db) = Create();
        db.LookupRows.Add(new LookupRowEntity
        {
            LookupKey = "test-results", Code = "RES-01", Name = "ناجح", IsActive = true,
            PayloadJson = """{"code":"RES-01","name":"ناجح","outcome":"pass"}""",
            CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();
        await SeedOperationalAsync(db, "applicants", "APP-OK",
            """{"id":"APP-OK","nationalId":"29801011231301","status":"exam_scheduled","examSlot":{"date":"2026-06-12"}}""");

        var sheet = new ImportSheetInput("Applicants", new List<Dictionary<string, string?>>
        {
            new(StringComparer.Ordinal) { ["nationalId"] = "29801011231301", ["result"] = "ناجح", ["next_exam_date"] = "2026-07-20", ["test_code"] = "TST-01" },
            new(StringComparer.Ordinal) { ["nationalId"] = "29801011239999", ["result"] = "ناجح", ["next_exam_date"] = "2026-07-20", ["test_code"] = "TST-01" },
        });
        var decisions = new List<ApplicantReconciliationDecision>
        {
            new("29801011231301", [], ApplyWriteback: true),
            new("29801011239999", [], ApplyWriteback: true),
        };

        var commit = await svc.CommitApplicantsReconciliationAsync(new(decisions, sheet), default);

        Assert.Equal(2, commit.AttemptedCount);
        Assert.Equal(1, commit.SuccessCount); // OK applicant committed
        Assert.Equal(1, commit.FailedCount);  // unknown NID failed individually
        Assert.Single(commit.FailedRows);
        Assert.Contains("APPLICANT_NID_UNMATCHED", commit.FailedRows[0].Errors);
    }

    [Fact]
    public async Task Relatives_export_explodes_nested_family_into_rows_linked_by_nationalId()
    {
        var (svc, db) = Create();
        await SeedOperationalAsync(db, "applicants", "APP-FAMILY",
            """
            {
              "id":"APP-FAMILY","nationalId":"29801011235101","fullName":"المتقدم","status":"exam_scheduled",
              "examSlot":{"date":"2026-06-15"},
              "family":{
                "father":{"fullName":"أحمد محمد","nationalId":"27001011235001","occupation":"ضابط شرطة"},
                "mother":{"fullName":"فاطمة علي","nationalId":"27201011235002"},
                "siblings":[
                  {"fullName":"خالد محمد","nationalId":"30001011235003","relationshipId":"الأخ"},
                  {"fullName":"سلمى محمد","nationalId":"30201011235004","relationshipId":"الأخت"}
                ],
                "relatives":[
                  {"fullName":"محمود محمد","relationshipId":"العم"}
                ]
              }
            }
            """);

        var result = await svc.ExportAsync([ExchangeDomain.Relatives], "single-workbook", ExportFilter.Default, default);
        var sheet = result.Sheets[0];

        Assert.Equal(5, sheet.Rows.Count);
        var allLinked = sheet.Rows.All(r => r["applicantNationalId"] == "29801011235101");
        Assert.True(allLinked, "every relative row must carry the applicant's NID as FK");
        Assert.Contains(sheet.Rows, r => r["kinship"] == "father" && r["name"] == "أحمد محمد");
        Assert.Contains(sheet.Rows, r => r["kinship"] == "mother" && r["name"] == "فاطمة علي");
        Assert.Contains(sheet.Rows, r => r["kinship"] == "brother");
        Assert.Contains(sheet.Rows, r => r["kinship"] == "sister");
        Assert.Contains(sheet.Rows, r => r["kinship"] == "paternal_uncle");
        Assert.Contains("applicantNationalId", sheet.Columns);
        Assert.Contains("kinship", sheet.Columns);
        Assert.Contains("name", sheet.Columns);
    }

    [Fact]
    public async Task ExamResults_export_explodes_followUp_outcomes_per_applicant()
    {
        var (svc, db) = Create();
        await SeedOperationalAsync(db, "applicants", "APP-RESULTS",
            """
            {
              "id":"APP-RESULTS","nationalId":"29801011235201","fullName":"المتقدم","status":"exam_scheduled",
              "examSlot":{"date":"2026-06-15"},
              "followUp":{"TST-01":"passed","TST-02":"failed","TST-03":"in-progress"}
            }
            """);

        var result = await svc.ExportAsync([ExchangeDomain.ExamResults], "single-workbook", ExportFilter.Default, default);
        var sheet = result.Sheets[0];

        Assert.Equal(3, sheet.Rows.Count);
        var allLinked = sheet.Rows.All(r => r["applicantNationalId"] == "29801011235201");
        Assert.True(allLinked, "every result row must carry the applicant's NID as FK");
        Assert.Contains(sheet.Rows, r => r["examCode"] == "TST-01" && r["result"] == "passed");
        Assert.Contains(sheet.Rows, r => r["examCode"] == "TST-02" && r["result"] == "failed");
        Assert.Contains(sheet.Rows, r => r["examCode"] == "TST-03" && r["result"] == "in-progress");
        Assert.Contains("applicantNationalId", sheet.Columns);
        Assert.Contains("examCode", sheet.Columns);
        Assert.Contains("result", sheet.Columns);
    }

    [Fact]
    public async Task Relatives_and_ExamResults_skip_applicants_who_have_not_booked()
    {
        var (svc, db) = Create();
        await SeedOperationalAsync(db, "applicants", "APP-DRAFT",
            """
            {
              "id":"APP-DRAFT","nationalId":"29801011235301","fullName":"مسودة","status":"draft",
              "family":{"father":{"fullName":"أحمد"}},
              "followUp":{"TST-01":"passed"}
            }
            """);

        var rel = await svc.ExportAsync([ExchangeDomain.Relatives], "single-workbook", ExportFilter.Default, default);
        var res = await svc.ExportAsync([ExchangeDomain.ExamResults], "single-workbook", ExportFilter.Default, default);

        Assert.Empty(rel.Sheets[0].Rows);
        Assert.Empty(res.Sheets[0].Rows);
    }

    [Fact]
    public async Task Applicants_roster_lists_only_booked_with_slot_columns()
    {
        var (svc, db) = Create();
        await SeedOperationalAsync(db, "applicants", "APP-D",
            """{"id":"APP-D","nationalId":"29801011230001","fullName":"مسودة","status":"draft"}""");
        await SeedOperationalAsync(db, "applicants", "APP-S",
            """{"id":"APP-S","nationalId":"29801011230002","fullName":"محجوز","status":"exam_scheduled","examSlot":{"slotId":"SLOT-7","date":"2026-06-15","time":"08:00","location":"كلية الشرطة"}}""");

        var roster = await svc.ListBookedApplicantsAsync(default);

        var row = Assert.Single(roster);
        Assert.Equal("29801011230002", row.NationalId);
        Assert.Equal("محجوز", row.FullName);
        Assert.Equal("2026-06-15", row.ExamSlotDate);
        Assert.Equal("كلية الشرطة", row.ExamSlotLocation);
    }

    [Fact]
    public async Task Applicants_export_with_nationalIds_filter_returns_only_selected_rows()
    {
        var (svc, db) = Create();
        await SeedOperationalAsync(db, "applicants", "APP-A",
            """{"id":"APP-A","nationalId":"29801011230101","fullName":"محجوز أ","status":"exam_scheduled"}""");
        await SeedOperationalAsync(db, "applicants", "APP-B",
            """{"id":"APP-B","nationalId":"29801011230102","fullName":"محجوز ب","status":"exam_scheduled"}""");
        await SeedOperationalAsync(db, "applicants", "APP-C",
            """{"id":"APP-C","nationalId":"29801011230103","fullName":"محجوز ج","status":"exam_scheduled"}""");

        var allow = (IReadOnlySet<string>)new HashSet<string>(StringComparer.Ordinal) { "29801011230101", "29801011230103" };
        var result = await svc.ExportAsync(
            [ExchangeDomain.Applicants],
            "single-workbook",
            ExportFilter.Default with { NationalIds = allow },
            default);

        var rows = result.Sheets[0].Rows.Select(r => r["business_key"]).ToHashSet();
        Assert.Equal(2, result.Sheets[0].Rows.Count);
        Assert.Contains("29801011230101", rows);
        Assert.Contains("29801011230103", rows);
        Assert.DoesNotContain("29801011230102", rows);
    }

    [Fact]
    public async Task Applicants_export_excludes_unbooked_and_includes_booked()
    {
        var (svc, db) = Create();
        // Draft applicant — no examSlot, status `draft` ⇒ MUST be withheld.
        await SeedOperationalAsync(db, "applicants", "APP-DRAFT",
            """{"id":"APP-DRAFT","nationalId":"29801011234001","fullName":"مسودة","status":"draft"}""");
        // Has paid but not yet booked the first exam ⇒ still withheld.
        await SeedOperationalAsync(db, "applicants", "APP-AWAITING",
            """{"id":"APP-AWAITING","nationalId":"29801011234002","fullName":"بانتظار الحجز","status":"awaiting_exam_booking"}""");
        // Booked via examSlot — exported.
        await SeedOperationalAsync(db, "applicants", "APP-SLOT",
            """{"id":"APP-SLOT","nationalId":"29801011234003","fullName":"محجوز بالموعد","examSlot":{"slotId":"SLOT-1","date":"2026-06-12"}}""");
        // Booked via post-booking status — exported.
        await SeedOperationalAsync(db, "applicants", "APP-SCHED",
            """{"id":"APP-SCHED","nationalId":"29801011234004","fullName":"محجوز بالحالة","status":"exam_scheduled"}""");

        var result = await svc.ExportAsync([ExchangeDomain.Applicants], "single-workbook", ExportFilter.Default, default);
        var sheet = result.Sheets[0];
        var businessKeys = sheet.Rows.Select(r => r["business_key"]).ToHashSet();

        Assert.Equal(2, sheet.Rows.Count);
        Assert.Contains("29801011234003", businessKeys);
        Assert.Contains("29801011234004", businessKeys);
        Assert.DoesNotContain("29801011234001", businessKeys);
        Assert.DoesNotContain("29801011234002", businessKeys);
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
