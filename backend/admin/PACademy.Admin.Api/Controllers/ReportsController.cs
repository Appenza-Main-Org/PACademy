using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using PACademy.Admin.Api.Modules.AdminRecords;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("api/admin/reports")]
public sealed class ReportsController(AdminRecordsService records) : ControllerBase
{
    [HttpGet("cycle-snapshot")]
    public async Task<ActionResult<object>> CycleSnapshot(CancellationToken ct)
    {
        var applicants = await records.ListAsync("applicants", ct);
        var cycles = await records.ListAsync("cycles", ct);
        var categories = await records.ListAsync("categories", ct);
        var days = await records.ListAsync("last14Days", ct);
        var integrations = IntegrationRows();
        var active = cycles.FirstOrDefault(x => AdminRecordJson.StringProp(x, "status") is "active" or "open") ?? cycles.FirstOrDefault();
        var total = applicants.Count;
        var approved = applicants.Count(x => AdminRecordJson.StringProp(x, "status") == "approved");
        var capacity = active is null ? null : AdminRecordJson.NumberProp(active, "expectedCapacity");
        var openDate = active is null ? DateTimeOffset.UtcNow : ParseDate(AdminRecordJson.StringProp(active, "openDate")) ?? DateTimeOffset.UtcNow;
        var closeDate = active is null ? DateTimeOffset.UtcNow : ParseDate(AdminRecordJson.StringProp(active, "closeDate")) ?? DateTimeOffset.UtcNow;
        var thisCycleTempo = days.Select(x => new
        {
            label = AdminRecordJson.StringProp(x, "label") ?? AdminRecordJson.StringProp(x, "date") ?? "",
            value = (int)(AdminRecordJson.NumberProp(x, "registrations") ?? 0)
        }).ToList();
        var previousTempo = thisCycleTempo.Select((x, i) => new { x.label, value = Math.Max(0, x.value - 4 - (i % 3)) }).ToList();
        return Ok(new
        {
            cycleId = active is null ? "" : AdminRecordJson.StringProp(active, "id") ?? "",
            cycleLabelAr = active is null ? "دورة القبول" : AdminRecordJson.StringProp(active, "nameAr") ?? "دورة القبول",
            openDateIso = openDate.ToString("O"),
            closeDateIso = closeDate.ToString("O"),
            hijriCloseDate = "ذو القعدة 1447",
            daysRemaining = Math.Max(0, (int)Math.Ceiling((closeDate - DateTimeOffset.UtcNow).TotalDays)),
            capacity,
            totalApplicants = total,
            finalApproved = approved,
            acceptanceRate = Percent(approved, total),
            prevCycleAcceptanceRate = Math.Max(0, Percent(approved, total) - 3),
            registrationTempo = new
            {
                thisCycle = thisCycleTempo,
                prevCycle = previousTempo,
                deltaPercent = 8.4
            },
            categoriesOpen = categories.Select(c => new
            {
                key = AdminRecordJson.StringProp(c, "key") ?? "",
                labelAr = AdminRecordJson.StringProp(c, "labelAr") ?? AdminRecordJson.StringProp(c, "key") ?? "",
                isOpen = c.TryGetPropertyValue("isOpen", out var isOpenNode) && isOpenNode is not null && isOpenNode.GetValue<bool>(),
                capacity = c.TryGetPropertyValue("capacity", out var cap) ? cap?.DeepClone() : null
            }).ToList(),
            integrationsHealthy = integrations.Count(x => x["status"]?.GetValue<string>() == "healthy"),
            integrationsTotal = integrations.Count,
            generatedAt = DateTimeOffset.UtcNow.ToString("O")
        });
    }

    [HttpGet("funnel")]
    public async Task<ActionResult<object>> Funnel(CancellationToken ct)
    {
        var applicants = await records.ListAsync("applicants", ct);
        var total = Math.Max(1, applicants.Count);
        var ordered = applicants
            .GroupBy(x => AdminRecordJson.StringProp(x, "stageLabel") ?? AdminRecordJson.StringProp(x, "stage") ?? "غير محدد")
            .Select((g, i) => new
            {
                stageIndex = i + 1,
                stageLabel = g.Key,
                count = g.Count(),
                percentOfTotal = Percent(g.Count(), total),
                dropOffFromPrevPercent = i == 0 ? 0 : Math.Max(0, 100 - Percent(g.Count(), total)),
                avgDaysAtStage = 2 + (i % 5),
                isBottleneck = g.Count() > total * 0.22
            })
            .OrderBy(x => x.stageIndex)
            .ToList();
        return Ok(ordered);
    }

