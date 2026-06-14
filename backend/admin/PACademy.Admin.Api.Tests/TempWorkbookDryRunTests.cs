// TEMPORARY DRY-RUN HARNESS — NOT FOR COMMIT.
// Replays the real internal-data-2026-06-11 workbook (converted to JSON at
// /tmp/internal-data-workbook.json) through the import engine end-to-end and
// writes a per-row outcome report to /tmp/dryrun-report.json.
using System.Text.Json;
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

public sealed class TempWorkbookDryRunTests
{
    private sealed class DryRunHostEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Testing";
        public string ApplicationName { get; set; } = "PACademy.Admin.Api.Tests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    [Fact]
    public async Task DryRun_full_workbook_for_all_applicants()
    {
        const string workbookPath = "/tmp/internal-data-workbook.json";
        if (!File.Exists(workbookPath)) return; // harness input only exists locally

        var workbook = JsonNode.Parse(await File.ReadAllTextAsync(workbookPath))!.AsObject();

        var options = new DbContextOptionsBuilder<AdminDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .AddInterceptors(new ChangeTrackingInterceptor(new SystemActorProvider()))
            .Options;
        var db = new AdminDbContext(options);
        var sink = new DbAuditSink(db);
        var records = new OperationalRecordsService(db, new HttpContextAccessor(), sink, new OperationalRecordStore(db));
        var svc = new DataExchangeService(db, records, sink, new SystemActorProvider(), new DryRunHostEnvironment());
        var store = new OperationalRecordStore(db);

        static List<Dictionary<string, string?>> SheetRows(JsonObject wb, string sheet) =>
            (wb[sheet] as JsonArray ?? [])
                .OfType<JsonObject>()
                .Select(r => r.ToDictionary(p => p.Key, p => (string?)p.Value?.ToString(), StringComparer.Ordinal))
                .ToList();

        var applicantRows = SheetRows(workbook, "Applicants");
        var scheduleRows = SheetRows(workbook, "ExamSchedules");
        var reservationRows = SheetRows(workbook, "ExamReservations");
        var resultRows = SheetRows(workbook, "ExamResults");

        // Active cycle from the workbook's own cycle id.
        var cycleId = applicantRows.Select(r => r.GetValueOrDefault("cycleId")).FirstOrDefault(c => !string.IsNullOrWhiteSpace(c)) ?? "CYC-DRY";
        db.AdmissionCycles.Add(new AdmissionCycleEntity
        {
            Id = cycleId!, NameAr = "دورة الاختبار", Year = 2026, Status = "open", IsActive = true,
            PayloadJson = $$"""{"id":"{{cycleId}}","isActive":true}""",
            CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow,
        });

        // Tests lookup from the workbook's own exam id/name pairs (staging carries these).
        foreach (var pair in reservationRows
                     .Select(r => (Id: r.GetValueOrDefault("exam_id"), Name: r.GetValueOrDefault("exam_name")))
                     .Concat(resultRows.Select(r => (Id: r.GetValueOrDefault("examCode"), Name: r.GetValueOrDefault("examCode"))))
                     .Where(p => !string.IsNullOrWhiteSpace(p.Id))
                     .DistinctBy(p => p.Id))
        {
            if (db.LookupRows.Any(x => x.LookupKey == "tests" && x.Code == pair.Id)) continue;
            db.LookupRows.Add(new LookupRowEntity
            {
                LookupKey = "tests", Code = pair.Id!, Name = pair.Name ?? pair.Id!, IsActive = true,
                PayloadJson = "{}", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow,
            });
        }
        // Committees directory — staging's is admin-authored; mirror its naming
        // convention (CMT-i → «لجنة i») so the committee-name match rung is
        // exercised at scale the way it will be on staging.
        var definitionCodes = scheduleRows
            .Select(r => r.GetValueOrDefault("definitionCode"))
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Distinct()
            .ToList();
        foreach (var code in definitionCodes)
        {
            var number = new string(code!.Where(char.IsDigit).ToArray()).TrimStart('0');
            db.LookupRows.Add(new LookupRowEntity
            {
                LookupKey = "committees", Code = code!, Name = $"لجنة {number}", IsActive = true,
                PayloadJson = "{}", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow,
            });
        }

        // test-results lookup: workbook results use RES-xx codes.
        foreach (var (code, outcome) in new[] { ("RES-01", "pass"), ("RES-02", "fail"), ("RES-03", "defer"), ("RES-04", "withdrawn") })
        {
            db.LookupRows.Add(new LookupRowEntity
            {
                LookupKey = "test-results", Code = code, Name = code, IsActive = true,
                PayloadJson = $$"""{"code":"{{code}}","outcome":"{{outcome}}"}""",
                CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow,
            });
        }
        await db.SaveChangesAsync();

        // Seed applicants + committee instances from the workbook itself.
        foreach (var row in applicantRows)
        {
            var id = row.GetValueOrDefault("id");
            var nid = row.GetValueOrDefault("nationalId");
            if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(nid)) continue;
            var payload = new JsonObject { ["id"] = id, ["nationalId"] = nid };
            foreach (var key in new[] { "name", "categoryKey", "cycleId", "gender", "status" })
                if (row.GetValueOrDefault(key) is { Length: > 0 } v) payload[key] = v;
            await store.UpsertAsync("applicants", id!, payload, default);
        }
        foreach (var row in scheduleRows)
        {
            var id = row.GetValueOrDefault("id");
            if (string.IsNullOrWhiteSpace(id)) continue;
            var payload = new JsonObject { ["id"] = id };
            foreach (var key in new[] { "cycleId", "categoryKey", "definitionCode", "date", "time", "capacity", "reserved" })
                if (row.GetValueOrDefault(key) is { Length: > 0 } v) payload[key] = v;
            await store.UpsertAsync("committeeInstances", id!, payload, default);
        }

