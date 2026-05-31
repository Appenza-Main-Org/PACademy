using System.Text.Json.Nodes;
using PACademy.Admin.Api.Modules.AdminRecords;

namespace PACademy.Admin.Api.Modules.Biometric;

/// <summary>
/// Biometric Registration &amp; Inquiry service (BRD §5). Persists enrollments,
/// verifications, gate logs, and an audit trail in normalized operational
/// tables, and delegates the actual capture/match to
/// <see cref="IBiometricDeviceGateway"/> (simulated or real). Returns JSON
/// shapes verbatim to the frontend contract in
/// <c>frontend/src/features/biometric/api/biometric.service.ts</c>.
/// </summary>
public sealed class BiometricService(OperationalRecordsService records, IBiometricDeviceGateway device)
{
    public const string EnrollmentsModule = "biometric-enrollments";
    public const string VerificationsModule = "biometric-verifications";
    public const string GateLogsModule = "biometric-gate-logs";
    public const string AuditModule = "biometric-audit";

    private const string DefaultCycleId = "CYC-2026-M";

    /* ── Applicant search + lookup ─────────────────────────────────── */

    public async Task<IReadOnlyList<JsonObject>> SearchApplicantsAsync(string field, string query, CancellationToken ct)
    {
        var applicants = await records.ListAsync("applicants", ct);
        var enrollments = await records.ListAsync(EnrollmentsModule, ct);
        var q = (query ?? "").Trim().ToLowerInvariant();

        IEnumerable<JsonObject> matches = applicants;
        if (!string.IsNullOrWhiteSpace(q))
        {
            matches = applicants.Where(a => field switch
            {
                "nationalId" => (AdminRecordJson.StringProp(a, "nationalId") ?? "").Contains(q),
                "name" => ApplicantName(a).ToLowerInvariant().Contains(q),
                "applicantNumber" => (AdminRecordJson.StringProp(a, "id") ?? "").ToLowerInvariant().Contains(q),
                _ => (AdminRecordJson.StringProp(a, "id") ?? "").ToLowerInvariant().Contains(q),
            });
        }
        else
        {
            matches = applicants.Take(12);
        }

        return matches.Take(25).Select(a => BuildLookup(a, enrollments)).ToList();
    }

    public async Task<JsonObject?> GetApplicantAsync(string? applicantId, string? nationalId, string? barcode, CancellationToken ct)
    {
        var applicants = await records.ListAsync("applicants", ct);
        var enrollments = await records.ListAsync(EnrollmentsModule, ct);
        var applicant = FindApplicant(applicants, applicantId, nationalId, barcode);
        return applicant is null ? null : BuildLookup(applicant, enrollments);
    }

    /* ── Enrollment ────────────────────────────────────────────────── */