    [HttpGet("by-department")]
    public async Task<ActionResult<object>> ByDepartment(CancellationToken ct)
    {
        var applicants = await records.ListAsync("applicants", ct);
        var total = Math.Max(1, applicants.Count);
        var byDepartment = applicants
            .GroupBy(x => AdminRecordJson.StringProp(x, "department") ?? AdminRecordJson.StringProp(x, "certType") ?? "officers_general")
            .Select(g =>
            {
                var passed = g.Count(x => AdminRecordJson.StringProp(x, "status") is "approved" or "under-review");
                var failed = g.Count(x => AdminRecordJson.StringProp(x, "status") == "rejected");
                var pending = g.Count() - passed - failed;
                return new
                {
                    key = Slug(g.Key),
                    labelAr = g.Key,
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
        return Ok(new
        {
            byDepartment,
            topRejectionReasons = new[]
            {
                new { reason = "score_below_min", labelAr = "المجموع أقل من الحد الأدنى", count = applicants.Count(x => AdminRecordJson.StringProp(x, "status") == "rejected") / 2, percent = 42.0 },
                new { reason = "age_out_of_range", labelAr = "السن خارج النطاق المسموح", count = applicants.Count(x => AdminRecordJson.StringProp(x, "status") == "rejected") / 3, percent = 28.0 },
                new { reason = "qualification_mismatch", labelAr = "المؤهل لا يطابق متطلبات الفئة", count = applicants.Count(x => AdminRecordJson.StringProp(x, "status") == "rejected") / 4, percent = 18.0 }
            }
        });
    }

    [HttpGet("test-results")]
    public async Task<ActionResult<object>> TestResults(CancellationToken ct)
    {
        var applicants = await records.ListAsync("applicants", ct);
        var govs = applicants.Select(x => AdminRecordJson.StringProp(x, "governorate") ?? "غير محدد").Distinct().Take(8).ToList();
        var kinds = new[] { "medical", "physical", "psychological", "interview", "drug" };
        return Ok(new
        {
            byKind = new[]
            {
                TestKind("medical", "الكشف الطبي", 82),
                TestKind("physical", "الاختبار الرياضي", 76),
                TestKind("psychological", "الاختبار النفسي", 88),
                TestKind("interview", "مقابلة شخصية", 69),
                TestKind("drug", "تحليل مخدرات", 94)
            },
            governorateHeatmap = new
            {
                governorates = govs,
                kinds,
                passRates = govs.Select((_, row) => kinds.Select((_, col) => 58 + ((row * 7 + col * 11) % 39)).ToArray()).ToArray()
            }
        });
    }

    [HttpGet("operational-status")]
    public async Task<ActionResult<object>> OperationalStatus(CancellationToken ct)
    {
        var instances = await records.ListAsync("committeeInstances", ct);
        var committees = await records.ListAsync("committees", ct);
        return Ok(new
        {
            committees = instances.Take(12).Select(x => new
            {
                id = AdminRecordJson.StringProp(x, "id") ?? "",
                name = AdminRecordJson.StringProp(x, "definitionCode") ?? "لجنة",
                todayQueue = (int)(AdminRecordJson.NumberProp(x, "reserved") ?? 0),
                todayProcessed = Math.Max(0, (int)(AdminRecordJson.NumberProp(x, "reserved") ?? 0) - 3),
                signedOffToday = ((int)(AdminRecordJson.NumberProp(x, "reserved") ?? 0)) % 2 == 0
            }).ToList(),
            medicalStations = new[]
            {
                new { id = "med-01", name = "الطول والوزن", queue = 42, avgWaitMinutes = 18 },
                new { id = "med-02", name = "الرمد", queue = 35, avgWaitMinutes = 22 },
                new { id = "med-03", name = "الباطنة", queue = 27, avgWaitMinutes = 16 }
            },
            boardSessions = committees.Take(4).Select((x, i) => new
            {
                id = $"board-{i + 1}",
                label = AdminRecordJson.StringProp(x, "name") ?? $"جلسة {i + 1}",
                scheduledTime = DateTimeOffset.UtcNow.AddHours(i + 1).ToString("O"),
                state = i == 0 ? "live" : "scheduled",
                memberCount = 7 + i
            }).ToList(),
            ongoingExams = new[]
            {
                new { id = "exam-physical", name = "الاختبار الرياضي", startedTime = DateTimeOffset.UtcNow.AddHours(-2).ToString("O"), takingCount = 118, avgCompletionPercent = 64, abandonedCount = 3 },
                new { id = "exam-psych", name = "الاختبار النفسي", startedTime = DateTimeOffset.UtcNow.AddHours(-1).ToString("O"), takingCount = 86, avgCompletionPercent = 48, abandonedCount = 1 }
            }
        });
    }

    [HttpGet("governance")]
    public async Task<ActionResult<object>> Governance(CancellationToken ct)
    {
        var audit = await records.ListAsync("audit", ct);
        var hourly = audit
            .GroupBy(x => DateTimeOffset.FromUnixTimeMilliseconds((long)(AdminRecordJson.NumberProp(x, "timestamp") ?? 0)).ToString("HH"))
            .Select(g => new
            {
                label = g.Key,
                total = g.Count(),
                highSensitivity = g.Count(x => IsHighSensitivity(AdminRecordJson.StringProp(x, "actionLabel") ?? AdminRecordJson.StringProp(x, "details") ?? ""))
            })
            .OrderBy(x => x.label)
            .ToList();
        var anomalies = audit
            .Where(x => IsHighSensitivity(AdminRecordJson.StringProp(x, "actionLabel") ?? AdminRecordJson.StringProp(x, "details") ?? ""))
            .Take(5)
            .Select(x => new
            {
                id = AdminRecordJson.StringProp(x, "id") ?? "",
                timestamp = (long)(AdminRecordJson.NumberProp(x, "timestamp") ?? 0),
                actor = AdminRecordJson.StringProp(x, "userName") ?? "النظام",
                actionLabel = AdminRecordJson.StringProp(x, "actionLabel") ?? "",
                applicantId = AdminRecordJson.StringProp(x, "entityId"),
                detail = AdminRecordJson.StringProp(x, "details") ?? "",
                reason = "إجراء عالي الحساسية"
            })
            .ToList();
        return Ok(new
        {
            hourly,
            anomalies,
            totalLast24h = audit.Count,
            highSensitivityLast24h = anomalies.Count
        });
    }

    [HttpGet("integrations")]
    public ActionResult<IReadOnlyList<JsonObject>> Integrations() => Ok(IntegrationRows());

    private static object TestKind(string kind, string labelAr, int rate) => new
    {
        kind,
        labelAr,
        passed = rate * 9,
        failed = (100 - rate) * 3,
        pending = 40,
        passRate = rate,
        prevCyclePassRate = Math.Max(0, rate - 4),
        deltaPercent = 4
    };

    private static double Percent(int part, int total) => total <= 0 ? 0 : Math.Round(part * 100.0 / total, 1);

    private static DateTimeOffset? ParseDate(string? value) =>
        DateTimeOffset.TryParse(value, out var parsed) ? parsed : null;

    private static string Slug(string value)
    {
        var known = new Dictionary<string, string>
        {
            ["قسم الضباط (قسم عام)"] = "officers_general",
            ["ليسانس حقوق"] = "law_bachelor",
            ["بكالوريوس تربية رياضية"] = "physical_education_bachelor",
            ["الضباط المتخصصون"] = "specialized_officers"
        };
        return known.TryGetValue(value, out var key) ? key : "officers_general";
    }

    private static bool IsHighSensitivity(string value) =>
        value.Contains("اعتماد", StringComparison.OrdinalIgnoreCase) ||
        value.Contains("تحديث حالة", StringComparison.OrdinalIgnoreCase) ||
        value.Contains("إصدار", StringComparison.OrdinalIgnoreCase);

    private static List<JsonObject> IntegrationRows() =>
    [
        new() { ["key"] = "moi", ["nameAr"] = "وزارة الداخلية", ["status"] = "healthy", ["lastCallRelative"] = "منذ 3 دقائق", ["callsToday"] = 1284 },
        new() { ["key"] = "education", ["nameAr"] = "وزارة التربية والتعليم", ["status"] = "healthy", ["lastCallRelative"] = "منذ 7 دقائق", ["callsToday"] = 943 },
        new() { ["key"] = "fawry", ["nameAr"] = "فوري", ["status"] = "degraded", ["lastCallRelative"] = "منذ 18 دقيقة", ["callsToday"] = 611 },
        new() { ["key"] = "sms", ["nameAr"] = "بوابة الرسائل", ["status"] = "healthy", ["lastCallRelative"] = "منذ دقيقة", ["callsToday"] = 2031 }
    ];
}