        // ── DIAGNOSTIC SEED: the cycle's exam plan per category, so the curated
        // read-back can resolve the primary booked exam (firstPlannedByCategory)
        // exactly the way staging did when it produced this workbook. Ordered so
        // TST-01 (القدرات) is the first planned exam — matching the workbook. ──
        var examOrder = new[] { "TST-01", "TST-02", "TST-03", "TST-06", "TST-08", "TST-09", "TST-10", "TST-11", "TST-12", "TST-13", "TST-14" };
        var planCategories = applicantRows
            .Select(r => r.GetValueOrDefault("categoryKey"))
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Distinct(StringComparer.Ordinal)
            .ToList();
        foreach (var category in planCategories)
        {
            var examsArr = new JsonArray();
            for (var i = 0; i < examOrder.Length; i++)
                examsArr.Add(new JsonObject { ["examId"] = examOrder[i], ["order"] = i + 1 });
            await store.UpsertAsync("examPlans", $"PLAN-{category}", new JsonObject
            {
                ["id"] = $"PLAN-{category}", ["cycleId"] = cycleId, ["categoryKey"] = category, ["exams"] = examsArr,
            }, default);
        }

        // ── Preview + apply the reservations sheet, then the results sheet ──
        var preview = await svc.PreviewAsync(new ImportPreviewRequest([new("ExamReservations", reservationRows)]), default);
        var apply = await svc.ApplyAsync(new ImportApplyRequest(
            [new("ExamReservations", reservationRows), new("ExamResults", resultRows)],
            "new-and-changed", false, false), default);

        // Re-import to prove idempotency at scale.
        var svc2 = new DataExchangeService(db, records, sink, new SystemActorProvider(), new DryRunHostEnvironment());
        var reapply = await svc2.ApplyAsync(new ImportApplyRequest(
            [new("ExamReservations", reservationRows)], "new-and-changed", false, false), default);

        // ── Per-applicant verification: every applicant with ≥1 valid row is booked ──
        var invalidByError = preview.Rows
            .Where(r => r.Class == "invalid")
            .SelectMany(r => r.Errors.Select(e => System.Text.RegularExpressions.Regex.Replace(e, @"[0-9]{4,}|\d{4}-\d{2}-\d{2}", "…")))
            .GroupBy(e => e)
            .ToDictionary(g => g.Key, g => g.Count());