    public async Task<JsonObject> EnrollAsync(JsonObject input, CancellationToken ct)
    {
        var applicantId = AdminRecordJson.StringProp(input, "applicantId") ?? "unknown";
        var userId = AdminRecordJson.StringProp(input, "userId") ?? "system";
        var face = BoolProp(input, "faceCaptured");
        var fingerprint = BoolProp(input, "fingerprintCaptured");
        var retake = BoolProp(input, "retake");

        var templateRefs = new List<string>();
        var livenessConfirmed = false;
        if (face)
        {
            var cap = await device.CaptureAsync(new BiometricCaptureRequest(applicantId, "face", null), ct);
            templateRefs.Add(cap.TemplateRef);
            livenessConfirmed = cap.LivenessConfirmed;
        }
        if (fingerprint)
        {
            var cap = await device.CaptureAsync(new BiometricCaptureRequest(applicantId, "fingerprint", null), ct);
            templateRefs.Add(cap.TemplateRef);
        }

        var status = face && fingerprint ? "enrolled" : face || fingerprint ? "partial" : "not_enrolled";
        var now = NowMs();
        var applicantName = await ApplicantNameByIdAsync(applicantId, ct);
        var id = $"BIO-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";

        var record = new JsonObject
        {
            ["id"] = id,
            ["applicantId"] = applicantId,
            ["applicantName"] = applicantName,
            ["nationalId"] = AdminRecordJson.StringProp(input, "nationalId") ?? "",
            ["barcode"] = AdminRecordJson.StringProp(input, "barcode") ?? applicantId,
            ["cycleId"] = AdminRecordJson.StringProp(input, "cycleId") ?? DefaultCycleId,
            ["enrolledAt"] = now,
            ["enrolledBy"] = userId,
            ["faceCaptured"] = face,
            ["fingerprintCaptured"] = fingerprint,
            ["livenessConfirmed"] = livenessConfirmed || face,
            ["templateRef"] = templateRefs.Count > 0 ? string.Join(";", templateRefs) : $"tmpl/{applicantId}",
            ["status"] = status,
            ["retake"] = retake,
        };
        await records.UpsertAsync(EnrollmentsModule, id, record, ct);

        await AppendAuditAsync(userId, applicantId, applicantName, retake ? "re_enrollment" : "enrollment", status, now, ct);
        await AppendVerificationAsync(new JsonObject
        {
            ["applicantId"] = applicantId,
            ["applicantName"] = applicantName,
            ["method"] = "fingerprint",
            ["result"] = status == "enrolled" ? "match" : "manual_review_required",
            ["operator"] = userId,
            ["module"] = "admissions-committee",
            ["timestamp"] = now,
            ["confidence"] = status == "enrolled" ? 98 : 65,
        }, ct);

        return record;
    }

    /* ── Verification ──────────────────────────────────────────────── */

    public async Task<JsonObject> VerifyAsync(JsonObject input, CancellationToken ct)
    {
        var method = AdminRecordJson.StringProp(input, "method") ?? "fingerprint";
        var module = AdminRecordJson.StringProp(input, "module") ?? "security-gate";
        var operatorId = AdminRecordJson.StringProp(input, "operator") ?? "system";
        var now = NowMs();

        var applicants = await records.ListAsync("applicants", ct);
        var enrollments = await records.ListAsync(EnrollmentsModule, ct);
        var applicant = FindApplicant(applicants,
            AdminRecordJson.StringProp(input, "applicantId"),
            AdminRecordJson.StringProp(input, "nationalId"),
            AdminRecordJson.StringProp(input, "barcode"));

        if (applicant is null)
        {
            return new JsonObject
            {
                ["status"] = "no_match",
                ["ok"] = false,
                ["reason"] = "لم يتم العثور على المتقدم",
                ["timestamp"] = now,
                ["canContinue"] = false,
            };
        }

        var lookup = BuildLookup(applicant, enrollments);
        var applicantId = AdminRecordJson.StringProp(applicant, "id") ?? "";
        var applicantName = ApplicantName(applicant);
        var enrollmentStatus = AdminRecordJson.StringProp(lookup, "enrollmentStatus") ?? "not_enrolled";
        var canProceed = BoolProp(lookup, "canProceed");

        string status;
        int? confidence = null;
        string? reason = null;

        if (enrollmentStatus == "not_enrolled")
        {
            status = "not_enrolled";
            reason = "المتقدم غير مسجل بيومترياً";
        }
        else if (!canProceed)
        {
            status = "manual_review_required";
            confidence = 70;
            reason = AdminRecordJson.StringProp(lookup, "blockedReason") ?? "تحتاج الحالة إلى مراجعة يدوية";
        }
        else
        {
            var match = await device.MatchAsync(new BiometricMatchRequest(applicantId, method, AdminRecordJson.StringProp(lookup, "barcode"), null), ct);
            confidence = match.Confidence;
            status = match.Score >= 88 ? "match" : match.Score >= 76 ? "manual_review_required" : "no_match";
            if (status == "manual_review_required") reason = "درجة التطابق أقل من حد الاعتماد الآلي";
            if (status == "no_match") reason = "فشل التحقق ولا يسمح باستكمال الاختبار";
        }

        await AppendVerificationAsync(new JsonObject
        {
            ["applicantId"] = applicantId,
            ["applicantName"] = applicantName,
            ["method"] = method,
            ["result"] = status,
            ["operator"] = operatorId,
            ["module"] = module,
            ["timestamp"] = now,
            ["confidence"] = confidence,
        }, ct);
        await AppendAuditAsync(operatorId, applicantId, applicantName,
            status == "match" ? "verification" : status == "manual_review_required" ? "manual_review" : "failed_verification",
            status, now, ct);

        var result = new JsonObject
        {
            ["status"] = status,
            ["ok"] = status == "match",
            ["applicant"] = lookup.DeepClone(),
            ["timestamp"] = now,
            ["canContinue"] = status == "match",
        };
        if (reason is not null) result["reason"] = reason;
        if (confidence is not null) result["matchScore"] = confidence.Value / 100.0;
        return result;
    }

