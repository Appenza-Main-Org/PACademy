using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Modules.Admissions;
using PACademy.Admin.Api.Modules.Audit;
using PACademy.Admin.Api.Modules.Lookups;
using PACademy.Admin.Api.Modules.OperationalRecords;
using PACademy.Admin.Api.Modules.Reports.Queries;
using PACademy.Admin.Api.Persistence;
using PACademy.Shared.Persistence.ChangeTracking;

namespace PACademy.Admin.Api.Tests.Reports;

/// <summary>
/// The overview endpoints must derive every figure from live rows — no
/// hardcoded pass rates, no formula-generated heatmaps, no canned
/// integration rows, and honest empty lists for on-prem-only sections.
/// </summary>
public sealed class ReportsOverviewServiceTests
{
    private static (ReportsOverviewService svc, AdminDbContext db) Create(params (string Key, string Value)[] config)
    {
        var options = new DbContextOptionsBuilder<AdminDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .AddInterceptors(new ChangeTrackingInterceptor(new SystemActorProvider()))
            .Options;
        var db = new AdminDbContext(options);
        var records = new OperationalRecordsService(db, new HttpContextAccessor(), new DbAuditSink(db), new OperationalRecordStore(db));
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(config.ToDictionary(x => x.Key, x => (string?)x.Value))
            .Build();
        return (new ReportsOverviewService(records, db, configuration), db);
    }

    private static Task SeedOperationalAsync(AdminDbContext db, string module, string id, string payloadJson)
        => new OperationalRecordStore(db).UpsertAsync(module, id, JsonNode.Parse(payloadJson)!.AsObject(), default);

