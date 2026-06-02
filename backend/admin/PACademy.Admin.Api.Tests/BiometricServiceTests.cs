using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Modules.Biometric;
using PACademy.Admin.Api.Persistence;
using PACademy.Shared.Audit;

namespace PACademy.Admin.Api.Tests;

public sealed class BiometricServiceTests
{
    [Fact]
    public async Task LookupFindsApplicantByStoredBarcode()
    {
        await using var db = CreateDb();
        var service = CreateService(db);
        await SeedApplicantAsync(db, applicantId: "APP-1", nationalId: "29901010101010", committee: "لجنة طلبة 1");
        await service.EnrollAsync(new JsonObject
        {
            ["applicantId"] = "APP-1",
            ["nationalId"] = "29901010101010",
            ["barcode"] = "26-CAI-00000001",
            ["cycleId"] = "CYC-2026-M",
            ["userId"] = "U-006",
            ["faceCaptured"] = true,
            ["fingerprintCaptured"] = true,
            ["fingerprintCount"] = 2
        }, TestContext.Current.CancellationToken);

        var lookup = await service.GetApplicantAsync(null, null, "26-CAI-00000001", TestContext.Current.CancellationToken);

        Assert.NotNull(lookup);
        Assert.Equal("APP-1", AdminRecordJson.StringProp(lookup["applicant"]!.AsObject(), "id"));
    }

    [Fact]
    public async Task LinkPreviousEnrollmentCreatesCurrentCycleEnrollmentWithSourceReference()
    {
        await using var db = CreateDb();
        var service = CreateService(db);
        await SeedApplicantAsync(db, applicantId: "APP-2", nationalId: "29902020202020", committee: "لجنة طلبة 2");
        await service.EnrollAsync(new JsonObject
        {
            ["applicantId"] = "APP-2",
            ["nationalId"] = "29902020202020",
            ["barcode"] = "25-CAI-00000002",
            ["cycleId"] = "CYC-2025-M",
            ["userId"] = "U-006",
            ["faceCaptured"] = true,
            ["fingerprintCaptured"] = true,
            ["fingerprintCount"] = 3
        }, TestContext.Current.CancellationToken);

        var linked = await service.LinkPreviousEnrollmentAsync(new JsonObject
        {
            ["applicantId"] = "APP-2",
            ["nationalId"] = "29902020202020",
            ["barcode"] = "26-CAI-00000002",
            ["cycleId"] = "CYC-2026-M",
            ["userId"] = "U-007"
        }, TestContext.Current.CancellationToken);

        Assert.Equal("CYC-2026-M", AdminRecordJson.StringProp(linked, "cycleId"));
        Assert.Equal("CYC-2025-M", AdminRecordJson.StringProp(linked, "linkedFromCycleId"));
        Assert.Equal("linked_previous", AdminRecordJson.StringProp(linked, "source"));
        Assert.Equal(3, AdminRecordJson.NumberProp(linked, "fingerprintCount"));
    }

    [Fact]
    public async Task VerifyAddsVoiceAlertsForWrongExamDateAndCommitteeMismatch()
    {
        await using var db = CreateDb();
        var service = CreateService(db);
        await SeedApplicantAsync(
            db,
            applicantId: "APP-3",
            nationalId: "29903030303030",
            committee: "لجنة طلبة 3",
            currentExamDate: "2026-06-01");
        await service.EnrollAsync(new JsonObject
        {
            ["applicantId"] = "APP-3",
            ["nationalId"] = "29903030303030",
            ["barcode"] = "26-CAI-00000003",
            ["cycleId"] = "CYC-2026-M",
            ["userId"] = "U-006",
            ["faceCaptured"] = true,
            ["fingerprintCaptured"] = true,
            ["fingerprintCount"] = 1
        }, TestContext.Current.CancellationToken);

        var result = await service.VerifyAsync(new JsonObject
        {
            ["nationalId"] = "29903030303030",
            ["method"] = "fingerprint",
            ["module"] = "admissions-committee",
            ["operator"] = "U-006",
            ["stationCommittee"] = "لجنة طلبة 1",
            ["today"] = "2026-06-02"
        }, TestContext.Current.CancellationToken);

        var alertCodes = result["alertCodes"]!.AsArray().Select(x => x!.GetValue<string>()).ToArray();
        var voiceAlerts = result["voiceAlerts"]!.AsArray().Select(x => x!.GetValue<string>()).ToArray();
        Assert.False(result["ok"]!.GetValue<bool>());
        Assert.Contains("EXAM_DATE_MISMATCH", alertCodes);
        Assert.Contains("COMMITTEE_MISMATCH", alertCodes);
        Assert.Contains(voiceAlerts, x => x.Contains("تاريخ اختبار المتقدم لا يوافق اليوم", StringComparison.Ordinal));
        Assert.Contains(voiceAlerts, x => x.Contains("المتقدم غير مسجل في هذه اللجنة", StringComparison.Ordinal));
    }