    /* ── Gate logs ─────────────────────────────────────────────────── */

    public async Task<JsonObject> RecordGateLogAsync(JsonObject input, CancellationToken ct)
    {
        var applicantId = AdminRecordJson.StringProp(input, "applicantId") ?? "unknown";
        var direction = AdminRecordJson.StringProp(input, "direction") ?? "entry";
        var verificationResult = AdminRecordJson.StringProp(input, "verificationResult") ?? "match";
        var operatorId = AdminRecordJson.StringProp(input, "operator") ?? "system";
        var now = NowMs();
        var applicantName = await ApplicantNameByIdAsync(applicantId, ct);
        var id = $"GATE-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";

        var record = new JsonObject
        {
            ["id"] = id,
            ["applicantId"] = applicantId,
            ["applicantName"] = applicantName,
            ["direction"] = direction,
            ["at"] = now,
            ["verificationResult"] = verificationResult,
            ["operator"] = operatorId,
        };
        await records.UpsertAsync(GateLogsModule, id, record, ct);
        await AppendAuditAsync(operatorId, applicantId, applicantName, direction == "entry" ? "gate_entry" : "gate_exit", direction, now, ct);
        return record;
    }

    /* ── Lists ─────────────────────────────────────────────────────── */

    public async Task<IReadOnlyList<JsonObject>> ListVerificationsAsync(string? module, bool failedOnly, CancellationToken ct)
    {
        var rows = await records.ListAsync(VerificationsModule, ct);
        IEnumerable<JsonObject> filtered = rows;
        if (!string.IsNullOrWhiteSpace(module)) filtered = filtered.Where(x => AdminRecordJson.StringProp(x, "module") == module);
        if (failedOnly) filtered = filtered.Where(x => AdminRecordJson.StringProp(x, "result") != "match");
        return filtered.OrderByDescending(x => AdminRecordJson.NumberProp(x, "timestamp") ?? 0).ToList();
    }

    public async Task<IReadOnlyList<JsonObject>> ListGateLogsAsync(CancellationToken ct) =>
        (await records.ListAsync(GateLogsModule, ct))
            .OrderByDescending(x => AdminRecordJson.NumberProp(x, "at") ?? 0)
            .ToList();

    public async Task<IReadOnlyList<JsonObject>> ListAuditLogsAsync(CancellationToken ct) =>
        (await records.ListAsync(AuditModule, ct))
            .OrderByDescending(x => AdminRecordJson.NumberProp(x, "timestamp") ?? 0)
            .ToList();

    /* ── Reports + monitoring ──────────────────────────────────────── */

