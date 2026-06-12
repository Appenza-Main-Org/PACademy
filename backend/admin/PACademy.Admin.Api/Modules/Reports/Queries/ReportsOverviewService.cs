using System.Globalization;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Modules.Audit;
using PACademy.Admin.Api.Persistence;

namespace PACademy.Admin.Api.Modules.Reports.Queries;

/// <summary>
/// Derives the /admin/reports overview datasets from the live operational
/// store. Every figure traces to a real row — applicants (portal drafts +
/// admin-created), cycles, categories, exam outcomes (`followUp` map +
/// `tests` lookup), committee instances/results, exam live-sessions, audit
/// entries, and the configured gateway modes. Sections whose operational
/// systems run on-prem only (medical stations, board sessions) return empty
/// lists — the frontend ships designed empty states — instead of fabricated
/// sample rows.
/// </summary>
public sealed class ReportsOverviewService(
    OperationalRecordsService records,
    AdminDbContext db,
    IConfiguration config)
{
    /* ── Cycle snapshot ────────────────────────────────────────────── */

    public async Task<object> CycleSnapshotAsync(CancellationToken ct)
    {
        var cycles = await CyclesAsync(ct);
        var categories = await CategoriesAsync(ct);
        var applicantsAll = await LiveApplicantsAsync(ct);
        var integrations = await IntegrationsAsync(ct);

        var active = ActiveCycle(cycles);
        var cycleId = Str(active, "id") ?? "";
        var applicants = applicantsAll.Where(x => InCycle(x, cycleId)).ToList();

        var now = DateTimeOffset.UtcNow;
        var openDate = ParseDate(Str(active, "openDate")) ?? now;
        var closeDate = ParseDate(Str(active, "closeDate")) ?? now;
        var approved = applicants.Count(x => Str(x, "status") == "approved");

        var previous = PreviousCycle(cycles, active, openDate);
        var prevId = previous is null ? null : Str(previous, "id");
        // Previous-cycle figures require an explicit cycle tag — blank-cycle
        // rows belong to the active cycle only, never to historic ones.
        var prevApplicants = string.IsNullOrWhiteSpace(prevId)
            ? []
            : applicantsAll.Where(x => Str(x, "cycleId") == prevId).ToList();
        var prevApproved = prevApplicants.Count(x => Str(x, "status") == "approved");

        var thisTempo = Tempo(applicants, openDate, closeDate);
        var prevTempo = previous is null
            ? []
            : Tempo(
                prevApplicants,
                ParseDate(Str(previous, "openDate")) ?? openDate,
                ParseDate(Str(previous, "closeDate")) ?? closeDate);
        var thisTotal = thisTempo.Sum(x => x.Value);
        var prevTotal = prevTempo.Sum(x => x.Value);

        var openCategories = active?["openCategories"] as JsonObject;

        return new
        {
            cycleId,
            cycleLabelAr = Str(active, "nameAr") ?? "دورة القبول",
            openDateIso = openDate.ToString("O"),
            closeDateIso = closeDate.ToString("O"),
            hijriCloseDate = HijriDate(closeDate),
            daysRemaining = Math.Max(0, (int)Math.Ceiling((closeDate - now).TotalDays)),
            capacity = active is null ? null : AdminRecordJson.NumberProp(active, "expectedCapacity"),
            totalApplicants = applicants.Count,
            finalApproved = approved,
            acceptanceRate = Percent(approved, applicants.Count),
            prevCycleAcceptanceRate = Percent(prevApproved, prevApplicants.Count),
            registrationTempo = new
            {
                thisCycle = thisTempo.Select(x => new { label = x.Label, value = x.Value }).ToList(),
                prevCycle = prevTempo.Select(x => new { label = x.Label, value = x.Value }).ToList(),
                deltaPercent = prevTotal > 0 ? Percent(thisTotal - prevTotal, prevTotal) : 0
            },
            categoriesOpen = categories
                .Select(c =>
                {
                    var key = Str(c, "key") ?? "";
                    var cfg = openCategories?[key] as JsonObject;
                    return new
                    {
                        key,
                        labelAr = Str(c, "labelAr") ?? key,
                        isOpen = BoolProp(cfg, "isOpen") ?? BoolProp(c, "isOpen") ?? false,
                        capacity = (cfg?.TryGetPropertyValue("capacity", out var cc) == true ? cc?.DeepClone() : null)
                            ?? (c.TryGetPropertyValue("capacity", out var cap) ? cap?.DeepClone() : null)
                    };
                })
                .ToList(),
            integrationsHealthy = integrations.Count(x => Str(x, "status") == "healthy"),
            integrationsTotal = integrations.Count,
            generatedAt = now.ToString("O")
        };
    }

    /* ── Stage funnel ──────────────────────────────────────────────── */

    public async Task<object> FunnelAsync(CancellationToken ct)
    {
        var (applicants, _) = await ActiveCycleApplicantsAsync(ct);
        var total = applicants.Count;
        var now = DateTimeOffset.UtcNow;
        var points = new List<object>(StageLabels.Length);
        var prevCount = total;
        for (var i = 1; i <= StageLabels.Length; i++)
        {
            var reached = applicants.Count(x => StageOf(x) >= i);
            var dwellers = applicants.Where(x => StageOf(x) == i).ToList();
            var avgDays = dwellers.Count == 0
                ? 0
                : Math.Round(dwellers.Average(x => Math.Max(0, (now - LastActivity(x)).TotalDays)), 1);
            points.Add(new
            {
                stageIndex = i,
                stageLabel = StageLabels[i - 1],
                count = reached,
                percentOfTotal = Percent(reached, total),
                dropOffFromPrevPercent = i == 1 ? 0 : Percent(Math.Max(0, prevCount - reached), prevCount),
                avgDaysAtStage = avgDays,
                isBottleneck = dwellers.Count > 0 && avgDays >= BottleneckDays,
            });
            prevCount = reached;
        }
        return points;
    }

    /* ── By department ─────────────────────────────────────────────── */

    public async Task<object> ByDepartmentAsync(CancellationToken ct)
    {
        var (applicants, _) = await ActiveCycleApplicantsAsync(ct);
        var total = Math.Max(1, applicants.Count);
        var byDepartment = applicants
            .GroupBy(CategoryKeyOf)
            .Select(g =>
            {
                var passed = g.Count(x => Str(x, "status") is "approved" or "under-review");
                var failed = g.Count(x => Str(x, "status") == "rejected");
                var pending = g.Count() - passed - failed;
                return new
                {
                    key = g.Key,
                    labelAr = CategoryLabels.TryGetValue(g.Key, out var label) ? label : g.Key,
                    total = g.Count(),
                    percentOfTotal = Percent(g.Count(), total),
                    eligibilityPassed = passed,
                    eligibilityFailed = failed,
                    eligibilityPending = pending,
                    eligibilityPassRate = Percent(passed, g.Count())
                };
            })
            .OrderByDescending(x => x.total)
            .Take(8)
            .ToList();

        // Real reasons only: committee rejections persist `rejectionReason` on
        // the applicant row. No stored reason → the list stays empty and the
        // frontend renders its designed empty state.
        var rejectedWithReason = applicants
            .Where(x => Str(x, "status") == "rejected")
            .Select(x => Str(x, "rejectionReason"))
            .Where(reason => !string.IsNullOrWhiteSpace(reason))
            .Select(reason => reason!)
            .ToList();
        var topRejectionReasons = rejectedWithReason
            .GroupBy(ReasonKeyOf)
            .Select(g => new
            {
                reason = g.Key,
                labelAr = g.First(),
                count = g.Count(),
                percent = Percent(g.Count(), rejectedWithReason.Count)
            })
            .OrderByDescending(x => x.count)
            .Take(5)
            .ToList();

        return new { byDepartment, topRejectionReasons };
    }

    /* ── Test results ──────────────────────────────────────────────── */

    public async Task<object> TestResultsAsync(CancellationToken ct)
    {
        var applicantsAll = await LiveApplicantsAsync(ct);
        var cycles = await CyclesAsync(ct);
        var active = ActiveCycle(cycles);
        var cycleId = Str(active, "id") ?? "";
        var examNames = await ExamNameByCodeAsync(ct);

        var outcomes = CollectOutcomes(
            applicantsAll.Where(x => InCycle(x, cycleId)), examNames);

        var previous = PreviousCycle(cycles, active, ParseDate(Str(active, "openDate")) ?? DateTimeOffset.UtcNow);
        var prevId = previous is null ? null : Str(previous, "id");
        var prevOutcomes = string.IsNullOrWhiteSpace(prevId)
            ? []
            : CollectOutcomes(applicantsAll.Where(x => Str(x, "cycleId") == prevId), examNames);
        var prevRateByKind = prevOutcomes
            .GroupBy(o => o.Kind)
            .ToDictionary(g => g.Key, g => PassRate(g.ToList()));

        var byKind = KindOrder
            .Where(kind => outcomes.Any(o => o.Kind == kind))
            .Select(kind =>
            {
                var rows = outcomes.Where(o => o.Kind == kind).ToList();
                var passed = rows.Count(o => o.Outcome == "passed");
                var failed = rows.Count(o => o.Outcome == "failed");
                var rate = PassRate(rows);
                var prevRate = prevRateByKind.TryGetValue(kind, out var p) ? p : rate;
                return new
                {
                    kind,
                    labelAr = KindLabels[kind],
                    passed,
                    failed,
                    pending = rows.Count - passed - failed,
                    passRate = rate,
                    prevCyclePassRate = prevRate,
                    deltaPercent = Math.Round(rate - prevRate, 1)
                };
            })
            .ToList();

        var kinds = byKind.Select(x => x.kind).ToList();
        var governorates = outcomes
            .GroupBy(o => o.Governorate)
            .OrderByDescending(g => g.Count())
            .Take(8)
            .Select(g => g.Key)
            .ToList();
        var passRates = governorates
            .Select(gov => kinds
                .Select(kind => PassRate(outcomes.Where(o => o.Governorate == gov && o.Kind == kind).ToList()))
                .ToArray())
            .ToArray();

        return new
        {
            byKind,
            governorateHeatmap = new { governorates, kinds, passRates }
        };
    }

    /* ── Operational status ────────────────────────────────────────── */

    public async Task<object> OperationalStatusAsync(CancellationToken ct)
    {
        return new
        {
            committees = await TodayCommitteeLoadAsync(ct),
            // Medical stations and board sessions are operated by the on-prem
            // deployment — the cloud DB has no live rows for them. Empty lists
            // render the sections' designed empty states.
            medicalStations = Array.Empty<object>(),
            boardSessions = Array.Empty<object>(),
            ongoingExams = await OngoingExamsAsync(ct)
        };
    }

    /// <summary>Today's committee instances with real load figures: queue from
    /// the reserved count, processed/signed-off from `committee_results`
    /// entered or approved today (Cairo time).</summary>
    private async Task<IReadOnlyList<object>> TodayCommitteeLoadAsync(CancellationToken ct)
    {
        var cycles = await CyclesAsync(ct);
        var cycleId = Str(ActiveCycle(cycles), "id") ?? "";
        var directory = await records.LoadCommitteeDirectoryAsync(ct);

        var today = TodayLocal();
        var todayDate = DateOnly.Parse(today, CultureInfo.InvariantCulture);
        var todays = await db.CommitteeInstances.AsNoTracking()
            .Where(x => x.Date == todayDate)
            .Where(x => x.CycleId == "" || x.CycleId == cycleId)
            .ToListAsync(ct);

        var results = await db.CommitteeResults.AsNoTracking()
            .Where(x => x.EnteredAt != null || x.ApprovedAt != null)
            .Select(x => new { x.CommitteeId, x.EnteredAt, x.ApprovedAt })
            .ToListAsync(ct);
        var resultsToday = results
            .Where(x => x.EnteredAt is not null && x.EnteredAt.Value.ToOffset(LocalOffset()).ToString("yyyy-MM-dd") == today)
            .ToList();
        var approvedToday = results
            .Where(x => x.ApprovedAt is not null && x.ApprovedAt.Value.ToOffset(LocalOffset()).ToString("yyyy-MM-dd") == today)
            .Select(x => x.CommitteeId ?? "")
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return todays.Select(x =>
        {
            var processed = resultsToday.Count(r =>
            {
                var committee = r.CommitteeId ?? "";
                return committee == x.Id || committee.Equals(x.DefinitionCode, StringComparison.OrdinalIgnoreCase);
            });
            return (object)new
            {
                id = x.Id,
                name = directory.NameByCode.GetValueOrDefault(x.DefinitionCode) ?? x.DefinitionCode,
                todayQueue = x.Reserved,
                todayProcessed = processed,
                signedOffToday = approvedToday.Contains(x.Id) || approvedToday.Contains(x.DefinitionCode)
            };
        }).ToList();
    }

    /// <summary>Exams running on the cloud Question Bank: published exams with
    /// live proctoring sessions. Session rows carry per-applicant status.</summary>
    private async Task<IReadOnlyList<object>> OngoingExamsAsync(CancellationToken ct)
    {
        var exams = await SafeListAsync("exams", ct);
        var sessions = await SafeListAsync("exam-live-sessions", ct);
        return exams
            .Where(x => Str(x, "status") == "published")
            .Select(exam =>
            {
                var examId = Str(exam, "id") ?? "";
                var rows = sessions.Where(s => Str(s, "examId") == examId).ToList();
                var taking = rows.Count(s => Str(s, "status") is "started" or "in-progress");
                var progress = rows
                    .Select(s => AdminRecordJson.NumberProp(s, "progressPercent")
                        ?? AdminRecordJson.NumberProp(s, "progress")
                        ?? AdminRecordJson.NumberProp(s, "completionPercent"))
                    .Where(p => p is not null)
                    .Select(p => p!.Value)
                    .ToList();
                return new
                {
                    id = examId,
                    name = Str(exam, "title") ?? Str(exam, "name") ?? examId,
                    startedTime = Str(exam, "startedAt") ?? Str(exam, "publishedAt") ?? Str(exam, "updatedAt")
                        ?? DateTimeOffset.UtcNow.ToString("O"),
                    takingCount = taking,
                    avgCompletionPercent = progress.Count == 0 ? 0 : (int)Math.Round(progress.Average()),
                    abandonedCount = rows.Count(s => Str(s, "status") == "dropped"),
                    sessionCount = rows.Count
                };
            })
            .Where(x => x.sessionCount > 0)
            .Select(x => (object)new { x.id, x.name, x.startedTime, x.takingCount, x.avgCompletionPercent, x.abandonedCount })
            .ToList();
    }

    /* ── Governance ────────────────────────────────────────────────── */

    public async Task<object> GovernanceAsync(CancellationToken ct)
    {
        var since = DateTimeOffset.UtcNow.AddHours(-24);
        var rows = await db.AuditRows.AsNoTracking()
            .Where(x => x.CreatedAt >= since)
            .OrderByDescending(x => x.CreatedAt)
            .Take(2000)
            .ToListAsync(ct);

        var hourly = rows
            .GroupBy(x => x.CreatedAt.ToOffset(LocalOffset()).ToString("HH"))
            .Select(g => new
            {
                label = g.Key,
                total = g.Count(),
                highSensitivity = g.Count(x => IsHighSensitivity(x.Action ?? "") || IsHighSensitivity(x.Details ?? ""))
            })
            .OrderBy(x => x.label)
            .ToList();
        var sensitive = rows
            .Where(x => IsHighSensitivity(x.Action ?? "") || IsHighSensitivity(x.Details ?? ""))
            .ToList();
        var anomalies = sensitive
            .Take(5)
            .Select(x => new
            {
                id = x.Id,
                timestamp = x.CreatedAt.ToUnixTimeMilliseconds(),
                actor = string.IsNullOrWhiteSpace(x.ActorName) ? "النظام" : x.ActorName,
                actionLabel = x.Action ?? "",
                applicantId = x.EntityId,
                detail = x.Details ?? "",
                reason = "إجراء عالي الحساسية"
            })
            .ToList();

        return new
        {
            hourly,
            anomalies,
            totalLast24h = rows.Count,
            highSensitivityLast24h = sensitive.Count
        };
    }

    /* ── Integrations ──────────────────────────────────────────────── */

    /// <summary>
    /// The integrations that actually exist in this deployment — the MOI auth
    /// gateway, the biometric device gateway, and the Fawry payment seam.
    /// Status derives from the configured <c>&lt;System&gt;:Mode</c> flags
    /// (real-but-unconfigured gateways report degraded); call activity derives
    /// from the audit trail of the last 24 hours.
    /// </summary>
    public async Task<IReadOnlyList<JsonObject>> IntegrationsAsync(CancellationToken ct)
    {
        var since = DateTimeOffset.UtcNow.AddHours(-24);
        var audit = await db.AuditRows.AsNoTracking()
            .Where(x => x.CreatedAt >= since)
            .Select(x => new { x.Module, x.Action, x.CreatedAt })
            .ToListAsync(ct);
        var todayStart = DateTimeOffset.UtcNow.ToOffset(LocalOffset()).Date;

        JsonObject IntegrationRow(string key, string nameAr, string status, params string[] keywords)
        {
            var calls = audit
                .Where(x => keywords.Any(k =>
                    (x.Module ?? "").Contains(k, StringComparison.OrdinalIgnoreCase) ||
                    (x.Action ?? "").Contains(k, StringComparison.OrdinalIgnoreCase)))
                .ToList();
            var last = calls.Count == 0 ? (DateTimeOffset?)null : calls.Max(x => x.CreatedAt);
            return new JsonObject
            {
                ["key"] = key,
                ["nameAr"] = nameAr,
                ["status"] = status,
                ["lastCallRelative"] = last is null ? "لا نداءات خلال ٢٤ ساعة" : Relative(last.Value),
                ["callsToday"] = calls.Count(x => x.CreatedAt.ToOffset(LocalOffset()).Date >= todayStart)
            };
        }

        var moiMode = (config["Moi:Mode"] ?? "simulated").Trim().ToLowerInvariant();
        var bioMode = (config["Biometric:Mode"] ?? "simulated").Trim().ToLowerInvariant();

        return
        [
            IntegrationRow("moi", "وزارة الداخلية", moiMode == "real" ? "degraded" : "healthy",
                "auth", "moi", "identity", "login", "user"),
            IntegrationRow("biometric", "التحقق الحيوي", bioMode == "real" ? "degraded" : "healthy",
                "biometric", "bio"),
            // The payment seam is an internal simulation with no failure
            // signal to read — "healthy" is its documented steady state.
            IntegrationRow("fawry", "فوري للمدفوعات", "healthy", "payment", "pay")
        ];
    }

    /* ── Shared derivations ────────────────────────────────────────── */

    private const int BottleneckDays = 5;

    private static string[] StageLabels => ApplicantStageDerivation.StageLabels;

    private static readonly IReadOnlyDictionary<string, string> CategoryLabels = new Dictionary<string, string>
    {
        ["officers_general"] = "قسم الضباط (قسم عام)",
        ["law_bachelor"] = "ليسانس حقوق",
        ["physical_education_bachelor"] = "بكالوريوس تربية رياضية",
        ["specialized_officers"] = "الضباط المتخصصون"
    };

    private static readonly string[] KindOrder = ["medical", "physical", "psychological", "interview", "drug"];

    private static readonly IReadOnlyDictionary<string, string> KindLabels = new Dictionary<string, string>
    {
        ["medical"] = "الكشف الطبي",
        ["physical"] = "اختبار اللياقة",
        ["psychological"] = "الاختبار النفسي",
        ["interview"] = "المقابلة الشخصية",
        ["drug"] = "تحليل المخدرات"
    };

    private sealed record OutcomeRow(string Kind, string Governorate, string Outcome);

    private async Task<List<JsonObject>> LiveApplicantsAsync(CancellationToken ct) =>
        (await records.ListAsync("applicants", enrichApplicantCommitteeNames: false, ct))
            .Where(x => !AdminRecordJson.IsSoftDeleted(x))
            .ToList();

    private async Task<(List<JsonObject> Applicants, string CycleId)> ActiveCycleApplicantsAsync(CancellationToken ct)
    {
        var cycles = await CyclesAsync(ct);
        var cycleId = Str(ActiveCycle(cycles), "id") ?? "";
        var applicants = (await LiveApplicantsAsync(ct)).Where(x => InCycle(x, cycleId)).ToList();
        return (applicants, cycleId);
    }

    /// <summary>Cycles read from the normalized `admission_cycles` table; the
    /// payload mirror carries openDate/closeDate/openCategories.</summary>
    private async Task<List<JsonObject>> CyclesAsync(CancellationToken ct)
    {
        var rows = await db.AdmissionCycles.AsNoTracking().ToListAsync(ct);
        var cycles = new List<JsonObject>(rows.Count);
        foreach (var row in rows)
        {
            var payload = ParsePayload(row.PayloadJson);
            payload["id"] = row.Id;
            payload["nameAr"] ??= row.NameAr;
            payload["status"] ??= row.Status;
            if (row.IsActive) payload["isActive"] = true;
            if (AdminRecordJson.IsSoftDeleted(payload)) continue;
            cycles.Add(payload);
        }
        return cycles;
    }

    private async Task<List<JsonObject>> CategoriesAsync(CancellationToken ct)
    {
        var rows = await db.ApplicantCategories.AsNoTracking().ToListAsync(ct);
        var categories = new List<JsonObject>(rows.Count);
        foreach (var row in rows)
        {
            var payload = ParsePayload(row.PayloadJson);
            payload["key"] = row.Key;
            if (AdminRecordJson.IsSoftDeleted(payload)) continue;
            categories.Add(payload);
        }
        return categories;
    }

    private static JsonObject ParsePayload(string? payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson)) return [];
        try
        {
            return JsonNode.Parse(payloadJson) as JsonObject ?? [];
        }
        catch (System.Text.Json.JsonException)
        {
            return [];
        }
    }

    /// <summary>Optional doc-store buckets (exams, live sessions) throw
    /// InvalidOperationException when the module isn't registered on the
    /// current provider — an empty dataset, not a failure, for this report.</summary>
    private async Task<IReadOnlyList<JsonObject>> SafeListAsync(string module, CancellationToken ct)
    {
        try { return await records.ListAsync(module, ct); }
        catch (InvalidOperationException) { return []; }
    }

    private async Task<IReadOnlyDictionary<string, string>> ExamNameByCodeAsync(CancellationToken ct)
    {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var rows = await db.LookupRows.AsNoTracking()
            .Where(x => x.LookupKey == "tests" || x.LookupKey == "exam-plan-tests" || x.LookupKey == "test-results")
            .Select(x => new { x.Code, x.Name })
            .ToListAsync(ct);
        foreach (var row in rows) map.TryAdd(row.Code, row.Name);
        return map;
    }

    /// <summary>Explodes booked applicants' `followUp[examCode]` outcomes —
    /// the same store Stage-10 and the data-exchange export read — into
    /// (kind, governorate, outcome) rows. Exam codes resolve to a test kind
    /// through the `tests` lookup name; codes that don't match a known kind
    /// are excluded rather than misfiled.</summary>
    private static List<OutcomeRow> CollectOutcomes(
        IEnumerable<JsonObject> applicants,
        IReadOnlyDictionary<string, string> examNames)
    {
        var outcomes = new List<OutcomeRow>();
        foreach (var applicant in applicants)
        {
            if (applicant["followUp"] is not JsonObject followUp || followUp.Count == 0) continue;
            var governorate = Str(applicant, "birthGovernorate") ?? Str(applicant, "governorate") ?? "غير محدد";
            foreach (var (code, node) in followUp)
            {
                var outcome = node?.ToString();
                if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(outcome)) continue;
                var kind = KindOf(examNames.GetValueOrDefault(code) ?? code);
                if (kind is null) continue;
                outcomes.Add(new OutcomeRow(kind, governorate, outcome));
            }
        }
        return outcomes;
    }

    private static string? KindOf(string examName)
    {
        if (examName.Contains("طبي") || examName.Contains("طبى")) return "medical";
        if (examName.Contains("رياض") || examName.Contains("لياق") || examName.Contains("بدني")) return "physical";
        if (examName.Contains("نفسي") || examName.Contains("نفسى")) return "psychological";
        if (examName.Contains("مقابل") || examName.Contains("شخصية") || examName.Contains("هيئة")) return "interview";
        if (examName.Contains("مخدرات") || examName.Contains("تحليل")) return "drug";
        return null;
    }

    private static double PassRate(IReadOnlyCollection<OutcomeRow> rows)
    {
        var passed = rows.Count(o => o.Outcome == "passed");
        var failed = rows.Count(o => o.Outcome == "failed");
        return Percent(passed, passed + failed);
    }

    private sealed record TempoPoint(string Label, int Value);

    /// <summary>Buckets real registration timestamps over the cycle's open →
    /// close span (max 60 buckets), mirroring the chart contract the frontend
    /// established. Rows without a parseable date are skipped, not guessed.</summary>
    private static List<TempoPoint> Tempo(IReadOnlyList<JsonObject> applicants, DateTimeOffset open, DateTimeOffset close)
    {
        var totalDays = Math.Max(14, (int)Math.Ceiling((close - open).TotalDays));
        var bucketCount = Math.Min(60, totalDays);
        var values = new int[bucketCount];
        var spanMs = Math.Max(1, (close - open).TotalMilliseconds);
        foreach (var applicant in applicants)
        {
            var registered = ParseDate(Str(applicant, "submittedAt") ?? Str(applicant, "registeredAt") ?? Str(applicant, "createdAt") ?? Str(applicant, "created_at"));
            if (registered is null) continue;
            var ratio = (registered.Value - open).TotalMilliseconds / spanMs;
            var index = Math.Min(bucketCount - 1, Math.Max(0, (int)Math.Floor(ratio * bucketCount)));
            values[index] += 1;
        }
        return values.Select((value, index) => new TempoPoint((index + 1).ToString(CultureInfo.InvariantCulture), value)).ToList();
    }

    private static JsonObject? ActiveCycle(IReadOnlyList<JsonObject> cycles) =>
        cycles.FirstOrDefault(x => Str(x, "status") is "active" or "open" || BoolProp(x, "isActive") == true)
            ?? cycles.FirstOrDefault();

    private static JsonObject? PreviousCycle(IReadOnlyList<JsonObject> cycles, JsonObject? active, DateTimeOffset activeOpen)
    {
        var activeId = Str(active, "id");
        return cycles
            .Where(x => Str(x, "id") != activeId)
            .Select(x => new { Row = x, Close = ParseDate(Str(x, "closeDate")) ?? DateTimeOffset.MinValue })
            .Where(x => x.Close <= activeOpen)
            .OrderByDescending(x => x.Close)
            .FirstOrDefault()?.Row;
    }

    /// <summary>An applicant belongs to the active cycle when its cycle tag
    /// matches — or is blank (portal drafts created before the tag existed),
    /// mirroring the admin applicants list and data-exchange scoping.</summary>
    private static bool InCycle(JsonObject row, string cycleId)
    {
        if (string.IsNullOrWhiteSpace(cycleId)) return true;
        var tagged = Str(row, "cycleId") ?? Str(row, "admissionCycleId") ?? Str(row, "cycle_id");
        return string.IsNullOrWhiteSpace(tagged) || tagged == cycleId;
    }

    private static string CategoryKeyOf(JsonObject applicant)
    {
        var category = Str(applicant, "categoryKey") ?? Str(applicant, "categoryId")
            ?? Str(applicant, "applicantCategory") ?? Str(applicant, "category");
        if (!string.IsNullOrWhiteSpace(category))
        {
            return CategoryLabels.ContainsKey(category) ? category : Slug(category);
        }
        return Slug(Str(applicant, "department") ?? Str(applicant, "certType") ?? string.Empty);
    }

    private static string Slug(string value)
        => CategoryLabels.FirstOrDefault(pair => pair.Value == value).Key ?? "officers_general";

    /// <summary>Maps a stored rejection-reason text onto the typed reason key
    /// the frontend understands; unrecognised texts fall back to a generic key
    /// but keep their original Arabic label.</summary>
    private static string ReasonKeyOf(string reason)
    {
        if (reason.Contains("السن")) return "age_out_of_range";
        if (reason.Contains("مجموع") || reason.Contains("الحد الأدنى")) return "score_below_min";
        if (reason.Contains("مؤهل")) return "qualification_mismatch";
        if (reason.Contains("النوع")) return "gender_mismatch";
        if (reason.Contains("الحالة الاجتماعية")) return "marital_status_mismatch";
        if (reason.Contains("طول")) return "height_below_min";
        return "data_not_found";
    }

    private static bool IsHighSensitivity(string value) =>
        value.Contains("اعتماد", StringComparison.OrdinalIgnoreCase) ||
        value.Contains("تحديث حالة", StringComparison.OrdinalIgnoreCase) ||
        value.Contains("إصدار", StringComparison.OrdinalIgnoreCase) ||
        value.Contains("حذف", StringComparison.OrdinalIgnoreCase) ||
        value.Contains("إعادة تعيين", StringComparison.OrdinalIgnoreCase) ||
        value.Contains("تصدير", StringComparison.OrdinalIgnoreCase);

    private static int StageOf(JsonObject row) => ApplicantStageDerivation.StageOf(row);

    private static DateTimeOffset LastActivity(JsonObject row) =>
        ParseDate(Str(row, "lastActivityAt") ?? Str(row, "updatedAt") ?? Str(row, "updated_at"))
            ?? ParseDate(Str(row, "submittedAt") ?? Str(row, "registeredAt"))
            ?? DateTimeOffset.UtcNow;

    private static string? Str(JsonObject? obj, string name) => obj is null ? null : AdminRecordJson.StringProp(obj, name);

    private static bool? BoolProp(JsonObject? obj, string name)
    {
        if (obj?.TryGetPropertyValue(name, out var node) != true || node is not JsonValue value) return null;
        if (value.TryGetValue<bool>(out var flag)) return flag;
        if (value.TryGetValue<string>(out var text) && bool.TryParse(text, out var parsed)) return parsed;
        return null;
    }

    private static double Percent(int part, int total) => total <= 0 ? 0 : Math.Round(part * 100.0 / total, 1);

    private static DateTimeOffset? ParseDate(string? value) =>
        DateTimeOffset.TryParse(value, out var parsed) ? parsed : null;

    private static string TodayLocal() =>
        DateTimeOffset.UtcNow.ToOffset(LocalOffset()).ToString("yyyy-MM-dd");

    /// <summary>Egypt local offset — exam days and audit hours read in Cairo
    /// time, not UTC. Falls back to UTC when the tz database is unavailable.</summary>
    private static TimeSpan LocalOffset()
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

    private static readonly string[] HijriMonths =
    [
        "محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة",
        "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"
    ];

    private static string HijriDate(DateTimeOffset date)
    {
        try
        {
            var calendar = new UmAlQuraCalendar();
            var local = date.UtcDateTime;
            return $"{calendar.GetDayOfMonth(local)} {HijriMonths[calendar.GetMonth(local) - 1]} {calendar.GetYear(local)}";
        }
        catch (ArgumentOutOfRangeException)
        {
            return "";
        }
    }

    private static string Relative(DateTimeOffset moment)
    {
        var elapsed = DateTimeOffset.UtcNow - moment;
        if (elapsed < TimeSpan.FromMinutes(1)) return "الآن";
        if (elapsed < TimeSpan.FromHours(1)) return $"منذ {(int)elapsed.TotalMinutes} دقيقة";
        if (elapsed < TimeSpan.FromHours(24)) return $"منذ {(int)elapsed.TotalHours} ساعة";
        return $"منذ {(int)elapsed.TotalDays} يوم";
    }
}