    [Fact]
    public async Task ReportsExposeVisitCountersAndCurrentCommitteePresence()
    {
        await using var db = CreateDb();
        var service = CreateService(db);
        await SeedApplicantAsync(db, applicantId: "APP-4", nationalId: "29904040404040", committee: "لجنة طلبة 4");
        await service.EnrollAsync(new JsonObject
        {
            ["applicantId"] = "APP-4",
            ["nationalId"] = "29904040404040",
            ["barcode"] = "26-CAI-00000004",
            ["cycleId"] = "CYC-2026-M",
            ["userId"] = "U-006",
            ["faceCaptured"] = true,
            ["fingerprintCaptured"] = true,
            ["fingerprintCount"] = 1
        }, TestContext.Current.CancellationToken);
        await service.RecordGateLogAsync(new JsonObject
        {
            ["applicantId"] = "APP-4",
            ["direction"] = "entry",
            ["verificationResult"] = "match",
            ["operator"] = "GATE-1",
            ["committee"] = "لجنة طلبة 4"
        }, TestContext.Current.CancellationToken);
        await service.VerifyAsync(new JsonObject
        {
            ["applicantId"] = "APP-4",
            ["method"] = "barcode",
            ["module"] = "medical-clinic",
            ["operator"] = "CLINIC-1"
        }, TestContext.Current.CancellationToken);

        var lookup = await service.GetApplicantAsync("APP-4", null, null, TestContext.Current.CancellationToken);
        var reports = await service.ReportsAsync(TestContext.Current.CancellationToken);
        var presence = await service.PresenceAsync(TestContext.Current.CancellationToken);

        Assert.NotNull(lookup);
        Assert.Equal(1, AdminRecordJson.NumberProp(lookup!, "academyVisitCount"));
        Assert.Equal(1, AdminRecordJson.NumberProp(lookup!, "clinicVisitCount"));
        Assert.NotNull(reports.GetType().GetProperty("registeredAttendance"));
        var byCommittee = presence["byCommittee"]!.AsArray();
        Assert.Contains(byCommittee, row => AdminRecordJson.StringProp(row!.AsObject(), "committee") == "لجنة طلبة 4");
    }

    [Fact]
    public async Task BiometricWritesUseNormalizedBiometricRecordsTable()
    {
        await using var db = CreateDb();
        var service = CreateService(db);
        await SeedApplicantAsync(db, applicantId: "APP-5", nationalId: "29905050505050", committee: "لجنة طلبة 5");

        await service.EnrollAsync(new JsonObject
        {
            ["applicantId"] = "APP-5",
            ["nationalId"] = "29905050505050",
            ["barcode"] = "26-CAI-00000005",
            ["cycleId"] = "CYC-2026-M",
            ["userId"] = "U-006",
            ["faceCaptured"] = true,
            ["fingerprintCaptured"] = true
        }, TestContext.Current.CancellationToken);

        Assert.True(await db.BiometricRecords.AnyAsync(TestContext.Current.CancellationToken));
        Assert.False(await db.AdminRecords.AnyAsync(r => r.Module.StartsWith("biometric"), TestContext.Current.CancellationToken));
    }

    private static BiometricService CreateService(AdminDbContext db)
    {
        var records = new OperationalRecordsService(db, new HttpContextAccessor(), new NullAuditSink());
        return new BiometricService(records, new SimulatedBiometricDeviceGateway());
    }

    private static async Task SeedApplicantAsync(
        AdminDbContext db,
        string applicantId,
        string nationalId,
        string committee,
        string currentExamDate = "2026-06-02")
    {
        var records = new OperationalRecordsService(db, new HttpContextAccessor(), new NullAuditSink());
        await records.UpsertAsync("applicants", applicantId, new JsonObject
        {
            ["id"] = applicantId,
            ["nationalId"] = nationalId,
            ["name"] = $"متقدم {applicantId}",
            ["status"] = "active",
            ["committee"] = committee,
            ["photo"] = null,
            ["currentExam"] = "كشف الهيئة والتحقق من الحضور",
            ["currentExamDate"] = currentExamDate,
            ["currentExamResult"] = "لم تظهر",
        }, TestContext.Current.CancellationToken);
    }

    private static AdminDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AdminDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        var db = new AdminDbContext(options);
        db.Database.EnsureCreated();
        return db;
    }
}