    private static async Task SeedCycleAsync(AdminDbContext db, string id, bool isActive, string openDate, string closeDate)
    {
        db.AdmissionCycles.Add(new AdmissionCycleEntity
        {
            Id = id,
            NameAr = id,
            Year = 2026,
            Status = isActive ? "active" : "closed",
            IsActive = isActive,
            PayloadJson =
                $$"""{"id":"{{id}}","nameAr":"{{id}}","year":2026,"status":"{{(isActive ? "active" : "closed")}}","isActive":{{isActive.ToString().ToLowerInvariant()}},"openDate":"{{openDate}}","closeDate":"{{closeDate}}"}""",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();
    }

    private static async Task SeedTestLookupAsync(AdminDbContext db, string code, string name)
    {
        db.LookupRows.Add(new LookupRowEntity
        {
            LookupKey = "tests", Code = code, Name = name, IsActive = true,
            PayloadJson = $$"""{"code":"{{code}}","name":"{{name}}"}""",
            CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();
    }

    private static JsonNode Json(object result) => JsonNode.Parse(JsonSerializer.Serialize(result))!;

    [Fact]
    public async Task TestResults_derive_from_followUp_outcomes_not_fabricated_rates()
    {
        var (svc, db) = Create();
        await SeedCycleAsync(db, "CYC-2026", isActive: true, "2026-01-01", "2026-12-01");
        await SeedTestLookupAsync(db, "TST-01", "الكشف الطبي");
        await SeedTestLookupAsync(db, "TST-02", "اختبار اللياقة");
        await SeedOperationalAsync(db, "applicants", "a1",
            """{"id":"a1","nationalId":"29801011234567","cycleId":"CYC-2026","birthGovernorate":"القاهرة","examSlot":{"slotId":"s1","date":"2026-06-01"},"followUp":{"TST-01":"passed","TST-02":"failed"}}""");
        await SeedOperationalAsync(db, "applicants", "a2",
            """{"id":"a2","nationalId":"29801011234568","cycleId":"CYC-2026","birthGovernorate":"الجيزة","examSlot":{"slotId":"s1","date":"2026-06-01"},"followUp":{"TST-01":"failed"}}""");
        await SeedOperationalAsync(db, "applicants", "a3",
            """{"id":"a3","nationalId":"29801011234569","cycleId":"CYC-2026","birthGovernorate":"القاهرة","examSlot":{"slotId":"s1","date":"2026-06-01"},"followUp":{"TST-01":"passed","TST-02":"in-progress"}}""");

        var result = Json(await svc.TestResultsAsync(default));

        var byKind = result["byKind"]!.AsArray();
        var medical = byKind.Single(x => x!["kind"]!.GetValue<string>() == "medical")!;
        Assert.Equal(2, medical["passed"]!.GetValue<int>());
        Assert.Equal(1, medical["failed"]!.GetValue<int>());
        Assert.Equal(66.7, medical["passRate"]!.GetValue<double>());

        var physical = byKind.Single(x => x!["kind"]!.GetValue<string>() == "physical")!;
        Assert.Equal(0, physical["passed"]!.GetValue<int>());
        Assert.Equal(1, physical["failed"]!.GetValue<int>());
        Assert.Equal(1, physical["pending"]!.GetValue<int>());

        var governorates = result["governorateHeatmap"]!["governorates"]!.AsArray().Select(x => x!.GetValue<string>()).ToList();
        Assert.Contains("القاهرة", governorates);
        Assert.Contains("الجيزة", governorates);
    }

    [Fact]
    public async Task TestResults_empty_when_no_outcomes_recorded()
    {
        var (svc, db) = Create();
        await SeedCycleAsync(db, "CYC-2026", isActive: true, "2026-01-01", "2026-12-01");
        await SeedOperationalAsync(db, "applicants", "a1",
            """{"id":"a1","nationalId":"29801011234567","cycleId":"CYC-2026","stage":4}""");

        var result = Json(await svc.TestResultsAsync(default));

        Assert.Empty(result["byKind"]!.AsArray());
        Assert.Empty(result["governorateHeatmap"]!["governorates"]!.AsArray());
    }

    [Fact]
    public async Task Funnel_counts_cumulative_reach_per_canonical_stage()
    {
        var (svc, db) = Create();
        await SeedCycleAsync(db, "CYC-2026", isActive: true, "2026-01-01", "2026-12-01");
        await SeedOperationalAsync(db, "applicants", "a1", """{"id":"a1","nationalId":"1","cycleId":"CYC-2026","stage":1}""");
        await SeedOperationalAsync(db, "applicants", "a2", """{"id":"a2","nationalId":"2","cycleId":"CYC-2026","stage":6}""");
        await SeedOperationalAsync(db, "applicants", "a3", """{"id":"a3","nationalId":"3","cycleId":"CYC-2026","stage":6}""");
        await SeedOperationalAsync(db, "applicants", "a4", """{"id":"a4","nationalId":"4","cycleId":"CYC-2026","stage":11}""");

        var points = Json(await svc.FunnelAsync(default)).AsArray();

        Assert.Equal(11, points.Count);
        Assert.Equal("رقم الهاتف", points[0]!["stageLabel"]!.GetValue<string>());
        Assert.Equal(4, points[0]!["count"]!.GetValue<int>());
        Assert.Equal(3, points[5]!["count"]!.GetValue<int>());   // stage 6 — reached by a2, a3, a4
        Assert.Equal(1, points[10]!["count"]!.GetValue<int>());  // stage 11 — a4 only
        Assert.Equal(0, points[0]!["dropOffFromPrevPercent"]!.GetValue<double>());
    }

    [Fact]
    public async Task Funnel_derives_stage_for_rows_without_one_from_real_milestones()
    {
        var (svc, db) = Create();
        await SeedCycleAsync(db, "CYC-2026", isActive: true, "2026-01-01", "2026-12-01");
        // Admin-created / imported rows carry no `stage` — milestones decide.
        await SeedOperationalAsync(db, "applicants", "a1",
            """{"id":"a1","nationalId":"1","cycleId":"CYC-2026","status":"approved"}""");
        await SeedOperationalAsync(db, "applicants", "a2",
            """{"id":"a2","nationalId":"2","cycleId":"CYC-2026","paymentStatus":"paid","examSlot":{"slotId":"s1","date":"2026-06-01"}}""");
        await SeedOperationalAsync(db, "applicants", "a3",
            """{"id":"a3","nationalId":"3","cycleId":"CYC-2026","paymentStatus":"paid"}""");
        await SeedOperationalAsync(db, "applicants", "a4",
            """{"id":"a4","nationalId":"4","cycleId":"CYC-2026"}""");

        var points = Json(await svc.FunnelAsync(default)).AsArray();

        Assert.Equal(4, points[0]!["count"]!.GetValue<int>());   // everyone reached stage 1
        Assert.Equal(3, points[6]!["count"]!.GetValue<int>());   // stage 7 — paid rows + approved
        Assert.Equal(2, points[7]!["count"]!.GetValue<int>());   // stage 8 — booked + approved
        Assert.Equal(1, points[10]!["count"]!.GetValue<int>());  // stage 11 — approved only
    }

    [Fact]
    public async Task CycleSnapshot_buckets_real_registrations_and_omits_absent_previous_cycle()
    {
        var (svc, db) = Create();
        await SeedCycleAsync(db, "CYC-2026", isActive: true, "2026-01-01", "2026-03-01");
        await SeedOperationalAsync(db, "applicants", "a1",
            """{"id":"a1","nationalId":"1","cycleId":"CYC-2026","status":"approved","registeredAt":"2026-01-05T10:00:00Z"}""");
        await SeedOperationalAsync(db, "applicants", "a2",
            """{"id":"a2","nationalId":"2","cycleId":"CYC-2026","status":"pending","registeredAt":"2026-02-10T10:00:00Z"}""");

        var snapshot = Json(await svc.CycleSnapshotAsync(default));

        Assert.Equal(2, snapshot["totalApplicants"]!.GetValue<int>());
        Assert.Equal(1, snapshot["finalApproved"]!.GetValue<int>());
        Assert.Equal(50, snapshot["acceptanceRate"]!.GetValue<double>());
        Assert.Equal(2, snapshot["registrationTempo"]!["thisCycle"]!.AsArray().Sum(x => x!["value"]!.GetValue<int>()));
        Assert.Empty(snapshot["registrationTempo"]!["prevCycle"]!.AsArray());
        Assert.Equal(0, snapshot["registrationTempo"]!["deltaPercent"]!.GetValue<double>());
        Assert.Equal(0, snapshot["prevCycleAcceptanceRate"]!.GetValue<double>());
        Assert.False(string.IsNullOrWhiteSpace(snapshot["hijriCloseDate"]!.GetValue<string>()));
    }

    [Fact]
    public async Task OperationalStatus_reports_today_instances_and_empty_onprem_sections()
    {
        var (svc, db) = Create();
        await SeedCycleAsync(db, "CYC-2026", isActive: true, "2026-01-01", "2026-12-01");
        var today = DateTimeOffset.UtcNow.ToOffset(CairoOffset()).ToString("yyyy-MM-dd");
        db.CommitteeInstances.Add(new PACademy.Admin.Api.Modules.Committees.CommitteeInstanceEntity
        {
            Id = "ci-1",
            DefinitionCode = "CMT-01",
            CycleId = "CYC-2026",
            CategoryKey = "officers_general",
            Date = DateOnly.Parse(today),
            Capacity = 40,
            Reserved = 12,
            PayloadJson = $$"""{"id":"ci-1","definitionCode":"CMT-01","cycleId":"CYC-2026","date":"{{today}}","capacity":40,"reserved":12}""",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var result = Json(await svc.OperationalStatusAsync(default));

        var committee = Assert.Single(result["committees"]!.AsArray());
        Assert.Equal(12, committee!["todayQueue"]!.GetValue<int>());
        Assert.Equal(0, committee["todayProcessed"]!.GetValue<int>());
        Assert.False(committee["signedOffToday"]!.GetValue<bool>());
        Assert.Empty(result["medicalStations"]!.AsArray());
        Assert.Empty(result["boardSessions"]!.AsArray());
        Assert.Empty(result["ongoingExams"]!.AsArray());
    }

    [Fact]
    public async Task Integrations_derive_status_from_configured_gateway_modes()
    {
        var (svc, _) = Create(("Moi:Mode", "simulated"), ("Biometric:Mode", "real"));

        var rows = await svc.IntegrationsAsync(default);

        Assert.Equal("healthy", rows.Single(x => x["key"]!.GetValue<string>() == "moi")["status"]!.GetValue<string>());
        Assert.Equal("degraded", rows.Single(x => x["key"]!.GetValue<string>() == "biometric")["status"]!.GetValue<string>());
        Assert.All(rows, row => Assert.Equal(0, row["callsToday"]!.GetValue<int>()));
    }

    private static TimeSpan CairoOffset()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Africa/Cairo").GetUtcOffset(DateTimeOffset.UtcNow);
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeSpan.Zero;
        }
    }
}