    public async Task<object> ReportsAsync(CancellationToken ct)
    {
        var verifications = await records.ListAsync(VerificationsModule, ct);
        var gateLogs = await ListGateLogsAsync(ct);
        var enrollments = await records.ListAsync(EnrollmentsModule, ct);
        var applicants = await records.ListAsync("applicants", ct);
        var nowMs = NowMs();
        const long day = 24L * 3600_000L;

        var daily = new List<object>();
        for (var i = 6; i >= 0; i--)
        {
            var dayStart = nowMs - i * day;
            var rows = verifications.Where(v => Math.Abs((AdminRecordJson.NumberProp(v, "timestamp") ?? 0) - dayStart) < day).ToList();
            daily.Add(new
            {
                label = DateTimeOffset.FromUnixTimeMilliseconds(dayStart).ToString("ddd"),
                total = rows.Count,
                matched = rows.Count(r => AdminRecordJson.StringProp(r, "result") == "match"),
                failed = rows.Count(r => AdminRecordJson.StringProp(r, "result") != "match"),
            });
        }

        var enrolled = enrollments.Count(e => AdminRecordJson.StringProp(e, "status") == "enrolled");
        var partial = enrollments.Count(e => AdminRecordJson.StringProp(e, "status") == "partial");
        var notEnrolled = Math.Max(0, applicants.Count - enrolled - partial);

        return new
        {
            daily,
            failed = verifications.Where(v => AdminRecordJson.StringProp(v, "result") != "match")
                .OrderByDescending(v => AdminRecordJson.NumberProp(v, "timestamp") ?? 0).Take(50).ToList(),
            attendance = gateLogs.Take(50).ToList(),
            enrollment = new[]
            {
                new { label = "مسجل بالكامل", value = enrolled },
                new { label = "تسجيل جزئي", value = partial },
                new { label = "غير مسجل", value = notEnrolled },
            },
        };
    }

    public async Task<object> MonitoringAsync(CancellationToken ct)
    {
        var verifications = await records.ListAsync(VerificationsModule, ct);
        var nowMs = NowMs();
        const long hour = 3600_000L;
        var since = nowMs - 24 * hour;
        var recent = verifications.Where(v => (AdminRecordJson.NumberProp(v, "timestamp") ?? 0) >= since).ToList();

        var buckets = new Dictionary<int, int>();
        foreach (var v in recent)
        {
            var h = (int)((nowMs - (AdminRecordJson.NumberProp(v, "timestamp") ?? 0)) / hour);
            buckets[h] = buckets.GetValueOrDefault(h) + 1;
        }
        var last24h = Enumerable.Range(0, 24)
            .Select(h => new { ts = nowMs - h * hour, count = buckets.GetValueOrDefault(h) })
            .ToList();

        var perStation = new Dictionary<string, object>();
        foreach (var station in new[] { "gate", "exam-room", "committee" })
        {
            var rows = recent.Where(v => MapStation(AdminRecordJson.StringProp(v, "module")) == station).ToList();
            perStation[station] = new
            {
                total = rows.Count,
                match = rows.Count(r => AdminRecordJson.StringProp(r, "result") == "match"),
                failed = rows.Count(r => AdminRecordJson.StringProp(r, "result") != "match"),
            };
        }

        var recentFailures = recent.Where(v => AdminRecordJson.StringProp(v, "result") != "match")
            .OrderByDescending(v => AdminRecordJson.NumberProp(v, "timestamp") ?? 0)
            .Take(10)
            .Select(v => new
            {
                id = AdminRecordJson.StringProp(v, "id"),
                applicantId = AdminRecordJson.StringProp(v, "applicantId"),
                station = MapStation(AdminRecordJson.StringProp(v, "module")),
                ts = AdminRecordJson.NumberProp(v, "timestamp") ?? 0,
                method = AdminRecordJson.StringProp(v, "method"),
                match = false,
                confidence = AdminRecordJson.NumberProp(v, "confidence"),
            })
            .ToList();

        return new { last24h, perStation, recentFailures };
    }

    /* ── Internals ─────────────────────────────────────────────────── */

    private async Task AppendVerificationAsync(JsonObject row, CancellationToken ct)
    {
        var id = $"VER-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}-{Guid.NewGuid():N}".Substring(0, 24);
        row["id"] = id;
        await records.UpsertAsync(VerificationsModule, id, row, ct);
    }

    private async Task AppendAuditAsync(string user, string applicantId, string applicantName, string action, string result, long timestamp, CancellationToken ct)
    {
        var id = $"BIO-AUD-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}-{Guid.NewGuid():N}".Substring(0, 28);
        var row = new JsonObject
        {
            ["id"] = id,
            ["user"] = user,
            ["timestamp"] = timestamp,
            ["applicantId"] = applicantId,
            ["applicantName"] = applicantName,
            ["action"] = action,
            ["result"] = result,
        };
        await records.UpsertAsync(AuditModule, id, row, ct);
    }