        var validNids = new HashSet<string>(StringComparer.Ordinal);
        var invalidRowsByNid = new Dictionary<string, int>(StringComparer.Ordinal);
        for (var i = 0; i < reservationRows.Count; i++)
        {
            var nid = reservationRows[i].GetValueOrDefault("applicant_national_id") ?? "";
            if (preview.Rows[i].Class == "invalid") invalidRowsByNid[nid] = invalidRowsByNid.GetValueOrDefault(nid) + 1;
            else validNids.Add(nid);
        }

        var applicants = await records.ListAsync("applicants", default);
        var byNid = applicants
            .Where(a => a["nationalId"] is not null)
            .ToDictionary(a => a["nationalId"]!.ToString(), a => a, StringComparer.Ordinal);

        var bookedOk = new List<string>();
        var bookedMissing = new List<string>();
        var scheduleEntryCounts = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var nid in validNids)
        {
            var applicant = byNid.GetValueOrDefault(nid);
            var slotDate = applicant?["examSlot"] is JsonObject slot ? slot["date"]?.ToString() : null;
            var schedules = applicant?["testSchedules"] as JsonArray;
            scheduleEntryCounts[nid] = schedules?.Count ?? 0;
            if (!string.IsNullOrWhiteSpace(slotDate) && schedules is { Count: > 0 }) bookedOk.Add(nid);
            else bookedMissing.Add(nid);
        }

        // Duplicate guard after double import: per applicant, testSchedules entries
        // must not exceed their distinct valid exam codes.
        var duplicateOffenders = new List<string>();
        foreach (var nid in validNids)
        {
            var distinctExams = reservationRows
                .Where((r, i) => preview.Rows[i].Class != "invalid" && r.GetValueOrDefault("applicant_national_id") == nid)
                .Select(r => r.GetValueOrDefault("exam_id"))
                .Distinct()
                .Count();
            if (scheduleEntryCounts.GetValueOrDefault(nid) > distinctExams) duplicateOffenders.Add(nid);
        }

        var followUpApplied = applicants.Count(a => a["followUp"] is JsonObject f && f.Count > 0);

        // ── DIAGNOSTIC: replicate the read-back key derivation off the persisted
        // applicants (nid|examId from each testSchedules entry) and intersect with
        // the import business keys (applicant_national_id|exam_id). Tells us whether
        // the stored booking keys actually match what re-import looks up. ──
        var storedKeys = new HashSet<string>(StringComparer.Ordinal);
        var totalSchedules = 0;
        var importKeys = new HashSet<string>(StringComparer.Ordinal);
        var importKeysInStore = 0;
        var sampleLines = new List<string>();
        string? diagError = null;
        try
        {
            foreach (var a in applicants)
            {
                var nid = a["nationalId"]?.ToString();
                if (string.IsNullOrWhiteSpace(nid)) continue;
                foreach (var node in a["testSchedules"] as JsonArray ?? [])
                {
                    if (node is not JsonObject s) continue;
                    totalSchedules++;
                    var examId = s["examId"]?.ToString() ?? s["testCode"]?.ToString() ?? s["code"]?.ToString();
                    if (!string.IsNullOrWhiteSpace(examId)) storedKeys.Add($"{nid}|{examId}");
                }
            }
            for (var i = 0; i < reservationRows.Count; i++)
            {
                if (preview.Rows[i].Class == "invalid") continue;
                importKeys.Add($"{reservationRows[i].GetValueOrDefault("applicant_national_id")}|{reservationRows[i].GetValueOrDefault("exam_id")}");
            }
            importKeysInStore = importKeys.Count(k => storedKeys.Contains(k));
            var activeCycle = db.AdmissionCycles.Where(c => c.IsActive).Select(c => c.Id).FirstOrDefault();
            var withSchedules = applicants.Count(a => a["testSchedules"] is JsonArray ts && ts.Count > 0);
            var cycleMatch = applicants.Count(a => string.Equals(a["cycleId"]?.ToString(), activeCycle, StringComparison.OrdinalIgnoreCase));
            var bookedRoster = await svc2.ListBookedApplicantsAsync(null, default);
            sampleLines.Add($"activeCycle={activeCycle} applicants={applicants.Count} withSchedules={withSchedules} cycleMatch={cycleMatch} bookedRosterCount={bookedRoster.Count}");
            sampleLines.Add($"sampleApplicantCycleId={applicants.FirstOrDefault(a => a["testSchedules"] is JsonArray t && t.Count > 0)?["cycleId"]}");
            foreach (var nid in validNids.Take(3))
            {
                var a = byNid.GetValueOrDefault(nid);
                var sched = a?["testSchedules"] as JsonArray;
                var ids = sched is null ? "" : string.Join(",", sched.OfType<JsonObject>().Select(s => s["examId"]?.ToString() ?? s["testCode"]?.ToString()));
                var slotDate = a?["examSlot"] is JsonObject slot ? slot["date"]?.ToString() : null;
                sampleLines.Add($"{nid} count={sched?.Count ?? 0} slotDate={slotDate} examIds=[{ids}]");
            }
        }
        catch (Exception ex) { diagError = $"{ex.GetType().Name}: {ex.Message}"; }

        var report = new JsonObject
        {
            ["workbook"] = new JsonObject
            {
                ["applicants"] = applicantRows.Count,
                ["schedules"] = scheduleRows.Count,
                ["reservations"] = reservationRows.Count,
                ["results"] = resultRows.Count,
                ["uniqueReservationNids"] = reservationRows.Select(r => r.GetValueOrDefault("applicant_national_id")).Distinct().Count(),
            },
            ["previewCounts"] = new JsonObject(preview.Counts.Select(kv => new KeyValuePair<string, JsonNode?>(kv.Key, kv.Value))),
            ["invalidReasonHistogram"] = new JsonObject(invalidByError.Select(kv => new KeyValuePair<string, JsonNode?>(kv.Key, kv.Value))),
            ["apply"] = new JsonObject
            {
                ["attempted"] = apply.AttemptedCount, ["inserted"] = apply.InsertedCount, ["updated"] = apply.UpdatedCount,
                ["skipped"] = apply.SkippedCount, ["failed"] = apply.FailedCount,
            },
            ["reapply"] = new JsonObject
            {
                ["attempted"] = reapply.AttemptedCount, ["inserted"] = reapply.InsertedCount, ["updated"] = reapply.UpdatedCount,
                ["skipped"] = reapply.SkippedCount, ["failed"] = reapply.FailedCount,
            },
            ["applicantsWithValidRows"] = validNids.Count,
            ["applicantsBookedOk"] = bookedOk.Count,
            ["applicantsBookedMissing"] = new JsonArray(bookedMissing.Select(n => (JsonNode?)n).ToArray()),
            ["duplicateOffendersAfterReimport"] = new JsonArray(duplicateOffenders.Select(n => (JsonNode?)n).ToArray()),
            ["applicantsWithFollowUpOutcomes"] = followUpApplied,
            ["diag"] = new JsonObject
            {
                ["totalStoredSchedules"] = totalSchedules,
                ["distinctStoredKeys"] = storedKeys.Count,
                ["distinctImportKeys"] = importKeys.Count,
                ["importKeysFoundInStore"] = importKeysInStore,
                ["diagError"] = diagError,
                ["sampleBooked"] = new JsonArray(sampleLines.Select(l => (JsonNode?)l).ToArray()),
            },
        };
        await File.WriteAllTextAsync("/tmp/dryrun-report.json",
            report.ToJsonString(new JsonSerializerOptions { WriteIndented = true, Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping }));

        // Hard assertions: every applicant with at least one valid reservation row
        // must end up booked, and re-import must never insert duplicates.
        Assert.Empty(bookedMissing);
        Assert.Empty(duplicateOffenders);
        Assert.Equal(0, reapply.InsertedCount);
    }
}
