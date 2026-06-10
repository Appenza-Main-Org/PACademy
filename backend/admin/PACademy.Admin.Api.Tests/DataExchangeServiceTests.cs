using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Modules.Admissions;
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
        return new DataExchangeService(db, records, sink, new SystemActorProvider(), new TestHostEnvironment());
    }

    private sealed class TestHostEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Testing";
        public string ApplicationName { get; set; } = "PACademy.Admin.Api.Tests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    private static Task SeedOperationalAsync(AdminDbContext db, string module, string id, string payloadJson)
        => new OperationalRecordStore(db).UpsertAsync(module, id, JsonNode.Parse(payloadJson)!.AsObject(), default);

    private static async Task SeedCycleAsync(AdminDbContext db, string id, bool isActive)
    {
        db.AdmissionCycles.Add(new AdmissionCycleEntity
        {
            Id = id,
            NameAr = id,
            Year = 2026,
            Status = isActive ? "open" : "closed",
            IsActive = isActive,
            PayloadJson = $$"""{"id":"{{id}}","nameAr":"{{id}}","year":2026,"status":"{{(isActive ? "open" : "closed")}}","isActive":{{isActive.ToString().ToLowerInvariant()}}}""",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();
    }

    private static (DataExchangeService svc, AdminDbContext db) Create()
    {
        var options = new DbContextOptionsBuilder<AdminDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .AddInterceptors(new ChangeTrackingInterceptor(new SystemActorProvider()))
            .Options;
        var db = new AdminDbContext(options);
        return (Build(db), db);
    }

    private static Task SeedAcademicGradeLookupAsync(AdminDbContext db, string code, string name)
        => SeedLookupAsync(db, "academic-grades", code, name);

    private static Task SeedCommitteeLookupAsync(AdminDbContext db, string code, string name)
        => SeedLookupAsync(db, "committees", code, name);

    private static async Task SeedLookupAsync(AdminDbContext db, string lookupKey, string code, string name)
    {
        db.LookupRows.Add(new LookupRowEntity
        {
            LookupKey = lookupKey, Code = code, Name = name, IsActive = true,
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
        await SeedAcademicGradeLookupAsync(db, "EXC-01", "ممتاز");
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
            """{"id":"APP-S","nationalId":"29801011230002","fullName":"محجوز","status":"exam_scheduled","committeeName":"اللجنة الأولى قسم عام","examSlot":{"slotId":"SLOT-7","date":"2026-06-15","time":"08:00","location":"كلية الشرطة"}}""");

        var roster = await svc.ListBookedApplicantsAsync(null, default);

        var row = Assert.Single(roster);
        Assert.Equal("29801011230002", row.NationalId);
        Assert.Equal("محجوز", row.FullName);
        Assert.Equal("2026-06-15", row.ExamSlotDate);
        Assert.Equal("اللجنة الأولى قسم عام", row.CommitteeName);
        Assert.Equal("كلية الشرطة", row.ExamSlotLocation);
    }

    [Fact]
    public async Task Applicants_roster_resolves_assigned_committee_id_from_lookup()
    {
        var (svc, db) = Create();
        await SeedCommitteeLookupAsync(db, "CMT-LAW-02", "اللجنة الثانية ليسانس حقوق");
        await SeedOperationalAsync(db, "applicants", "APP-S",
            """{"id":"APP-S","nationalId":"29801011230003","fullName":"محجوز","status":"exam_scheduled","assignedCommitteeId":"CMT-LAW-02","committeeName":"كلية الشرطة - مبنى الاختبارات - القاهرة","examSlot":{"slotId":"SLOT-8","date":"2026-06-15","time":"08:00","location":"كلية الشرطة - مبنى الاختبارات - القاهرة"}}""");

        var roster = await svc.ListBookedApplicantsAsync(null, default);

        var row = Assert.Single(roster);
        Assert.Equal("اللجنة الثانية ليسانس حقوق", row.CommitteeName);
        Assert.Equal("كلية الشرطة - مبنى الاختبارات - القاهرة", row.ExamSlotLocation);
    }

    [Fact]
    public async Task Applicants_export_resolves_committee_name_without_location_fallback()
    {
        var (svc, db) = Create();
        await SeedCommitteeLookupAsync(db, "CMT-LAW-03", "اللجنة الثالثة ليسانس حقوق");
        await SeedOperationalAsync(db, "applicants", "APP-S",
            """{"id":"APP-S","nationalId":"29801011230004","fullName":"محجوز","status":"exam_scheduled","assignedCommitteeId":"CMT-LAW-03","committeeName":"كلية الشرطة - مبنى الاختبارات - القاهرة","examSlot":{"slotId":"SLOT-9","date":"2026-06-16","time":"08:00","location":"كلية الشرطة - مبنى الاختبارات - القاهرة"}}""");

        var result = await svc.ExportAsync([ExchangeDomain.Applicants], "single-workbook", ExportFilter.Default, default);

        var row = Assert.Single(result.Sheets[0].Rows);
        Assert.Equal("اللجنة الثالثة ليسانس حقوق", row["committeeName"]);
        Assert.Equal("كلية الشرطة - مبنى الاختبارات - القاهرة", row["examSlot.location"]);
    }

    [Fact]
    public async Task Applicants_roster_and_export_infer_committee_from_unique_schedule_row()
    {
        var (svc, db) = Create();
        await SeedCommitteeLookupAsync(db, "CMT-LAW-04", "اللجنة الرابعة ليسانس حقوق");
        await SeedOperationalAsync(db, "committeeInstances", "CI-LAW-04",
            """{"id":"CI-LAW-04","cycleId":"CYC-2026","categoryKey":"law_bachelor","definitionCode":"CMT-LAW-04","date":"2026-06-17","capacity":50,"reserved":0}""");
        await SeedOperationalAsync(db, "applicants", "APP-S",
            """{"id":"APP-S","nationalId":"30501011234568","fullName":"محجوز","status":"exam_scheduled","cycleId":"CYC-2026","categoryKey":"law_bachelor","examSlot":{"slotId":"SLOT-10","date":"2026-06-17","time":"08:00","location":"كلية الشرطة - مبنى الاختبارات - القاهرة"}}""");

        var roster = await svc.ListBookedApplicantsAsync(null, default);
        var export = await svc.ExportAsync([ExchangeDomain.Applicants], "single-workbook", ExportFilter.Default, default);

        Assert.Equal("اللجنة الرابعة ليسانس حقوق", Assert.Single(roster).CommitteeName);
        Assert.Equal("اللجنة الرابعة ليسانس حقوق", Assert.Single(export.Sheets[0].Rows)["committeeName"]);
    }

    [Fact]
    public async Task Applicants_roster_and_export_resolve_committee_from_booked_slot_id()
    {
        var (svc, db) = Create();
        await SeedCommitteeLookupAsync(db, "CMT-LAW-04", "اللجنة الرابعة ليسانس حقوق");
        await SeedCommitteeLookupAsync(db, "CMT-LAW-05", "اللجنة الخامسة ليسانس حقوق");
        await SeedOperationalAsync(db, "committeeInstances", "CI-LAW-04",
            """{"id":"CI-LAW-04","cycleId":"CYC-1780758679766","categoryKey":"law_bachelor","definitionCode":"CMT-LAW-04","date":"2026-06-17","capacity":50,"reserved":0}""");
        await SeedOperationalAsync(db, "committeeInstances", "CI-LAW-05",
            """{"id":"CI-LAW-05","cycleId":"CYC-1780758679766","categoryKey":"law_bachelor","definitionCode":"CMT-LAW-05","date":"2026-06-17","capacity":50,"reserved":0}""");
        await SeedOperationalAsync(db, "applicants", "APP-S",
            """{"id":"APP-S","nationalId":"30501011234568","fullName":"محجوز","status":"exam_scheduled","cycleId":"CYC-1780758679766","categoryKey":"law_bachelor","examSlot":{"slotId":"CI-LAW-04","date":"2026-06-17","time":"08:00","location":"كلية الشرطة - مبنى الاختبارات - القاهرة"}}""");

        var roster = await svc.ListBookedApplicantsAsync(null, default);
        var export = await svc.ExportAsync([ExchangeDomain.Applicants], "single-workbook", ExportFilter.Default, default);

        Assert.Equal("اللجنة الرابعة ليسانس حقوق", Assert.Single(roster).CommitteeName);
        Assert.Equal("اللجنة الرابعة ليسانس حقوق", Assert.Single(export.Sheets[0].Rows)["committeeName"]);
    }

    [Fact]
    public async Task Applicants_roster_and_export_resolve_female_committee_from_date_slot()
    {
        var (svc, db) = Create();
        await SeedCommitteeLookupAsync(db, "CMT-LAW-10", "اللجنة الأولى ليسانس حقوق (طالبات)");
        await SeedCommitteeLookupAsync(db, "CMT-LAW-11", "اللجنة الثانية ليسانس حقوق");
        await SeedOperationalAsync(db, "committeeInstances", "CI-LAW-10",
            """{"id":"CI-LAW-10","cycleId":"CYC-1780758679766","categoryKey":"law_bachelor","definitionCode":"CMT-LAW-10","date":"2026-06-14","capacity":2,"reserved":0}""");
        await SeedOperationalAsync(db, "committeeInstances", "CI-LAW-11",
            """{"id":"CI-LAW-11","cycleId":"CYC-1780758679766","categoryKey":"law_bachelor","definitionCode":"CMT-LAW-11","date":"2026-06-14","capacity":2,"reserved":0}""");
        await SeedOperationalAsync(db, "applicants", "APP-S",
            """{"id":"APP-S","nationalId":"30501011234568","fullName":"محجوز","gender":"female","status":"exam_scheduled","cycleId":"CYC-1780758679766","categoryKey":"law_bachelor","examSlot":{"slotId":"SLT-2026-06-14","date":"2026-06-14","time":"08:00","location":"كلية الشرطة - مبنى الاختبارات - القاهرة"}}""");

        var roster = await svc.ListBookedApplicantsAsync(null, default);
        var export = await svc.ExportAsync([ExchangeDomain.Applicants], "single-workbook", ExportFilter.Default, default);

        Assert.Equal("اللجنة الأولى ليسانس حقوق (طالبات)", Assert.Single(roster).CommitteeName);
        Assert.Equal("اللجنة الأولى ليسانس حقوق (طالبات)", Assert.Single(export.Sheets[0].Rows)["committeeName"]);
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
    public async Task Applicants_roster_export_and_reconciliation_are_scoped_to_active_cycle_categories()
    {
        // Regression: Data Exchange leaked booked applicants from inactive cycles
        // and categories not configured for the active cycle.
        var (svc, db) = Create();
        await SeedCycleAsync(db, "CYC-ACTIVE", true);
        await SeedCycleAsync(db, "CYC-CLOSED", false);
        await SeedOperationalAsync(db, "committeeInstances", "CI-ACTIVE-LAW",
            """{"id":"CI-ACTIVE-LAW","cycleId":"CYC-ACTIVE","categoryKey":"law_bachelor","definitionCode":"CMT-LAW","date":"2026-06-17"}""");
        await SeedOperationalAsync(db, "applicants", "APP-ACTIVE-LAW",
            """{"id":"APP-ACTIVE-LAW","nationalId":"29801011230201","fullName":"نشط قانون","status":"exam_scheduled","cycleId":"CYC-ACTIVE","categoryKey":"law_bachelor","family":{"father":{"fullName":"والد"}},"followUp":{"TST-01":"passed"}}""");
        await SeedOperationalAsync(db, "applicants", "APP-ACTIVE-OTHER",
            """{"id":"APP-ACTIVE-OTHER","nationalId":"29801011230202","fullName":"نشط فئة أخرى","status":"exam_scheduled","cycleId":"CYC-ACTIVE","categoryKey":"specialized_officers","family":{"father":{"fullName":"والد"}},"followUp":{"TST-01":"passed"}}""");
        await SeedOperationalAsync(db, "applicants", "APP-CLOSED-LAW",
            """{"id":"APP-CLOSED-LAW","nationalId":"29801011230203","fullName":"دورة مغلقة","status":"exam_scheduled","cycleId":"CYC-CLOSED","categoryKey":"law_bachelor","family":{"father":{"fullName":"والد"}},"followUp":{"TST-01":"passed"}}""");

        var roster = await svc.ListBookedApplicantsAsync(null, default);
        var export = await svc.ExportAsync(
            [ExchangeDomain.Applicants, ExchangeDomain.Relatives, ExchangeDomain.ExamResults],
            "single-workbook",
            ExportFilter.Default,
            default);
        var preview = await svc.PreviewApplicantsReconciliationAsync(
            new ImportSheetInput("Applicants",
            [
                new(StringComparer.Ordinal) { ["nationalId"] = "29801011230201", ["fullName"] = "نشط قانون" },
                new(StringComparer.Ordinal) { ["nationalId"] = "29801011230203", ["fullName"] = "دورة مغلقة" },
            ]),
            default);

        var rosterRow = Assert.Single(roster);
        Assert.Equal("29801011230201", rosterRow.NationalId);

        var applicantKeys = export.Sheets.Single(s => s.Domain == "Applicants").Rows.Select(r => r["business_key"]).ToHashSet();
        var applicantKey = Assert.Single(applicantKeys);
        Assert.Equal("29801011230201", applicantKey);
        Assert.Single(export.Sheets.Single(s => s.Domain == "Relatives").Rows);
        Assert.Single(export.Sheets.Single(s => s.Domain == "ExamResults").Rows);

        Assert.Equal(1, preview.Counts["matched"]);
        Assert.Equal(1, preview.Counts["unmatched"]);
        Assert.True(preview.Rows.Single(r => r.NationalId == "29801011230203").Unmatched);
    }

    [Fact]
    public async Task Applicants_export_includes_booked_rows_with_missing_cycle_or_category()
    {
        // Regression: booked applicants whose record carried a blank/stale cycle id
        // (e.g. the portal default vs the admin's timestamp cycle id) were silently
        // dropped from the export. A missing cycle/category must not remove a booked
        // row; only a positively-different cycle does.
        var (svc, db) = Create();
        await SeedCycleAsync(db, "CYC-ACTIVE", true);
        await SeedOperationalAsync(db, "committeeInstances", "CI-ACTIVE-LAW",
            """{"id":"CI-ACTIVE-LAW","cycleId":"CYC-ACTIVE","categoryKey":"law_bachelor","definitionCode":"CMT-LAW","date":"2026-06-17"}""");
        await SeedOperationalAsync(db, "applicants", "APP-NO-CYCLE",
            """{"id":"APP-NO-CYCLE","nationalId":"29801011230301","fullName":"بدون دورة","status":"exam_scheduled","examSlot":{"slotId":"SLOT-1","date":"2026-06-17"}}""");
        await SeedOperationalAsync(db, "applicants", "APP-OTHER-CYCLE",
            """{"id":"APP-OTHER-CYCLE","nationalId":"29801011230302","fullName":"دورة أخرى","status":"exam_scheduled","cycleId":"CYC-OTHER","categoryKey":"law_bachelor","examSlot":{"slotId":"SLOT-2","date":"2026-06-17"}}""");

        var export = await svc.ExportAsync([ExchangeDomain.Applicants], "single-workbook", ExportFilter.Default, default);
        var keys = export.Sheets.Single(s => s.Domain == "Applicants").Rows.Select(r => r["business_key"]).ToHashSet();

        Assert.Contains("29801011230301", keys);       // missing cycle + category → kept
        Assert.DoesNotContain("29801011230302", keys);  // positively different cycle → dropped
    }

    [Fact]
    public async Task Cycle_owned_export_sheets_are_strictly_scoped_to_active_cycle()
    {
        var (svc, db) = Create();
        await SeedCycleAsync(db, "CYC-ACTIVE", true);
        await SeedCycleAsync(db, "CYC-CLOSED", false);
        await SeedOperationalAsync(db, "committeeInstances", "CI-ACTIVE",
            """{"id":"CI-ACTIVE","cycleId":"CYC-ACTIVE","categoryKey":"law_bachelor","definitionCode":"CMT-LAW","date":"2026-06-17","time":"09:30","capacity":50,"reserved":4}""");
        await SeedOperationalAsync(db, "committeeInstances", "CI-CLOSED",
            """{"id":"CI-CLOSED","cycleId":"CYC-CLOSED","categoryKey":"law_bachelor","definitionCode":"CMT-LAW","date":"2026-07-01","capacity":50,"reserved":8}""");
        await SeedOperationalAsync(db, "committeeInstances", "CI-LEGACY",
            """{"id":"CI-LEGACY","categoryKey":"law_bachelor","definitionCode":"CMT-LAW","date":"2026-07-02","capacity":50,"reserved":0}""");
        await SeedOperationalAsync(db, "admissionSetup.examScheduleDays", "DAY-ACTIVE",
            """{"id":"DAY-ACTIVE","cycleId":"CYC-ACTIVE","categoryKey":"law_bachelor","date":"2026-06-18","kind":"WORKING","capacity":120}""");
        await SeedOperationalAsync(db, "admissionSetup.examScheduleDays", "DAY-CLOSED",
            """{"id":"DAY-CLOSED","cycleId":"CYC-CLOSED","categoryKey":"law_bachelor","date":"2026-07-03","kind":"WORKING","capacity":120}""");

        var export = await svc.ExportAsync(
            [ExchangeDomain.Committees, ExchangeDomain.ExamSchedules],
            "single-workbook",
            ExportFilter.Default,
            default);

        var committeeIds = export.Sheets.Single(s => s.Domain == "Committees").Rows.Select(r => r["business_key"]!).ToArray();
        var scheduleRows = export.Sheets.Single(s => s.Domain == "ExamSchedules").Rows;
        var scheduleIds = scheduleRows.Select(r => r["business_key"]!).ToArray();
        Assert.Equal(["CI-ACTIVE"], committeeIds);
        Assert.Equal(["CI-ACTIVE", "DAY-ACTIVE"], scheduleIds);
        Assert.Equal("09:30", scheduleRows.Single(r => r["business_key"] == "CI-ACTIVE")["time"]);
        Assert.Equal("08:00", scheduleRows.Single(r => r["business_key"] == "DAY-ACTIVE")["time"]);
    }

    [Fact]
    public async Task Export_includes_cycle_exam_plans_and_application_settings_conditions()
    {
        var (svc, db) = Create();
        await SeedCycleAsync(db, "CYC-ACTIVE", true);
        await SeedCycleAsync(db, "CYC-CLOSED", false);
        await SeedOperationalAsync(db, "examPlans", "EP-CYC-ACTIVE-law_bachelor",
            """{"id":"EP-CYC-ACTIVE-law_bachelor","cycleId":"CYC-ACTIVE","categoryId":"law_bachelor","updatedAt":"2026-06-01T00:00:00Z","exams":[{"examId":"TST-01","order":1,"isRequired":true},{"examId":"TST-02","order":2,"isRequired":false}]}""");
        await SeedOperationalAsync(db, "examPlans", "EP-CYC-CLOSED-law_bachelor",
            """{"id":"EP-CYC-CLOSED-law_bachelor","cycleId":"CYC-CLOSED","categoryId":"law_bachelor","updatedAt":"2026-06-01T00:00:00Z","exams":[{"examId":"TST-99","order":1,"isRequired":true}]}""");
        await SeedOperationalAsync(db, "admissionSetup.applicationSettings.CYC-ACTIVE", "admissionSetup.applicationSettings.CYC-ACTIVE",
            """{"id":"admissionSetup.applicationSettings.CYC-ACTIVE","cycleId":"CYC-ACTIVE","version":1,"updatedAt":"2026-06-01T00:00:00Z","headers":{"law_bachelor":{"applicationStart":"2026-06-01","applicationEnd":"2026-06-30","ageMin":20,"maxAge":28}},"approved":[{"id":"COND-1","category":"law_bachelor","gradeKind":"GRADES","minPercentage":65}],"local":[]}""");

        var result = await svc.ExportAsync(
            [ExchangeDomain.Exams, ExchangeDomain.AdmissionConditions],
            "single-workbook",
            ExportFilter.Default,
            default);

        var exams = result.Sheets.Single(s => s.Domain == "Exams");
        var conditions = result.Sheets.Single(s => s.Domain == "AdmissionConditions");

        Assert.Equal(2, exams.Rows.Count);
        Assert.All(exams.Rows, row => Assert.Equal("CYC-ACTIVE", row["cycleId"]));
        Assert.Contains(exams.Rows, row => row["examId"] == "TST-01" && row["categoryId"] == "law_bachelor");
        Assert.DoesNotContain(exams.Rows, row => row.TryGetValue("examId", out var examId) && examId == "TST-99");

        var condition = Assert.Single(conditions.Rows);
        Assert.Equal("application_settings", condition["record_type"]);
        Assert.Equal("CYC-ACTIVE", condition["cycleId"]);
        Assert.Contains("\"minPercentage\":65", condition["approved"]!);
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
        await SeedAcademicGradeLookupAsync(db, "EXC-01", "ممتاز");
        await SeedAcademicGradeLookupAsync(db, "EXC-02", "جيد جداً");
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
        await SeedAcademicGradeLookupAsync(db, "EXC-01", "ممتاز");
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
        await SeedAcademicGradeLookupAsync(db, "EXC-01", "ممتاز");
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
        await SeedAcademicGradeLookupAsync(db, "EXC-01", "ممتاز");
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
        await SeedAcademicGradeLookupAsync(db, "EXC-01", "ممتاز");
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

    // ── Curated snapshot export (fixed columns, cycle-scoped, ExportInfo) ────

    [Fact]
    public async Task Snapshot_applicants_emit_fixed_clean_columns_and_respect_booked_gate()
    {
        var (svc, db) = Create();
        await SeedOperationalAsync(db, "applicants", "APP-1",
            """{"id":"APP-1","nationalId":"29801011234567","fullName":"متقدم","gender":"male","phoneNumber":"01000000000","email":"a@x.com","birthDate":"1998-01-01","birthGovernorate":"القاهرة","status":"exam_scheduled","certType":"مؤهل جامعي","education":{"kind":"higher","university":"جامعة القاهرة","faculty":"كلية الحقوق","specialization":"القانون العام","graduationYear":2024,"grade":"جيد جداً","percentage":82.5,"secondary":{"schoolName":"مدرسة النصر الثانوية","schoolCategory":"علمي علوم","totalScore":390,"percentage":95.1,"graduationYear":2020}}}""");
        await SeedOperationalAsync(db, "applicants", "APP-DRAFT",
            """{"id":"APP-DRAFT","nationalId":"29801011230000","fullName":"مسودة","status":"draft"}""");

        var result = await svc.ExportSnapshotAsync([ExchangeDomain.Applicants], "single-workbook", ExportFilter.Default, default);
        var sheet = Assert.Single(result.Sheets);

        Assert.Equal(
            new[]
            {
                "applicant_id", "national_id", "full_name", "gender", "phone_number", "email", "date_of_birth", "birth_governorate",
                "qualification_type", "university", "faculty", "specialization", "graduation_year", "grade", "percentage",
                "school_name", "school_category", "secondary_total_score", "secondary_percentage", "secondary_graduation_year",
                "category", "cycle_id", "status",
            },
            sheet.Columns);
        var row = Assert.Single(sheet.Rows); // draft withheld by the booked gate
        Assert.Equal("29801011234567", row["national_id"]);
        Assert.Equal("متقدم", row["full_name"]);
        Assert.Equal("a@x.com", row["email"]);
        Assert.Equal("مؤهل جامعي", row["qualification_type"]);
        Assert.Equal("جامعة القاهرة", row["university"]);
        Assert.Equal("كلية الحقوق", row["faculty"]);
        Assert.Equal("القانون العام", row["specialization"]);
        Assert.Equal("2024", row["graduation_year"]);
        Assert.Equal("جيد جداً", row["grade"]);
        Assert.Equal("82.5", row["percentage"]);
        Assert.Equal("مدرسة النصر الثانوية", row["school_name"]);
        Assert.Equal("علمي علوم", row["school_category"]);
        Assert.Equal("390", row["secondary_total_score"]);
        Assert.Equal("95.1", row["secondary_percentage"]);
        Assert.Equal("2020", row["secondary_graduation_year"]);
        Assert.DoesNotContain("business_key", sheet.Columns);
        Assert.DoesNotContain("checksum", sheet.Columns);
    }

    [Fact]
    public async Task Snapshot_applicants_fall_back_to_raw_profile_education_fields()
    {
        var (svc, db) = Create();
        // Payload shape without the projected `education` object — only the raw
        // portal-draft `profile` fields. Every applicant must still export education.
        await SeedOperationalAsync(db, "applicants", "APP-RAW",
            """{"id":"APP-RAW","nationalId":"29801011234568","fullName":"متقدم خام","status":"exam_scheduled","profile":{"qualificationLevel":"license","bachelorUniversity":"جامعة عين شمس","bachelorFaculty":"كلية الحقوق","bachelorSpecialization":"القانون الجنائي","bachelorYear":2023,"bachelorGrade":"جيد","bachelorPercentage":75,"schoolNameAr":"مدرسة التحرير","thanawiType":"أدبي","thanawiTotal":380,"thanawiPercentage":92.6,"thanawiGradDate":"2019-07-01"}}""");

        var result = await svc.ExportSnapshotAsync([ExchangeDomain.Applicants], "single-workbook", ExportFilter.Default, default);
        var row = Assert.Single(result.Sheets[0].Rows);

        Assert.Equal("جامعة عين شمس", row["university"]);
        Assert.Equal("كلية الحقوق", row["faculty"]);
        Assert.Equal("القانون الجنائي", row["specialization"]);
        Assert.Equal("2023", row["graduation_year"]);
        Assert.Equal("جيد", row["grade"]);
        Assert.Equal("75", row["percentage"]);
        Assert.Equal("مدرسة التحرير", row["school_name"]);
        Assert.Equal("أدبي", row["school_category"]);
        Assert.Equal("380", row["secondary_total_score"]);
        Assert.Equal("92.6", row["secondary_percentage"]);
        Assert.Equal("2019", row["secondary_graduation_year"]);
    }

    [Fact]
    public async Task Snapshot_empty_domain_emits_header_only()
    {
        var (svc, _) = Create();
        var result = await svc.ExportSnapshotAsync([ExchangeDomain.Faculties], "single-workbook", ExportFilter.Default, default);
        var sheet = Assert.Single(result.Sheets);
        Assert.Equal(new[] { "faculty_code", "faculty_name", "is_active" }, sheet.Columns);
        Assert.Empty(sheet.Rows);
    }

    [Fact]
    public async Task Snapshot_faculties_and_lookuprows_split_cleanly()
    {
        var (svc, db) = Create();
        await SeedLookupAsync(db, "faculties", "FAC-01", "كلية الحقوق");
        await SeedLookupAsync(db, "governorates", "GOV-01", "القاهرة");

        var fac = await svc.ExportSnapshotAsync([ExchangeDomain.Faculties], "single-workbook", ExportFilter.Default, default);
        var lk = await svc.ExportSnapshotAsync([ExchangeDomain.LookupRows], "single-workbook", ExportFilter.Default, default);

        var facRow = Assert.Single(fac.Sheets[0].Rows);
        Assert.Equal("FAC-01", facRow["faculty_code"]);
        Assert.Equal("كلية الحقوق", facRow["faculty_name"]);
        Assert.Equal(2, lk.Sheets[0].Rows.Count); // every lookup row, faculties included
    }

    [Fact]
    public async Task Snapshot_relatives_emit_curated_relation_columns()
    {
        var (svc, db) = Create();
        await SeedOperationalAsync(db, "applicants", "APP-FAM",
            """{"id":"APP-FAM","nationalId":"29801011235101","status":"exam_scheduled","examSlot":{"date":"2026-06-15"},"family":{"father":{"fullName":"أحمد","nationalId":"27001011235001","occupation":"ضابط","gender":"male"}}}""");

        var result = await svc.ExportSnapshotAsync([ExchangeDomain.Relatives], "single-workbook", ExportFilter.Default, default);
        var sheet = result.Sheets[0];
        Assert.Equal(
            new[] { "applicant_id", "relation_type", "relation_label", "full_name", "national_id", "gender", "qualification", "occupation", "phone", "governorate", "address" },
            sheet.Columns);
        var row = Assert.Single(sheet.Rows);
        Assert.Equal("29801011235101", row["applicant_id"]);
        Assert.Equal("father", row["relation_type"]);
        Assert.Equal("الأب", row["relation_label"]);
        Assert.Equal("أحمد", row["full_name"]);
    }

    [Fact]
    public async Task Snapshot_payments_project_typed_columns_from_operational_table()
    {
        var (svc, db) = Create();
        await SeedCycleAsync(db, "CYC-ACTIVE", true);
        db.PaymentRecords.Add(new PaymentRecordEntity
        {
            Module = "payments", Id = "PAY-1", ApplicantId = "APP-1", NationalId = "29801011234567",
            CycleId = "CYC-ACTIVE", Status = "paid",
            PayloadJson = """{"amount":"500","paidAt":"2026-06-01"}""",
            CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var result = await svc.ExportSnapshotAsync([ExchangeDomain.Payments], "single-workbook", ExportFilter.Default, default);
        var row = Assert.Single(result.Sheets[0].Rows);
        Assert.Equal("PAY-1", row["payment_id"]);
        Assert.Equal("500", row["amount"]);
        Assert.Equal("paid", row["payment_status"]);
        Assert.Equal("CYC-ACTIVE", row["cycle_id"]);
    }

    [Fact]
    public async Task Snapshot_info_carries_cycle_name_and_environment()
    {
        var (svc, db) = Create();
        await SeedCycleAsync(db, "CYC-ACTIVE", true);
        var result = await svc.ExportSnapshotAsync(
            [ExchangeDomain.LookupRows], "single-workbook",
            ExportFilter.Default with { CycleId = "CYC-ACTIVE" }, default);

        Assert.NotNull(result.Info);
        Assert.Equal("CYC-ACTIVE", result.Info!.CycleId);
        Assert.Equal("CYC-ACTIVE", result.Info.CycleName); // SeedCycleAsync sets NameAr == id
        Assert.Equal("Testing", result.Info.Environment);
    }

    [Fact]
    public async Task Snapshot_admission_conditions_are_withheld_for_non_active_cycle()
    {
        var (svc, db) = Create();
        var now = DateTimeOffset.UtcNow;
        await SeedCycleAsync(db, "CYC-ACTIVE", true);
        await SeedCycleAsync(db, "CYC-CLOSED", false);
        db.ApplicationSettingsCategoryConfigs.Add(new ApplicationSettingsCategoryConfigEntity
        {
            Id = "CFG-1", CategoryId = "law_bachelor", IsActive = true, SortOrder = 0, CreatedAt = now, UpdatedAt = now,
        });
        db.ApplicationSettingsCategorySpecializations.Add(new ApplicationSettingsCategorySpecializationEntity
        {
            Id = "SP-1", ConfigId = "CFG-1", SpecializationId = "SPC-1", IsActive = true, CreatedAt = now, UpdatedAt = now,
        });
        db.ApplicationSettingsGraduationYears.Add(new ApplicationSettingsGraduationYearEntity
        {
            Id = "YR-1", CategorySpecializationId = "SP-1",
            GraduationYearsJson = "[2026]", GenderTypesJson = "[\"male\"]", MaritalStatusCodesJson = "[]",
            AgeMin = 20, MaxAge = 28, DivisionCodesJson = "[]", SchoolCategoryCodesJson = "[]",
            ApplicationStartDate = new DateOnly(2026, 6, 1), ApplicationEndDate = new DateOnly(2026, 6, 30),
            AgeReferenceDate = new DateOnly(2026, 6, 1), IsActive = true, GradeKind = "GRADES", MinPercentage = 65m,
            CreatedAt = now, UpdatedAt = now,
        });
        await db.SaveChangesAsync();

        var active = await svc.ExportSnapshotAsync(
            [ExchangeDomain.AdmissionConditions], "single-workbook", ExportFilter.Default with { CycleId = "CYC-ACTIVE" }, default);
        var closed = await svc.ExportSnapshotAsync(
            [ExchangeDomain.AdmissionConditions], "single-workbook", ExportFilter.Default with { CycleId = "CYC-CLOSED" }, default);

        var activeRow = Assert.Single(active.Sheets[0].Rows);
        Assert.Equal("law_bachelor", activeRow["category"]);
        Assert.Equal("2026", activeRow["graduation_year"]);
        Assert.Equal("65", activeRow["min_percentage"]);
        Assert.Empty(closed.Sheets[0].Rows); // normalized settings belong to the active cycle only
    }

    [Fact]
    public async Task Snapshot_admission_conditions_include_categories_without_condition_rows()
    {
        var (svc, db) = Create();
        var now = DateTimeOffset.UtcNow;
        await SeedLookupAsync(db, "specializations", "SPC-1", "القانون العام");
        db.ApplicantCategories.Add(new ApplicantCategoryEntity
        {
            Key = "law_bachelor", LabelAr = "حملة ليسانس الحقوق", IsOpen = true,
            PayloadJson = "{}", CreatedAt = now, UpdatedAt = now,
        });
        // Configured category whose specialization has NO graduation-year rows yet.
        db.ApplicationSettingsCategoryConfigs.Add(new ApplicationSettingsCategoryConfigEntity
        {
            Id = "CFG-1", CategoryId = "law_bachelor", IsActive = true, SortOrder = 0, CreatedAt = now, UpdatedAt = now,
        });
        db.ApplicationSettingsCategorySpecializations.Add(new ApplicationSettingsCategorySpecializationEntity
        {
            Id = "SP-1", ConfigId = "CFG-1", SpecializationId = "SPC-1", IsActive = true, CreatedAt = now, UpdatedAt = now,
        });
        // Configured category with no attached specializations at all.
        db.ApplicationSettingsCategoryConfigs.Add(new ApplicationSettingsCategoryConfigEntity
        {
            Id = "CFG-2", CategoryId = "officers_general", IsActive = true, SortOrder = 1, CreatedAt = now, UpdatedAt = now,
        });
        await db.SaveChangesAsync();

        var result = await svc.ExportSnapshotAsync(
            [ExchangeDomain.AdmissionConditions], "single-workbook", ExportFilter.Default, default);
        var rows = result.Sheets[0].Rows;

        Assert.Equal(2, rows.Count);
        var lawRow = rows.Single(r => r["category"] == "law_bachelor");
        Assert.Equal("حملة ليسانس الحقوق", lawRow["category_name"]);
        Assert.Equal("القانون العام", lawRow["specialization"]); // resolved Arabic name, not the code
        Assert.Equal("true", lawRow["is_active"]);
        Assert.Null(lawRow["graduation_year"]); // no conditions authored yet — still exported
        var generalRow = rows.Single(r => r["category"] == "officers_general");
        Assert.Null(generalRow["specialization"]);
    }

    [Fact]
    public async Task Snapshot_exam_reservations_link_applicant_to_slot_committee_and_exam()
    {
        var (svc, db) = Create();
        await SeedCommitteeLookupAsync(db, "COM-01", "اللجنة الأولى قسم عام");
        await SeedOperationalAsync(db, "committeeInstances", "CI-1",
            """{"id":"CI-1","definitionCode":"COM-01","categoryKey":"officers_general","cycleId":"CYC-1","date":"2026-06-15","examPlanName":"اختبار الهيئة والقوام","capacity":30,"reserved":12}""");
        await SeedOperationalAsync(db, "applicants", "APP-1",
            """{"id":"APP-1","nationalId":"29801011234567","fullName":"متقدم","categoryKey":"officers_general","cycleId":"CYC-1","status":"exam_scheduled","examSlot":{"slotId":"CI-1","date":"2026-06-15","time":"09:30","location":"كلية الشرطة - القاهرة"}}""");
        await SeedOperationalAsync(db, "applicants", "APP-DRAFT",
            """{"id":"APP-DRAFT","nationalId":"29801011230000","fullName":"مسودة","status":"draft"}""");

        var result = await svc.ExportSnapshotAsync(
            [ExchangeDomain.ExamReservations], "single-workbook", ExportFilter.Default, default);
        var sheet = Assert.Single(result.Sheets);

        var row = Assert.Single(sheet.Rows); // unbooked draft never emits a reservation
        Assert.Equal("29801011234567", row["applicant_national_id"]);
        Assert.Equal("CI-1", row["slot_id"]);
        Assert.Equal("اختبار الهيئة والقوام", row["exam_name"]);
        Assert.Equal("2026-06-15", row["appointment_date"]);
        Assert.Equal("09:30", row["appointment_time"]);
        Assert.Equal("اللجنة الأولى قسم عام", row["committee_name"]);
        Assert.Equal("محجوز", row["reservation_status"]);
        Assert.Equal("exam_scheduled", row["applicant_status"]);
    }

    [Fact]
    public async Task Snapshot_acquaintance_docs_emit_sections_and_revision_history()
    {
        var (svc, db) = Create();
        var now = DateTimeOffset.UtcNow;
        await SeedOperationalAsync(db, "applicants", "APP-1",
            """{"id":"APP-1","nationalId":"29801011234567","fullName":"متقدم","status":"exam_scheduled","examSlot":{"date":"2026-06-15"}}""");
        db.ApplicantAcquaintanceDocs.Add(new ApplicantAcquaintanceDocEntity
        {
            Id = "DOC-1", CycleId = "CYC-1", ApplicantId = "APP-1", Status = "open",
            OpenedAt = now, Version = 3, CreatedAt = now, UpdatedAt = now,
        });
        db.ApplicantAcquaintanceDocSections.Add(new ApplicantAcquaintanceDocSectionEntity
        {
            Id = "SEC-1", AcquaintanceDocId = "DOC-1", SectionKey = "personal",
            DataJson = """{"fullName":"متقدم"}""", CreatedAt = now, UpdatedAt = now,
        });
        db.ApplicantAcquaintanceDocSections.Add(new ApplicantAcquaintanceDocSectionEntity
        {
            Id = "SEC-2", AcquaintanceDocId = "DOC-1", SectionKey = "residence",
            DataJson = """{"governorate":"القاهرة"}""", CreatedAt = now, UpdatedAt = now,
        });
        db.ApplicantAcquaintanceDocRevisions.Add(new ApplicantAcquaintanceDocRevisionEntity
        {
            Id = "REV-1", AcquaintanceDocId = "DOC-1", Version = 2, ChangeKind = "autosave",
            ChangedSectionKeysJson = """["personal"]""", CreatedAt = now,
        });
        db.ApplicantAcquaintanceDocRevisions.Add(new ApplicantAcquaintanceDocRevisionEntity
        {
            Id = "REV-2", AcquaintanceDocId = "DOC-1", Version = 3, ChangeKind = "submit",
            ChangedSectionKeysJson = """["residence"]""", CreatedAt = now,
        });
        await db.SaveChangesAsync();

        var result = await svc.ExportSnapshotAsync(
            [ExchangeDomain.AcquaintanceDocs], "single-workbook", ExportFilter.Default, default);
        var sheet = Assert.Single(result.Sheets);

        Assert.Equal(2, sheet.Rows.Count); // one row per section
        var personal = sheet.Rows.Single(r => r["section_key"] == "personal");
        Assert.Equal("29801011234567", personal["applicant_national_id"]);
        Assert.Equal("open", personal["doc_status"]);
        Assert.Equal("3", personal["version"]);
        Assert.Contains("متقدم", personal["section_data"]);
        Assert.Equal("2", personal["revision_count"]);
        Assert.Equal("submit", personal["last_revision_kind"]); // latest version wins
    }

    [Fact]
    public async Task Snapshot_payments_include_successful_portal_payments()
    {
        var (svc, db) = Create();
        var now = DateTimeOffset.UtcNow;
        await SeedCycleAsync(db, "CYC-ACTIVE", true);
        await SeedOperationalAsync(db, "applicants", "APP-1",
            """{"id":"APP-1","nationalId":"29801011234567","fullName":"متقدم مدفوع","cycleId":"CYC-ACTIVE","status":"exam_scheduled"}""");
        db.ApplicantPortalRecords.Add(new ApplicantPortalRecordEntity
        {
            Type = "payment", RecordId = "1234567890", ApplicantId = "APP-1",
            PayloadJson = """{"refNumber":"1234567890","applicantId":"APP-1","method":"fawry-code","amount":250,"status":"success","paidAt":1750000000000}""",
            CreatedAt = now, UpdatedAt = now,
        });
        // A pending (never-completed) payment attempt must NOT export.
        db.ApplicantPortalRecords.Add(new ApplicantPortalRecordEntity
        {
            Type = "payment", RecordId = "1234567891", ApplicantId = "APP-1",
            PayloadJson = """{"refNumber":"1234567891","applicantId":"APP-1","method":"fawry-code","amount":250,"status":"pending"}""",
            CreatedAt = now, UpdatedAt = now,
        });
        await db.SaveChangesAsync();

        var result = await svc.ExportSnapshotAsync(
            [ExchangeDomain.Payments], "single-workbook",
            ExportFilter.Default with { CycleId = "CYC-ACTIVE" }, default);

        var row = Assert.Single(result.Sheets[0].Rows);
        Assert.Equal("PAY-1234567890", row["payment_id"]);
        Assert.Equal("APP-1", row["applicant_id"]);
        Assert.Equal("29801011234567", row["national_id"]);
        Assert.Equal("متقدم مدفوع", row["applicant_name"]);
        Assert.Equal("250", row["amount"]);
        Assert.Equal("paid", row["payment_status"]);
        Assert.Equal("fawry-code", row["payment_method"]);
        Assert.Equal("1234567890", row["fawry_reference"]);
        Assert.Equal("CYC-ACTIVE", row["cycle_id"]);
        Assert.NotNull(row["payment_date"]);
    }

    [Fact]
    public async Task Snapshot_payments_dedupe_portal_rows_against_durable_ledger_by_reference()
    {
        var (svc, db) = Create();
        var now = DateTimeOffset.UtcNow;
        await SeedCycleAsync(db, "CYC-ACTIVE", true);
        db.PaymentRecords.Add(new PaymentRecordEntity
        {
            Module = "payments", Id = "PAY-LEDGER", ApplicantId = "APP-1", NationalId = "29801011234567",
            CycleId = "CYC-ACTIVE", Status = "paid",
            PayloadJson = """{"amount":"250","fawryReference":"1234567890","paidAt":"2026-06-01"}""",
            CreatedAt = now, UpdatedAt = now,
        });
        db.ApplicantPortalRecords.Add(new ApplicantPortalRecordEntity
        {
            Type = "payment", RecordId = "1234567890", ApplicantId = "APP-1",
            PayloadJson = """{"refNumber":"1234567890","applicantId":"APP-1","amount":250,"status":"success","paidAt":1750000000000}""",
            CreatedAt = now, UpdatedAt = now,
        });
        await db.SaveChangesAsync();

        var result = await svc.ExportSnapshotAsync(
            [ExchangeDomain.Payments], "single-workbook", ExportFilter.Default, default);

        var row = Assert.Single(result.Sheets[0].Rows); // ledger row wins; portal duplicate dropped
        Assert.Equal("PAY-LEDGER", row["payment_id"]);
    }

    [Fact]
    public async Task Snapshot_payments_fall_back_to_applicant_draft_payment_snapshot()
    {
        var (svc, db) = Create();
        await SeedCycleAsync(db, "CYC-ACTIVE", true);
        // Paid applicant with NO portal payment record (e.g. record stuck pending
        // or never written) — the draft's payment snapshot must still export.
        await SeedOperationalAsync(db, "applicants", "APP-DRAFT-PAID",
            """{"id":"APP-DRAFT-PAID","nationalId":"29801011234001","fullName":"متقدم بدون سجل دفع","cycleId":"CYC-ACTIVE","paymentStatus":"paid","payment":{"method":"fawry-code","refNumber":"5550001111","fawryCode":"FWR-1","amount":250,"paidAt":1750000000000}}""");
        // Unpaid applicant — must not export.
        await SeedOperationalAsync(db, "applicants", "APP-UNPAID",
            """{"id":"APP-UNPAID","nationalId":"29801011234002","fullName":"متقدم لم يدفع","cycleId":"CYC-ACTIVE","paymentStatus":"pending"}""");

        var result = await svc.ExportSnapshotAsync(
            [ExchangeDomain.Payments], "single-workbook",
            ExportFilter.Default with { CycleId = "CYC-ACTIVE" }, default);

        var row = Assert.Single(result.Sheets[0].Rows);
        Assert.Equal("PAY-5550001111", row["payment_id"]);
        Assert.Equal("29801011234001", row["national_id"]);
        Assert.Equal("250", row["amount"]);
        Assert.Equal("paid", row["payment_status"]);
        Assert.Equal("5550001111", row["fawry_reference"]);
    }

    [Fact]
    public async Task Snapshot_payments_draft_fallback_does_not_duplicate_portal_rows()
    {
        var (svc, db) = Create();
        var now = DateTimeOffset.UtcNow;
        await SeedCycleAsync(db, "CYC-ACTIVE", true);
        // Same applicant covered by BOTH a successful portal record and the
        // draft snapshot (the normal happy path) — exactly one row exports.
        await SeedOperationalAsync(db, "applicants", "APP-1",
            """{"id":"APP-1","nationalId":"29801011234567","fullName":"متقدم","cycleId":"CYC-ACTIVE","paymentStatus":"paid","payment":{"method":"fawry-code","refNumber":"1234567890","amount":250,"paidAt":1750000000000}}""");
        db.ApplicantPortalRecords.Add(new ApplicantPortalRecordEntity
        {
            Type = "payment", RecordId = "1234567890", ApplicantId = "APP-1",
            PayloadJson = """{"refNumber":"1234567890","applicantId":"APP-1","method":"fawry-code","amount":250,"status":"success","paidAt":1750000000000}""",
            CreatedAt = now, UpdatedAt = now,
        });
        await db.SaveChangesAsync();

        var result = await svc.ExportSnapshotAsync(
            [ExchangeDomain.Payments], "single-workbook", ExportFilter.Default, default);

        var row = Assert.Single(result.Sheets[0].Rows);
        Assert.Equal("PAY-1234567890", row["payment_id"]);
    }

    [Fact]
    public async Task Snapshot_admission_conditions_with_cycle_draft_exclude_normalized_rows_from_other_cycles()
    {
        var (svc, db) = Create();
        var now = DateTimeOffset.UtcNow;
        await SeedCycleAsync(db, "CYC-ACTIVE", true);
        // Stale rows in the normalized tables, authored while an OLDER cycle
        // was active. The tables carry no cycle column, so without draft-first
        // scoping these leaked into the new cycle's export as duplicates.
        db.ApplicationSettingsCategoryConfigs.Add(new ApplicationSettingsCategoryConfigEntity
        {
            Id = "CFG-OLD", CategoryId = "law_bachelor", IsActive = true, SortOrder = 0, CreatedAt = now, UpdatedAt = now,
        });
        db.ApplicationSettingsCategorySpecializations.Add(new ApplicationSettingsCategorySpecializationEntity
        {
            Id = "SP-OLD", ConfigId = "CFG-OLD", SpecializationId = "SPC-OLD", IsActive = true, CreatedAt = now, UpdatedAt = now,
        });
        db.ApplicationSettingsGraduationYears.Add(new ApplicationSettingsGraduationYearEntity
        {
            Id = "YR-OLD", CategorySpecializationId = "SP-OLD",
            GraduationYearsJson = "[2023]", GenderTypesJson = "[\"male\"]", MaritalStatusCodesJson = "[]",
            AgeMin = 20, MaxAge = 28, DivisionCodesJson = "[]", SchoolCategoryCodesJson = "[]",
            ApplicationStartDate = new DateOnly(2025, 6, 1), ApplicationEndDate = new DateOnly(2025, 6, 30),
            AgeReferenceDate = new DateOnly(2025, 6, 1), IsActive = true, GradeKind = "GRADES", MinPercentage = 55m,
            CreatedAt = now, UpdatedAt = now,
        });
        await db.SaveChangesAsync();
        await SeedOperationalAsync(db,
            "admissionSetup.applicationSettings.CYC-ACTIVE", "admissionSetup.applicationSettings.CYC-ACTIVE",
            """
            {"id":"admissionSetup.applicationSettings.CYC-ACTIVE","cycleId":"CYC-ACTIVE","version":1,
             "updatedAt":"2026-06-01T00:00:00Z","headers":{},
             "approved":[{"id":"ROW-1","kind":"university","categoryCode":"law_bachelor",
               "type":["male"],"scoreMin":65,"graduationYears":[2026],
               "header":{"applicationStart":"2026-06-01","applicationEnd":"2026-06-30",
                 "ageReferenceDate":"2026-05-01","maxAge":28}}],
             "local":[]}
            """);

        var result = await svc.ExportSnapshotAsync(
            [ExchangeDomain.AdmissionConditions], "single-workbook",
            ExportFilter.Default with { CycleId = "CYC-ACTIVE" }, default);
        var rows = result.Sheets[0].Rows;

        // Only the selected cycle's draft condition exports — the stale
        // normalized year row (grad-year 2023, 55%) must not duplicate it.
        var row = Assert.Single(rows);
        Assert.Equal("law_bachelor", row["category"]);
        Assert.Equal("2026", row["graduation_year"]);
        Assert.Equal("65", row["min_percentage"]);
    }

    [Fact]
    public async Task Snapshot_admission_conditions_include_cycle_draft_rules()
    {
        var (svc, db) = Create();
        await SeedCycleAsync(db, "CYC-ACTIVE", true);
        await SeedLookupAsync(db, "marital-statuses", "MAR-01", "أعزب");
        await SeedLookupAsync(db, "academic-degrees", "DEG-01", "ليسانس");
        await SeedLookupAsync(db, "excellence-criteria", "EXC-01", "النسبة المئوية");
        await SeedCommitteeLookupAsync(db, "COM-01", "لجنة الضباط الأولى");
        await SeedOperationalAsync(db,
            "admissionSetup.applicationSettings.CYC-ACTIVE", "admissionSetup.applicationSettings.CYC-ACTIVE",
            """
            {"id":"admissionSetup.applicationSettings.CYC-ACTIVE","cycleId":"CYC-ACTIVE","version":1,
             "updatedAt":"2026-06-01T00:00:00Z","headers":{},
             "approved":[{"id":"ROW-1","kind":"university","categoryCode":"law_bachelor",
               "facultyNameAr":"كلية الحقوق","specializationNameAr":"القانون العام",
               "type":["male"],"maritalStatus":["MAR-01"],"excellenceMode":"EXC-01",
               "grade":"","gradeMax":"","scoreMin":65,"scoreMax":80,
               "academicDegrees":["DEG-01"],"committees":["COM-01"],"graduationYears":[2024,2025],
               "header":{"applicationStart":"2026-06-01","applicationEnd":"2026-06-30",
                 "ageReferenceDate":"2026-05-01","maritalStatus":["MAR-01"],"maxAge":28}}],
             "local":[]}
            """);

        var result = await svc.ExportSnapshotAsync(
            [ExchangeDomain.AdmissionConditions], "single-workbook",
            ExportFilter.Default with { CycleId = "CYC-ACTIVE" }, default);
        var rows = result.Sheets[0].Rows;

        Assert.Equal(2, rows.Count); // fans out one row per graduation year
        var row = rows.Single(r => r["graduation_year"] == "2024");
        Assert.Equal("law_bachelor", row["category"]);
        Assert.Equal("كلية الحقوق", row["faculty"]);
        Assert.Equal("القانون العام", row["specialization"]);
        Assert.Equal("male", row["gender"]);
        Assert.Equal("أعزب", row["marital_status"]);
        Assert.Equal("ليسانس", row["academic_degree"]);
        Assert.Equal("لجنة الضباط الأولى", row["committee"]);
        Assert.Equal("النسبة المئوية", row["excellence_criterion"]);
        Assert.Equal("65", row["min_percentage"]);
        Assert.Equal("80", row["max_percentage"]);
        Assert.Equal("28", row["max_age"]);
        Assert.Equal("2026-06-01", row["application_start_date"]);
        Assert.Equal("2026-06-30", row["application_end_date"]);
        Assert.Equal("2026-05-01", row["age_reference_date"]);
        Assert.Equal("معتمد", row["condition_status"]);
    }

    [Fact]
    public async Task Snapshot_admission_conditions_resolve_year_row_condition_codes_to_names()
    {
        var (svc, db) = Create();
        var now = DateTimeOffset.UtcNow;
        await SeedCycleAsync(db, "CYC-ACTIVE", true);
        await SeedLookupAsync(db, "marital-statuses", "MAR-01", "أعزب");
        await SeedLookupAsync(db, "school-categories", "SCH-01", "مدارس حكومية");
        await SeedLookupAsync(db, "applicant-divisions", "DIV-01", "علمي علوم");
        await SeedAcademicGradeLookupAsync(db, "GRD-01", "جيد جداً");
        db.ApplicationSettingsCategoryConfigs.Add(new ApplicationSettingsCategoryConfigEntity
        {
            Id = "CFG-1", CategoryId = "officers_general", IsActive = true, SortOrder = 0, CreatedAt = now, UpdatedAt = now,
        });
        db.ApplicationSettingsCategorySpecializations.Add(new ApplicationSettingsCategorySpecializationEntity
        {
            Id = "SP-1", ConfigId = "CFG-1", SpecializationId = "__default__", IsActive = true, CreatedAt = now, UpdatedAt = now,
        });
        db.ApplicationSettingsGraduationYears.Add(new ApplicationSettingsGraduationYearEntity
        {
            Id = "YR-1", CategorySpecializationId = "SP-1",
            GraduationYearsJson = "[2026]", GenderTypesJson = "[\"male\"]", MaritalStatusCodesJson = "[\"MAR-01\"]",
            AgeMin = 17, MaxAge = 24, DivisionCodesJson = "[\"DIV-01\"]", SchoolCategoryCodesJson = "[\"SCH-01\"]",
            ApplicationStartDate = new DateOnly(2026, 6, 1), ApplicationEndDate = new DateOnly(2026, 6, 30),
            AgeReferenceDate = new DateOnly(2026, 5, 1), IsActive = true, GradeKind = "TAGDIR", AcademicGradeId = "GRD-01",
            CreatedAt = now, UpdatedAt = now,
        });
        await db.SaveChangesAsync();

        var result = await svc.ExportSnapshotAsync(
            [ExchangeDomain.AdmissionConditions], "single-workbook", ExportFilter.Default, default);

        var row = Assert.Single(result.Sheets[0].Rows);
        Assert.Equal("أعزب", row["marital_status"]);
        Assert.Equal("مدارس حكومية", row["school_category"]);
        Assert.Equal("علمي علوم", row["division"]);
        Assert.Equal("جيد جداً", row["min_grade"]); // TAGDIR grade resolved, no longer leaked into min_percentage
        Assert.Null(row["min_percentage"]);
        Assert.Equal("2026-06-01", row["application_start_date"]);
        Assert.Equal("2026-06-30", row["application_end_date"]);
        Assert.Equal("2026-05-01", row["age_reference_date"]);
        Assert.Equal("معتمد", row["condition_status"]);
    }
}
