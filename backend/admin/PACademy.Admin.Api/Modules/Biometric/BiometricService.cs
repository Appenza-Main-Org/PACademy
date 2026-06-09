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
        var verifications = await records.ListAsync(VerificationsModule, ct);
        var gateLogs = await ListGateLogsAsync(ct);
        var q = (query ?? "").Trim().ToLowerInvariant();

        IEnumerable<JsonObject> matches = applicants;
        if (!string.IsNullOrWhiteSpace(q))
        {
            matches = applicants.Where(a => field switch
            {
                "nationalId" => (AdminRecordJson.StringProp(a, "nationalId") ?? "").Contains(q),
                "name" => ApplicantName(a).ToLowerInvariant().Contains(q),
                "applicantNumber" => (AdminRecordJson.StringProp(a, "id") ?? "").ToLowerInvariant().Contains(q),
                _ => ApplicantBarcode(a, enrollments).ToLowerInvariant().Contains(q)
                    || (AdminRecordJson.StringProp(a, "id") ?? "").ToLowerInvariant().Contains(q),
            });
        }
        else
        {
            matches = applicants.Take(12);
        }

        return matches.Take(25).Select(a => BuildLookup(a, enrollments, verifications, gateLogs)).ToList();
    }

    public async Task<JsonObject?> GetApplicantAsync(string? applicantId, string? nationalId, string? barcode, CancellationToken ct)
    {
        var applicants = await records.ListAsync("applicants", ct);
        var enrollments = await records.ListAsync(EnrollmentsModule, ct);
        var verifications = await records.ListAsync(VerificationsModule, ct);
        var gateLogs = await ListGateLogsAsync(ct);
        var applicant = FindApplicant(applicants, enrollments, applicantId, nationalId, barcode);
        return applicant is null ? null : BuildLookup(applicant, enrollments, verifications, gateLogs);
    }

    /* ── Enrollment ────────────────────────────────────────────────── */

    public async Task<JsonObject> EnrollAsync(JsonObject input, CancellationToken ct)
    {
        var applicantId = AdminRecordJson.StringProp(input, "applicantId") ?? "unknown";
        var userId = AdminRecordJson.StringProp(input, "userId") ?? "system";
        var face = BoolProp(input, "faceCaptured");
        var fingerprint = BoolProp(input, "fingerprintCaptured");
        var fingerprintCount = fingerprint
            ? Math.Max(1, (int)(AdminRecordJson.NumberProp(input, "fingerprintCount") ?? 1))
            : 0;
        var retake = BoolProp(input, "retake");

        // The ZK terminal accepts a 9-digit emp_code only (the 14-digit national id
        // and the 36-char GUID are both rejected at the device). We mint a unique
        // 9-digit device code per applicant and keep the national id as the identity.
        var nationalId = AdminRecordJson.StringProp(input, "nationalId");
        if (string.IsNullOrWhiteSpace(nationalId))
            nationalId = await ApplicantNationalIdByIdAsync(applicantId, ct);
        var enrollName = await ApplicantNameByIdAsync(applicantId, ct);
        var deviceEmpCode = await ResolveOrGenerateDeviceEmpCodeAsync(applicantId, ct);

        var templateRefs = new List<string>();
        var fingerprintTemplates = new JsonArray();
        string? faceTemplateRef = null;
        string? deviceEmpId = null;
        var livenessConfirmed = false;
        if (face)
        {
            var cap = await device.CaptureAsync(new BiometricCaptureRequest(
                applicantId, "face", null, EmpCode: deviceEmpCode, DisplayName: enrollName), ct);
            templateRefs.Add(cap.TemplateRef);
            faceTemplateRef = cap.TemplateRef;
            livenessConfirmed = cap.LivenessConfirmed;
            deviceEmpId ??= cap.DeviceEmpId;
        }
        if (fingerprint)
        {
            for (var index = 1; index <= fingerprintCount; index++)
            {
                var modality = fingerprintCount == 1 ? "fingerprint" : $"fingerprint-{index}";
                var cap = await device.CaptureAsync(new BiometricCaptureRequest(
                    applicantId, modality, null, EmpCode: deviceEmpCode, DisplayName: enrollName), ct);
                deviceEmpId ??= cap.DeviceEmpId;
                templateRefs.Add(cap.TemplateRef);
                fingerprintTemplates.Add(new JsonObject
                {
                    ["finger"] = index,
                    ["templateRef"] = cap.TemplateRef,
                    ["quality"] = cap.Quality,
                });
            }
        }

        var status = face && fingerprint ? "enrolled" : face || fingerprint ? "partial" : "not_enrolled";
        var now = NowMs();
        var applicantName = await ApplicantNameByIdAsync(applicantId, ct);
        // Reuse the applicant's existing enrollment record (one per applicant) so
        // re-enrolling updates it in place instead of leaving stale duplicates.
        var existingEnrollment = LatestEnrollment(await records.ListAsync(EnrollmentsModule, ct), applicantId);
        var id = existingEnrollment is not null
            ? AdminRecordJson.StringProp(existingEnrollment, "id") ?? $"BIO-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}"
            : $"BIO-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";

        var record = new JsonObject
        {
            ["id"] = id,
            ["applicantId"] = applicantId,
            ["applicantName"] = applicantName,
            ["nationalId"] = nationalId ?? "",
            ["deviceEmpCode"] = deviceEmpCode,
            ["deviceEmpId"] = deviceEmpId,
            ["barcode"] = AdminRecordJson.StringProp(input, "barcode") ?? applicantId,
            ["cycleId"] = AdminRecordJson.StringProp(input, "cycleId") ?? DefaultCycleId,
            ["enrolledAt"] = now,
            ["enrolledBy"] = userId,
            ["faceCaptured"] = face,
            ["fingerprintCaptured"] = fingerprint,
            ["fingerprintCount"] = fingerprintCount,
            ["fingerprintTemplates"] = fingerprintTemplates,
            ["faceTemplateRef"] = faceTemplateRef,
            ["livenessConfirmed"] = livenessConfirmed || face,
            ["templateRef"] = templateRefs.Count > 0 ? string.Join(";", templateRefs) : $"tmpl/{applicantId}",
            ["status"] = status,
            ["retake"] = retake,
            ["source"] = retake ? "retake" : "live_capture",
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

    public async Task<JsonObject> LinkPreviousEnrollmentAsync(JsonObject input, CancellationToken ct)
    {
        var applicantId = AdminRecordJson.StringProp(input, "applicantId") ?? "unknown";
        var userId = AdminRecordJson.StringProp(input, "userId") ?? "system";
        var targetCycleId = AdminRecordJson.StringProp(input, "cycleId") ?? DefaultCycleId;
        var now = NowMs();
        var applicantName = await ApplicantNameByIdAsync(applicantId, ct);
        var previous = (await records.ListAsync(EnrollmentsModule, ct))
            .Where(e => AdminRecordJson.StringProp(e, "applicantId") == applicantId)
            .Where(e => AdminRecordJson.StringProp(e, "cycleId") != targetCycleId)
            .OrderByDescending(e => AdminRecordJson.NumberProp(e, "enrolledAt") ?? 0)
            .FirstOrDefault()
            ?? throw new InvalidOperationException("لا توجد بيانات بيومترية سابقة لهذا المتقدم");

        var id = $"BIO-LINK-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        var record = AdminRecordJson.Clone(previous);
        record["id"] = id;
        record["applicantId"] = applicantId;
        record["applicantName"] = applicantName;
        record["nationalId"] = AdminRecordJson.StringProp(input, "nationalId")
            ?? AdminRecordJson.StringProp(previous, "nationalId")
            ?? "";
        record["barcode"] = AdminRecordJson.StringProp(input, "barcode")
            ?? AdminRecordJson.StringProp(previous, "barcode")
            ?? applicantId;
        record["cycleId"] = targetCycleId;
        record["enrolledAt"] = now;
        record["enrolledBy"] = userId;
        record["linkedFromEnrollmentId"] = AdminRecordJson.StringProp(previous, "id");
        record["linkedFromCycleId"] = AdminRecordJson.StringProp(previous, "cycleId");
        record["source"] = "linked_previous";
        record["retake"] = false;

        await records.UpsertAsync(EnrollmentsModule, id, record, ct);
        await AppendAuditAsync(userId, applicantId, applicantName, "link_previous", "enrolled", now, ct);
        return record;
    }

    /* ── Verification ──────────────────────────────────────────────── */

    public async Task<JsonObject> VerifyAsync(JsonObject input, CancellationToken ct)
    {
        // "biometric" = accept any modality (face or finger) — the device already
        // matched the person; the modality is auto-detected, not pre-selected.
        var method = AdminRecordJson.StringProp(input, "method") ?? "biometric";
        var module = AdminRecordJson.StringProp(input, "module") ?? "security-gate";
        var operatorId = AdminRecordJson.StringProp(input, "operator") ?? "system";
        var now = NowMs();

        var applicants = await records.ListAsync("applicants", ct);
        var enrollments = await records.ListAsync(EnrollmentsModule, ct);
        var applicant = FindApplicant(applicants, enrollments,
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

        var verifications = await records.ListAsync(VerificationsModule, ct);
        var gateLogs = await ListGateLogsAsync(ct);
        var lookup = BuildLookup(applicant, enrollments, verifications, gateLogs);
        var applicantId = AdminRecordJson.StringProp(applicant, "id") ?? "";
        var applicantName = ApplicantName(applicant);
        var enrollmentStatus = AdminRecordJson.StringProp(lookup, "enrollmentStatus") ?? "not_enrolled";
        var canProceed = BoolProp(lookup, "canProceed");
        var alertCodes = new JsonArray();
        var voiceAlerts = new JsonArray();

        string status;
        int? confidence = null;
        string? reason = null;

        if (enrollmentStatus == "not_enrolled")
        {
            status = "not_enrolled";
            reason = "المتقدم غير مسجل بيومترياً";
            alertCodes.Add("NOT_REGISTERED");
            voiceAlerts.Add("المتقدم غير مسجل على المنظومة");
        }
        else if (!canProceed)
        {
            status = "manual_review_required";
            confidence = 70;
            reason = AdminRecordJson.StringProp(lookup, "blockedReason") ?? "تحتاج الحالة إلى مراجعة يدوية";
        }
        else
        {
            var preMatched = BoolProp(input, "biometricMatched");
            var match = preMatched
                ? new BiometricMatchResult(IsMatch: true, Confidence: 100, Score: 100)
                : await device.MatchAsync(new BiometricMatchRequest(
                    applicantId, method, AdminRecordJson.StringProp(lookup, "barcode"), null,
                    EmpCode: AdminRecordJson.StringProp(applicant, "nationalId"),
                    TerminalSn: AdminRecordJson.StringProp(input, "terminalSn")), ct);
            confidence = match.Confidence;
            status = match.Score >= 88 ? "match" : match.Score >= 76 ? "manual_review_required" : "no_match";
            if (status == "manual_review_required") reason = "درجة التطابق أقل من حد الاعتماد الآلي";
            if (status == "no_match") reason = "فشل التحقق ولا يسمح باستكمال الاختبار";
        }

        var today = AdminRecordJson.StringProp(input, "today");
        var examDate = AdminRecordJson.StringProp(lookup, "currentExamDate");
        if (!string.IsNullOrWhiteSpace(today)
            && !string.IsNullOrWhiteSpace(examDate)
            && !string.Equals(today, examDate, StringComparison.Ordinal))
        {
            alertCodes.Add("EXAM_DATE_MISMATCH");
            voiceAlerts.Add("تاريخ اختبار المتقدم لا يوافق اليوم");
            status = "manual_review_required";
            reason ??= "تاريخ اختبار المتقدم لا يوافق اليوم";
        }

        var stationCommittee = AdminRecordJson.StringProp(input, "stationCommittee");
        var applicantCommittee = AdminRecordJson.StringProp(lookup, "committee");
        if (!string.IsNullOrWhiteSpace(stationCommittee)
            && !string.IsNullOrWhiteSpace(applicantCommittee)
            && !string.Equals(stationCommittee, applicantCommittee, StringComparison.Ordinal))
        {
            alertCodes.Add("COMMITTEE_MISMATCH");
            voiceAlerts.Add("المتقدم غير مسجل في هذه اللجنة");
            status = "manual_review_required";
            reason ??= "المتقدم غير مسجل في هذه اللجنة";
        }

        var ok = status == "match" && alertCodes.Count == 0;

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
            ["ok"] = ok,
            ["applicant"] = lookup.DeepClone(),
            ["timestamp"] = now,
            ["canContinue"] = ok,
            ["alertCodes"] = alertCodes,
            ["voiceAlerts"] = voiceAlerts,
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
            ["committee"] = AdminRecordJson.StringProp(input, "committee"),
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
        var presence = BuildPresence(gateLogs);

        return new
        {
            daily,
            failed = verifications.Where(v => AdminRecordJson.StringProp(v, "result") != "match")
                .OrderByDescending(v => AdminRecordJson.NumberProp(v, "timestamp") ?? 0).Take(50).ToList(),
            attendance = gateLogs.Take(50).ToList(),
            registeredAttendance = gateLogs.Take(100).ToList(),
            insideCommittees = presence["byCommittee"]?.AsArray() ?? [],
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

    public async Task<JsonObject> PresenceAsync(CancellationToken ct)
    {
        var gateLogs = await ListGateLogsAsync(ct);
        return BuildPresence(gateLogs);
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

    private JsonObject BuildLookup(
        JsonObject applicant,
        IReadOnlyList<JsonObject> enrollments,
        IReadOnlyList<JsonObject>? verifications = null,
        IReadOnlyList<JsonObject>? gateLogs = null)
    {
        var applicantId = AdminRecordJson.StringProp(applicant, "id") ?? "";
        var enrollment = LatestEnrollment(enrollments, applicantId);
        var enrollmentStatus = enrollment is not null ? AdminRecordJson.StringProp(enrollment, "status") ?? "not_enrolled" : "not_enrolled";
        var status = AdminRecordJson.StringProp(applicant, "status");
        // The real committee is `committeeName` (resolved from committee config);
        // the legacy `committee` field holds the exam LOCATION on portal payloads.
        var committeeName = AdminRecordJson.StringProp(applicant, "committeeName");
        var examLocation = AdminRecordJson.StringProp(applicant, "committee");
        var assignedCommitteeId = AdminRecordJson.StringProp(applicant, "assignedCommitteeId");
        var committee = !string.IsNullOrWhiteSpace(committeeName) ? committeeName : (examLocation ?? "");
        var isStopped = status == "rejected" || status == "on-hold";
        var hasCommittee = !string.IsNullOrWhiteSpace(committeeName)
            || !string.IsNullOrWhiteSpace(assignedCommitteeId)
            || !string.IsNullOrWhiteSpace(examLocation);
        var canProceed = !isStopped && hasCommittee;

        var lookup = new JsonObject
        {
            ["applicant"] = applicant.DeepClone(),
            ["barcode"] = enrollment is not null ? AdminRecordJson.StringProp(enrollment, "barcode") ?? applicantId : applicantId,
            ["cycleId"] = enrollment is not null ? AdminRecordJson.StringProp(enrollment, "cycleId") ?? DefaultCycleId : DefaultCycleId,
            ["currentExam"] = AdminRecordJson.StringProp(applicant, "currentExam") ?? "كشف الهيئة والتحقق من الحضور",
            ["currentExamDate"] = AdminRecordJson.StringProp(applicant, "currentExamDate") ?? DateTimeOffset.UtcNow.ToString("yyyy-MM-dd"),
            ["currentExamResult"] = AdminRecordJson.StringProp(applicant, "currentExamResult") ?? "لم تظهر",
            ["committee"] = committee,
            ["committeeName"] = committeeName,
            ["examLocation"] = examLocation,
            ["admissionStatus"] = status,
            ["enrollmentStatus"] = enrollmentStatus,
            ["academyVisitCount"] = CountGateVisits(gateLogs, applicantId),
            ["studentCommitteeVisitCount"] = CountVerifications(verifications, applicantId, "admissions-committee"),
            ["examCommitteeVisitCount"] = CountVerifications(verifications, applicantId, "exam-committee"),
            ["medicalCommitteeVisitCount"] = CountVerifications(verifications, applicantId, "medical-commission"),
            ["clinicVisitCount"] = CountVerifications(verifications, applicantId, "medical-clinic"),
            ["canProceed"] = canProceed,
        };
        if (enrollment is not null) lookup["enrollment"] = enrollment.DeepClone();
        if (isStopped) lookup["blockedReason"] = "المتقدم موقوف أو غير مستوفٍ ولا يسمح باستكمال الاختبار";
        return lookup;
    }

    private static JsonObject? FindApplicant(
        IReadOnlyList<JsonObject> applicants,
        IReadOnlyList<JsonObject> enrollments,
        string? applicantId,
        string? nationalId,
        string? barcode)
    {
        if (!string.IsNullOrWhiteSpace(applicantId))
            return applicants.FirstOrDefault(a => AdminRecordJson.StringProp(a, "id") == applicantId);
        if (!string.IsNullOrWhiteSpace(nationalId))
            return applicants.FirstOrDefault(a => AdminRecordJson.StringProp(a, "nationalId") == nationalId);
        if (!string.IsNullOrWhiteSpace(barcode))
        {
            var enrollmentApplicantId = enrollments
                .FirstOrDefault(e => AdminRecordJson.StringProp(e, "barcode") == barcode);
            var resolvedId = AdminRecordJson.StringProp(enrollmentApplicantId ?? [], "applicantId") ?? barcode;
            return applicants.FirstOrDefault(a => AdminRecordJson.StringProp(a, "id") == resolvedId);
        }
        return null;
    }

    private static string ApplicantBarcode(JsonObject applicant, IReadOnlyList<JsonObject> enrollments)
    {
        var applicantId = AdminRecordJson.StringProp(applicant, "id") ?? "";
        return enrollments
            .FirstOrDefault(e => AdminRecordJson.StringProp(e, "applicantId") == applicantId) is { } enrollment
            ? AdminRecordJson.StringProp(enrollment, "barcode") ?? applicantId
            : applicantId;
    }

    private static int CountGateVisits(IReadOnlyList<JsonObject>? gateLogs, string applicantId) =>
        gateLogs?.Count(g => AdminRecordJson.StringProp(g, "applicantId") == applicantId
            && AdminRecordJson.StringProp(g, "direction") == "entry") ?? 0;

    private static int CountVerifications(IReadOnlyList<JsonObject>? verifications, string applicantId, string module) =>
        verifications?.Count(v => AdminRecordJson.StringProp(v, "applicantId") == applicantId
            && AdminRecordJson.StringProp(v, "module") == module) ?? 0;

    private static JsonObject BuildPresence(IReadOnlyList<JsonObject> gateLogs)
    {
        var latestByApplicant = gateLogs
            .GroupBy(g => AdminRecordJson.StringProp(g, "applicantId") ?? "")
            .Where(g => !string.IsNullOrWhiteSpace(g.Key))
            .Select(g => g.OrderByDescending(x => AdminRecordJson.NumberProp(x, "at") ?? 0).First())
            .Where(g => AdminRecordJson.StringProp(g, "direction") == "entry")
            .ToList();
        var byCommittee = new JsonArray(latestByApplicant
            .GroupBy(g => AdminRecordJson.StringProp(g, "committee") ?? "غير محدد")
            .Select(g => new JsonObject
            {
                ["committee"] = g.Key,
                ["count"] = g.Count(),
                ["applicants"] = new JsonArray(g.Select(x => new JsonObject
                {
                    ["applicantId"] = AdminRecordJson.StringProp(x, "applicantId"),
                    ["applicantName"] = AdminRecordJson.StringProp(x, "applicantName"),
                    ["enteredAt"] = AdminRecordJson.NumberProp(x, "at"),
                }).ToArray<JsonNode?>()),
            })
            .ToArray<JsonNode?>());

        return new JsonObject
        {
            ["totalInside"] = latestByApplicant.Count,
            ["byCommittee"] = byCommittee,
            ["rows"] = new JsonArray(latestByApplicant.Select(x => AdminRecordJson.Clone(x)).ToArray<JsonNode?>()),
        };
    }

    private async Task<string> ApplicantNameByIdAsync(string applicantId, CancellationToken ct)
    {
        var applicants = await records.ListAsync("applicants", ct);
        var applicant = applicants.FirstOrDefault(a => AdminRecordJson.StringProp(a, "id") == applicantId);
        return applicant is null ? "متقدم غير معروف" : ApplicantName(applicant);
    }

    private async Task<string?> ApplicantNationalIdByIdAsync(string applicantId, CancellationToken ct)
    {
        var applicants = await records.ListAsync("applicants", ct);
        var applicant = applicants.FirstOrDefault(a => AdminRecordJson.StringProp(a, "id") == applicantId);
        return applicant is null ? null : AdminRecordJson.StringProp(applicant, "nationalId");
    }

    /// <summary>
    /// The applicant's effective enrollment record. Prefers a device-linked record
    /// (one carrying a 9-digit device code), then the most recent by enrolledAt.
    /// Applicant id is matched case-insensitively (GUIDs are stored mixed-case).
    /// </summary>
    private static JsonObject? LatestEnrollment(IReadOnlyList<JsonObject> enrollments, string applicantId) =>
        enrollments
            .Where(e => string.Equals(AdminRecordJson.StringProp(e, "applicantId"), applicantId, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(e => IsNineDigit(AdminRecordJson.StringProp(e, "deviceEmpCode")) ? 1 : 0)
            .ThenByDescending(e => AdminRecordJson.NumberProp(e, "enrolledAt") ?? 0)
            .FirstOrDefault();

    private const long DeviceEmpCodeBase = 100_000_000; // first issued code = 100000001 (9 digits)

    private static bool IsNineDigit(string? code) =>
        code is { Length: 9 } && code.All(char.IsDigit);

    /// <summary>
    /// Reuse the applicant's existing 9-digit device code, or mint the next free
    /// one. ZK terminals cap emp_code at 9 digits, so we cannot use the 14-digit
    /// national id as the device code — we keep a separate unique device code.
    /// </summary>
    private async Task<string> ResolveOrGenerateDeviceEmpCodeAsync(string applicantId, CancellationToken ct)
    {
        var enrollments = await records.ListAsync(EnrollmentsModule, ct);

        var mine = LatestEnrollment(enrollments, applicantId);
        var existing = mine is null ? null : AdminRecordJson.StringProp(mine, "deviceEmpCode");
        if (IsNineDigit(existing)) return existing!;

        var maxCode = DeviceEmpCodeBase;
        foreach (var e in enrollments)
        {
            var c = AdminRecordJson.StringProp(e, "deviceEmpCode");
            if (IsNineDigit(c) && long.TryParse(c, out var n) && n > maxCode) maxCode = n;
        }
        var next = maxCode + 1;
        if (next > 999_999_999)
            throw new InvalidOperationException("نفدت أكواد الموظفين المكوّنة من ٩ أرقام");
        return next.ToString();
    }

    /// <summary>
    /// Resolve a device punch to a PACademy applicant id. Linkage precedence:
    ///   1. the device-assigned employee id stored at enrollment (the canonical key),
    ///   2. the device emp_code stored at enrollment,
    ///   3. legacy fallback: emp_code equals the applicant's national id.
    /// Returns null when the punch is not bound to any applicant.
    /// </summary>
    public async Task<string?> ResolvePunchApplicantIdAsync(int deviceEmpId, string empCode, CancellationToken ct)
    {
        var enrollments = await records.ListAsync(EnrollmentsModule, ct);
        if (deviceEmpId > 0)
        {
            var byDevice = enrollments.FirstOrDefault(e =>
                AdminRecordJson.StringProp(e, "deviceEmpId") == deviceEmpId.ToString());
            if (byDevice is not null) return AdminRecordJson.StringProp(byDevice, "applicantId");
        }
        if (!string.IsNullOrWhiteSpace(empCode))
        {
            var byCode = enrollments.FirstOrDefault(e => AdminRecordJson.StringProp(e, "deviceEmpCode") == empCode);
            if (byCode is not null) return AdminRecordJson.StringProp(byCode, "applicantId");

            var applicants = await records.ListAsync("applicants", ct);
            var byNid = applicants.FirstOrDefault(a => AdminRecordJson.StringProp(a, "nationalId") == empCode);
            if (byNid is not null) return AdminRecordJson.StringProp(byNid, "id");
        }
        return null;
    }

    /// <summary>
    /// Bind an existing ZK device employee (by device emp_code + device id) to a
    /// PACademy applicant, so punches from that device record resolve to the
    /// applicant — used when a biometric was enrolled on the terminal under a
    /// different employee record. Creates or updates the applicant's enrollment.
    /// </summary>
    public async Task<JsonObject> BindDeviceEmployeeAsync(
        string? applicantId, string? nationalId, string deviceEmpCode, int deviceEmpId, CancellationToken ct)
    {
        var applicants = await records.ListAsync("applicants", ct);
        var applicant = applicants.FirstOrDefault(a =>
            (!string.IsNullOrWhiteSpace(applicantId) && AdminRecordJson.StringProp(a, "id") == applicantId) ||
            (!string.IsNullOrWhiteSpace(nationalId) && AdminRecordJson.StringProp(a, "nationalId") == nationalId))
            ?? throw new InvalidOperationException("لم يتم العثور على المتقدم");

        var appId = AdminRecordJson.StringProp(applicant, "id") ?? "";
        var name = ApplicantName(applicant);
        var nid = AdminRecordJson.StringProp(applicant, "nationalId");
        var now = NowMs();

        var enrollments = await records.ListAsync(EnrollmentsModule, ct);
        var existing = enrollments.FirstOrDefault(e => AdminRecordJson.StringProp(e, "applicantId") == appId);
        var id = existing is not null
            ? AdminRecordJson.StringProp(existing, "id") ?? $"BIO-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}"
            : $"BIO-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        var record = existing is not null ? AdminRecordJson.Clone(existing) : new JsonObject();

        record["id"] = id;
        record["applicantId"] = appId;
        record["applicantName"] = name;
        record["nationalId"] = nid ?? "";
        record["deviceEmpCode"] = deviceEmpCode;
        record["deviceEmpId"] = deviceEmpId > 0 ? deviceEmpId.ToString() : null;
        record["barcode"] ??= appId;
        record["faceCaptured"] = true;
        record["fingerprintCaptured"] = true;
        record["status"] = "enrolled";
        record["source"] = "device-bind";
        record["enrolledAt"] ??= now;
        record["updatedAt"] = now;

        await records.UpsertAsync(EnrollmentsModule, id, record, ct);
        await AppendAuditAsync("system", appId, name, "device_bind", "enrolled", now, ct);
        return record;
    }

    /// <summary>
    /// Batch-resolve device punches to {id, name}, keyed by emp_code, in a single
    /// read of enrollments + applicants. Same precedence as
    /// <see cref="ResolvePunchApplicantIdAsync"/> (device id → device code → national id).
    /// Used by the realtime feed so punches keyed by a 9-digit device code resolve.
    /// </summary>
    public async Task<IReadOnlyDictionary<string, JsonObject>> ResolvePunchesAsync(
        IEnumerable<(int Emp, string EmpCode)> punches, CancellationToken ct)
    {
        var enrollments = await records.ListAsync(EnrollmentsModule, ct);
        var applicants = await records.ListAsync("applicants", ct);

        JsonObject? ById(string? id) => string.IsNullOrEmpty(id)
            ? null
            : applicants.FirstOrDefault(a => string.Equals(AdminRecordJson.StringProp(a, "id"), id, StringComparison.OrdinalIgnoreCase));

        var map = new Dictionary<string, JsonObject>();
        foreach (var (emp, empCode) in punches)
        {
            if (string.IsNullOrWhiteSpace(empCode) || map.ContainsKey(empCode)) continue;

            JsonObject? applicant = null;
            if (emp > 0)
            {
                var byDev = enrollments.FirstOrDefault(e => AdminRecordJson.StringProp(e, "deviceEmpId") == emp.ToString());
                applicant = byDev is null ? null : ById(AdminRecordJson.StringProp(byDev, "applicantId"));
            }
            if (applicant is null)
            {
                var byCode = enrollments.FirstOrDefault(e => AdminRecordJson.StringProp(e, "deviceEmpCode") == empCode);
                applicant = byCode is null ? null : ById(AdminRecordJson.StringProp(byCode, "applicantId"));
            }
            applicant ??= applicants.FirstOrDefault(a => AdminRecordJson.StringProp(a, "nationalId") == empCode);

            if (applicant is not null)
                map[empCode] = new JsonObject
                {
                    ["id"] = AdminRecordJson.StringProp(applicant, "id"),
                    ["name"] = ApplicantName(applicant),
                };
        }
        return map;
    }

    /// <summary>
    /// Resolve a set of national ids to {id, name} in a single applicants read —
    /// used by the realtime device feed to label punches by emp_code (= national id).
    /// </summary>
    public async Task<IReadOnlyDictionary<string, JsonObject>> ResolveByNationalIdsAsync(
        IEnumerable<string> nationalIds, CancellationToken ct)
    {
        var wanted = nationalIds.Where(s => !string.IsNullOrWhiteSpace(s)).ToHashSet();
        var map = new Dictionary<string, JsonObject>();
        if (wanted.Count == 0) return map;

        foreach (var a in await records.ListAsync("applicants", ct))
        {
            var nid = AdminRecordJson.StringProp(a, "nationalId");
            if (nid is null || !wanted.Contains(nid) || map.ContainsKey(nid)) continue;
            map[nid] = new JsonObject
            {
                ["id"] = AdminRecordJson.StringProp(a, "id"),
                ["name"] = ApplicantName(a),
            };
        }
        return map;
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
        "medical-commission" => "medical-commission",
        "medical-clinic" => "medical-clinic",
        _ => "committee",
    };

    private static long NowMs() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

    private static bool BoolProp(JsonObject obj, string name) =>
        obj.TryGetPropertyValue(name, out var node) && node is not null &&
        node.GetValueKind() == System.Text.Json.JsonValueKind.True;
}