    private JsonObject BuildLookup(JsonObject applicant, IReadOnlyList<JsonObject> enrollments)
    {
        var applicantId = AdminRecordJson.StringProp(applicant, "id") ?? "";
        var enrollment = enrollments.FirstOrDefault(e => AdminRecordJson.StringProp(e, "applicantId") == applicantId);
        var enrollmentStatus = enrollment is not null ? AdminRecordJson.StringProp(enrollment, "status") ?? "not_enrolled" : "not_enrolled";
        var status = AdminRecordJson.StringProp(applicant, "status");
        var committee = AdminRecordJson.StringProp(applicant, "committee") ?? "";
        var isStopped = status == "rejected" || status == "on-hold";
        var canProceed = !isStopped && !string.IsNullOrWhiteSpace(committee);

        var lookup = new JsonObject
        {
            ["applicant"] = applicant.DeepClone(),
            ["barcode"] = enrollment is not null ? AdminRecordJson.StringProp(enrollment, "barcode") ?? applicantId : applicantId,
            ["cycleId"] = enrollment is not null ? AdminRecordJson.StringProp(enrollment, "cycleId") ?? DefaultCycleId : DefaultCycleId,
            ["currentExam"] = "كشف الهيئة والتحقق من الحضور",
            ["committee"] = committee,
            ["admissionStatus"] = status,
            ["enrollmentStatus"] = enrollmentStatus,
            ["canProceed"] = canProceed,
        };
        if (enrollment is not null) lookup["enrollment"] = enrollment.DeepClone();
        if (isStopped) lookup["blockedReason"] = "المتقدم موقوف أو غير مستوفٍ ولا يسمح باستكمال الاختبار";
        return lookup;
    }

    private static JsonObject? FindApplicant(IReadOnlyList<JsonObject> applicants, string? applicantId, string? nationalId, string? barcode)
    {
        if (!string.IsNullOrWhiteSpace(applicantId))
            return applicants.FirstOrDefault(a => AdminRecordJson.StringProp(a, "id") == applicantId);
        if (!string.IsNullOrWhiteSpace(nationalId))
            return applicants.FirstOrDefault(a => AdminRecordJson.StringProp(a, "nationalId") == nationalId);
        if (!string.IsNullOrWhiteSpace(barcode))
            return applicants.FirstOrDefault(a => AdminRecordJson.StringProp(a, "id") == barcode);
        return null;
    }

    private async Task<string> ApplicantNameByIdAsync(string applicantId, CancellationToken ct)
    {
        var applicants = await records.ListAsync("applicants", ct);
        var applicant = applicants.FirstOrDefault(a => AdminRecordJson.StringProp(a, "id") == applicantId);
        return applicant is null ? "متقدم غير معروف" : ApplicantName(applicant);
    }

    private static string ApplicantName(JsonObject applicant)
    {
        var flat = AdminRecordJson.StringProp(applicant, "name");
        if (!string.IsNullOrWhiteSpace(flat)) return flat;
        if (applicant["fullName"] is JsonObject full)
        {
            var parts = new[] { "first", "second", "third", "fourth" }
                .Select(k => AdminRecordJson.StringProp(full, k))
                .Where(s => !string.IsNullOrWhiteSpace(s));
            var joined = string.Join(" ", parts);
            if (!string.IsNullOrWhiteSpace(joined)) return joined;
        }
        return AdminRecordJson.StringProp(applicant, "id") ?? "متقدم غير معروف";
    }

    private static string MapStation(string? module) => module switch
    {
        "security-gate" => "gate",
        "exam-committee" => "exam-room",
        _ => "committee",
    };

    private static long NowMs() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

    private static bool BoolProp(JsonObject obj, string name) =>
        obj.TryGetPropertyValue(name, out var node) && node is not null &&
        node.GetValueKind() == System.Text.Json.JsonValueKind.True;
}
