using System.Text.Json.Nodes;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Modules.OperationalRecords;
using PACademy.Admin.Api.Persistence;

namespace PACademy.Admin.Api.Modules.Biometric;

/// <summary>
/// Seeds biometric enrollments, verifications, gate logs, and audit rows into
/// normalized biometric operational tables. Mirrors the frontend mock generators
/// (<c>shared/mock-data/sprint3to9.ts</c>): timestamps are spread over the last
/// 7–30 days relative to seed time so the history / monitoring / reports
/// surfaces show realistic, time-windowed numbers regardless of run date.
/// Deterministic (seeded RNG) and idempotent (only fills empty buckets).
///
/// INTEGRATION NOTE: at real-device integration time these demo rows can be
/// dropped — live enrollments/verifications come through the device gateway.
/// </summary>
public sealed class BiometricSeeder(ILogger<BiometricSeeder> logger)
{
    private static readonly string[] Names =
    [
        "محمد عبد الله إبراهيم", "يوسف أحمد علي", "كريم مصطفى حسن", "عمر خالد سعيد",
        "أحمد سمير فؤاد", "مازن وليد رشاد", "زياد طارق منصور", "حسن إسلام عادل",
        "عبد الرحمن ماهر شوقي", "مروان هشام فتحي", "إبراهيم سعد الدين", "طارق نبيل لطفي",
        "خالد رمضان عطية", "سيف الدين جمال", "عمرو صلاح عبد العزيز", "أنس وائل بدر",
        "بلال عصام راضي", "حمزة يحيى عبد الحميد", "زين العابدين حاتم", "آدم شريف زكي",
        "ياسين فادي نعمان", "نور الدين باسم", "مصطفى كمال حلمي", "عبد الله محسن راغب",
    ];

    private static readonly string[] Modules = ["security-gate", "exam-committee", "admissions-committee"];
    private static readonly string[] Methods = ["face", "fingerprint", "barcode"];
    private const string Operator = "U-006";

    public async Task SeedAsync(AdminDbContext db, CancellationToken ct = default)
    {
        // Route through OperationalRecordsService so the normalized bucket
        // (biometric-enrollments) lands in its typed table via the runtime MERGE;
        // JSON buckets (verifications, gate-logs, audit) fall through to the
        // operational store. NullAuditSink keeps seeding out of audit_entries.
        var store = new OperationalRecordsService(db, new HttpContextAccessor(), new PACademy.Shared.Audit.NullAuditSink());
        var hasEnrollments = (await store.ListAsync(BiometricService.EnrollmentsModule, ct)).Count > 0;
        var hasVerifications = (await store.ListAsync(BiometricService.VerificationsModule, ct)).Count > 0;
        var hasGateLogs = (await store.ListAsync(BiometricService.GateLogsModule, ct)).Count > 0;
        var hasAudit = (await store.ListAsync(BiometricService.AuditModule, ct)).Count > 0;
        if (hasEnrollments && hasVerifications && hasGateLogs && hasAudit) return;

        var rng = new Random(42);
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        const long day = 24L * 3600_000L;
        var inserted = 0;

        string ApplicantId(int i) => $"APP-BIO-{i:00000}";
        string Name(int i) => Names[i % Names.Length];

        async Task AddAsync(string module, string id, JsonObject payload)
        {
            await store.UpsertAsync(module, id, payload, ct);
            inserted++;
        }

        if (!hasEnrollments)
        {
            for (var i = 1; i <= 60; i++)
            {
                var face = true;
                var fingerprint = rng.NextDouble() > 0.05;
                var status = face && fingerprint ? "enrolled" : "partial";
                var id = $"BIO-{i:00000}";
                await AddAsync(BiometricService.EnrollmentsModule, id, new JsonObject
                {
                    ["id"] = id,
                    ["applicantId"] = ApplicantId(i),
                    ["applicantName"] = Name(i),
                    ["nationalId"] = $"301{i:00000000000}".Substring(0, 14),
                    ["barcode"] = $"26-CAI-{i:00000000}",
                    ["cycleId"] = "CYC-2026-M",
                    ["enrolledAt"] = now - (long)(rng.NextDouble() * 30 * day),
                    ["enrolledBy"] = Operator,
                    ["faceCaptured"] = face,
                    ["fingerprintCaptured"] = fingerprint,
                    ["livenessConfirmed"] = true,
                    ["templateRef"] = $"tmpl/{ApplicantId(i)}",
                    ["status"] = status,
                    ["retake"] = false,
                });
            }
        }

        if (!hasVerifications || !hasAudit)
        {
            for (var i = 1; i <= 120; i++)
            {
                var idx = rng.Next(1, 61);
                var match = rng.NextDouble() > 0.06;
                var result = match ? "match" : rng.NextDouble() > 0.5 ? "manual_review_required" : "no_match";
                var ts = now - (long)(rng.NextDouble() * 7 * day);
                var confidence = match ? 80 + rng.Next(0, 18) : 40 + rng.Next(0, 30);
                var verId = $"VER-{i:00000}";
                if (!hasVerifications)
                {
                    await AddAsync(BiometricService.VerificationsModule, verId, new JsonObject
                    {
                        ["id"] = verId,
                        ["applicantId"] = ApplicantId(idx),
                        ["applicantName"] = Name(idx),
                        ["method"] = Methods[rng.Next(Methods.Length)],
                        ["result"] = result,
                        ["operator"] = Operator,
                        ["module"] = Modules[rng.Next(Modules.Length)],
                        ["timestamp"] = ts,
                        ["confidence"] = confidence,
                    });
                }
                if (!hasAudit && i <= 60)
                {
                    var audId = $"BIO-AUD-{verId}";
                    await AddAsync(BiometricService.AuditModule, audId, new JsonObject
                    {
                        ["id"] = audId,
                        ["user"] = Operator,
                        ["timestamp"] = ts,
                        ["applicantId"] = ApplicantId(idx),
                        ["applicantName"] = Name(idx),
                        ["action"] = result == "match" ? "verification" : result == "manual_review_required" ? "manual_review" : "failed_verification",
                        ["result"] = result,
                    });
                }
            }
        }

        if (!hasGateLogs)
        {
            for (var i = 1; i <= 40; i++)
            {
                var idx = rng.Next(1, 61);
                var entry = rng.NextDouble() > 0.5;
                var id = $"GATE-{i:00000}";
                await AddAsync(BiometricService.GateLogsModule, id, new JsonObject
                {
                    ["id"] = id,
                    ["applicantId"] = ApplicantId(idx),
                    ["applicantName"] = Name(idx),
                    ["direction"] = entry ? "entry" : "exit",
                    ["at"] = now - (long)(rng.NextDouble() * 7 * day),
                    ["verificationResult"] = "match",
                    ["operator"] = Operator,
                });
            }
        }

        if (inserted == 0) return;
        logger.LogInformation("Seeded {Count} biometric records", inserted);
    }
}
