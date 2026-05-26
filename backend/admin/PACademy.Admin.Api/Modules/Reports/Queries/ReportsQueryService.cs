using System.Text.Json.Nodes;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Modules.Reports.Dtos;

namespace PACademy.Admin.Api.Modules.Reports.Queries;

public sealed class ReportsQueryService(AdminRecordsService records)
{
    private static readonly string[] StageLabels =
    [
        "رقم الهاتف",
        "رسالة التأكيد",
        "البيانات الشخصية",
        "بيانات المؤهل",
        "الحالة الاجتماعية",
        "سداد الرسوم",
        "بيانات الأسرة",
        "موعد الاختبار",
        "كارت التردد",
        "المتابعة",
        "وثيقة التعارف"
    ];

    public async Task<object> AggregateAsync(ReportsFiltersDto filters, string groupBy, CancellationToken ct)
    {
        var rows = await FilterApplicantsAsync(filters, ct);
        var groups = rows.GroupBy(row => Dimension(row, groupBy))
            .Select(group =>
            {
                var total = group.Count();
                var paid = group.Count(x => PaymentStatus(x) == "paid");
                var unpaid = total - paid;
                return new AggregateRowDto(
                    group.Key.Key,
                    group.Key.Label,
                    total,
                    paid,
                    unpaid,
                    total == 0 ? 0 : Math.Round(total * 100.0 / Math.Max(1, rows.Count), 2));
            })
            .OrderByDescending(x => x.Total)
            .ToList();
        return new
        {
            groupBy,
            rows = groups,
            grandTotal = new
            {
                total = rows.Count,
                paid = rows.Count(x => PaymentStatus(x) == "paid"),
                unpaid = rows.Count(x => PaymentStatus(x) != "paid")
            },
            generatedAt = DateTimeOffset.UtcNow
        };
    }

    public async Task<ReportPageDto<ApplicantReportRowDto>> DetailAsync(
        ReportsFiltersDto filters,
        int page,
        int pageSize,
        string? sort,
        string? search,
        CancellationToken ct)
    {
        var rows = await FilterApplicantsAsync(filters, ct);
        if (!string.IsNullOrWhiteSpace(search))
        {
            rows = rows.Where(x => (Text(x, "nationalId") ?? Text(x, "nid") ?? "").Contains(search, StringComparison.Ordinal)).ToList();
        }
        var mapped = rows.Select(ToApplicantRow).ToList();
        mapped = SortApplicants(mapped, sort).ToList();
        return Page(mapped, page, Math.Min(pageSize, 200));
    }

    public async Task<object> DropoffAsync(
        ReportsFiltersDto filters,
        int page,
        int pageSize,
        int staleDays,
        CancellationToken ct)
    {
        var allFilters = new ReportsFiltersDto
        {
            CycleId = filters.CycleId,
            DateFrom = filters.DateFrom,
            DateTo = filters.DateTo,
            AgeMin = filters.AgeMin,
            AgeMax = filters.AgeMax,
            CategoryKey = filters.CategoryKey,
            ApplicantType = filters.ApplicantType,
            Gender = filters.Gender,
            CommitteeId = filters.CommitteeId,
            SpecializationCode = filters.SpecializationCode,
            PaymentStatus = filters.PaymentStatus
        };
        var all = await FilterApplicantsAsync(allFilters, ct);
        var cutoff = DateTimeOffset.UtcNow.AddDays(-staleDays);
        var stage = filters.StoppedAtStage ?? 1;
        var stuck = all
            .Where(x => Stage(x) == stage && LastActivity(x) < cutoff)
            .Select(x => ToStuckRow(x, staleDays))
            .ToList();
        var total = Math.Max(1, all.Count);
        var funnel = Enumerable.Range(1, 11)
            .Select(i => new StageFunnelDto(
                i,
                StageLabel(i),
                all.Count(x => Stage(x) >= i),
                Math.Round(all.Count(x => Stage(x) >= i) * 100.0 / total, 2),
                all.Count(x => Stage(x) == i && LastActivity(x) < cutoff)))
            .ToList();
        var pageResult = Page(stuck, page, Math.Min(pageSize, 200));
        return new
        {
            pageResult.Data,
            pageResult.Total,
            pageResult.Page,
            pageResult.PageSize,
            pageResult.TotalPages,
            funnel,
            generatedAt = DateTimeOffset.UtcNow
        };
    }

    public async Task<DataAvailabilityReportDto> ProbeAsync(ReportsFiltersDto filters, CancellationToken ct)
    {
        var cycles = await records.ListAsync("cycles", ct);
        var applicants = await records.ListAsync("applicants", ct);
        var committees = await records.ListAsync("committeeInstances", ct);
        var categories = await records.ListAsync("categories", ct);
        var cycleId = filters.CycleId ?? Text(cycles.FirstOrDefault(IsActive) ?? cycles.FirstOrDefault(), "id") ?? "";
        var cycle = cycles.FirstOrDefault(x => Text(x, "id") == cycleId);
        var applicantsInCycle = applicants.Where(x => InCycle(x, cycleId) && !AdminRecordJson.IsSoftDeleted(x)).ToList();
        var filtered = ApplyFilters(applicantsInCycle, filters).ToList();
        var committeeIds = committees.Select(x => Text(x, "id") ?? Text(x, "definitionCode") ?? "").Where(x => x.Length > 0).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var categoryIds = categories.Select(x => Text(x, "key") ?? Text(x, "code") ?? "").Where(x => x.Length > 0).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var missing = new List<MissingReferenceDto>();
        if (!string.IsNullOrWhiteSpace(filters.CommitteeId) && filters.CommitteeId != "all" && !committeeIds.Contains(filters.CommitteeId))
            missing.Add(new("committee", filters.CommitteeId, "filter"));
        if (!string.IsNullOrWhiteSpace(filters.CategoryKey) && !categoryIds.Contains(filters.CategoryKey))
            missing.Add(new("category", filters.CategoryKey, "filter"));
        missing.AddRange(applicantsInCycle
            .Select(x => Text(x, "committeeId") ?? Text(x, "committee") ?? "")
            .Where(x => x.Length > 0 && !committeeIds.Contains(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(50)
            .Select(x => new MissingReferenceDto("committee", x, "data")));
        var exists = cycle is not null;
        return new DataAvailabilityReportDto(
            exists && applicantsInCycle.Count > 0 && missing.Count == 0,
            cycleId,
            exists,
            NormalizeCycleStatus(Text(cycle, "status")),
            new DataAvailabilityTotalsDto(
                applicantsInCycle.Count,
                applicantsInCycle.Count(x => PaymentStatus(x) == "paid"),
                committees.Count,
                0),
            missing,
            filtered.Count,
            DateTimeOffset.UtcNow);
    }

    public async Task<IReadOnlyList<ApplicantReportRowDto>> ExportRowsAsync(ReportsFiltersDto filters, string report, CancellationToken ct)
    {
        var rows = await FilterApplicantsAsync(filters, ct);
        return rows.Select(ToApplicantRow).ToList();
    }

    private async Task<List<JsonObject>> FilterApplicantsAsync(ReportsFiltersDto filters, CancellationToken ct) =>
        ApplyFilters((await records.ListAsync("applicants", ct)).Where(x => !AdminRecordJson.IsSoftDeleted(x)), filters).ToList();

    private static IEnumerable<JsonObject> ApplyFilters(IEnumerable<JsonObject> rows, ReportsFiltersDto filters)
    {
        if (!string.IsNullOrWhiteSpace(filters.CycleId)) rows = rows.Where(x => InCycle(x, filters.CycleId));
        if (filters.DateFrom.HasValue) rows = rows.Where(x => SubmittedAt(x).Date >= filters.DateFrom.Value.ToDateTime(TimeOnly.MinValue));
        if (filters.DateTo.HasValue) rows = rows.Where(x => SubmittedAt(x).Date <= filters.DateTo.Value.ToDateTime(TimeOnly.MinValue));
        if (filters.AgeMin.HasValue) rows = rows.Where(x => Age(x) >= filters.AgeMin.Value);
        if (filters.AgeMax.HasValue) rows = rows.Where(x => Age(x) <= filters.AgeMax.Value);
        if (!string.IsNullOrWhiteSpace(filters.CategoryKey)) rows = rows.Where(x => CategoryKey(x) == filters.CategoryKey);
        if (!string.IsNullOrWhiteSpace(filters.ApplicantType)) rows = rows.Where(x => ApplicantType(x) == filters.ApplicantType);
        if (!string.IsNullOrWhiteSpace(filters.Gender)) rows = rows.Where(x => Text(x, "gender") == filters.Gender);
        if (!string.IsNullOrWhiteSpace(filters.CommitteeId) && filters.CommitteeId != "all") rows = rows.Where(x => (Text(x, "committeeId") ?? Text(x, "committee")) == filters.CommitteeId);
        if (!string.IsNullOrWhiteSpace(filters.SpecializationCode)) rows = rows.Where(x => (Text(x, "specializationCode") ?? Text(x, "specialization")) == filters.SpecializationCode);
        if (!string.IsNullOrWhiteSpace(filters.PaymentStatus)) rows = rows.Where(x => PaymentStatus(x) == filters.PaymentStatus);
        if (filters.StoppedAtStage.HasValue) rows = rows.Where(x => Stage(x) == filters.StoppedAtStage.Value);
        return rows;
    }

    private static ReportPageDto<T> Page<T>(IReadOnlyList<T> rows, int page, int pageSize)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);
        return new ReportPageDto<T>(
            rows.Skip((page - 1) * pageSize).Take(pageSize).ToList(),
            rows.Count,
            page,
            pageSize,
            (int)Math.Ceiling(rows.Count / (double)pageSize));
    }

    private static IEnumerable<ApplicantReportRowDto> SortApplicants(IEnumerable<ApplicantReportRowDto> rows, string? sort) =>
        sort switch
        {
            "currentStage" => rows.OrderBy(x => x.CurrentStage),
            "nationalId" => rows.OrderBy(x => x.NationalId),
            "nameAr" => rows.OrderBy(x => x.NameAr),
            "paymentStatus" => rows.OrderBy(x => x.PaymentStatus),
            "lastActivityAt" => rows.OrderByDescending(x => x.LastActivityAt),
            _ => rows.OrderByDescending(x => x.SubmittedAt)
        };

    private static ApplicantReportRowDto ToApplicantRow(JsonObject row) => new(
        Text(row, "id") ?? Text(row, "nationalId") ?? Guid.NewGuid().ToString("N"),
        Text(row, "nationalId") ?? Text(row, "nid") ?? "",
        Text(row, "nameAr") ?? Text(row, "name") ?? "متقدم",
        Text(row, "gender") ?? "male",
        Age(row),
        Text(row, "categoryLabelAr") ?? Text(row, "category") ?? CategoryKey(row),
        ApplicantTypeLabel(ApplicantType(row)),
        Text(row, "specializationLabelAr") ?? Text(row, "specialization") ?? "غير محدد",
        Text(row, "committeeLabelAr") ?? Text(row, "committee") ?? "غير محدد",
        Stage(row),
        StageLabel(Stage(row)),
        PaymentStatus(row),
        SubmittedAt(row),
        LastActivity(row));

    private static StuckApplicantRowDto ToStuckRow(JsonObject row, int staleDays) => new(
        Text(row, "id") ?? Text(row, "nationalId") ?? Guid.NewGuid().ToString("N"),
        Text(row, "nationalId") ?? Text(row, "nid") ?? "",
        Text(row, "nameAr") ?? Text(row, "name") ?? "متقدم",
        Stage(row),
        StageLabel(Stage(row)),
        LastActivity(row),
        Math.Max(staleDays, (int)Math.Floor((DateTimeOffset.UtcNow - LastActivity(row)).TotalDays)),
        Text(row, "categoryLabelAr") ?? CategoryKey(row),
        Text(row, "committeeLabelAr") ?? Text(row, "committee") ?? "غير محدد",
        PaymentStatus(row));

    private static (string Key, string Label) Dimension(JsonObject row, string groupBy) =>
        groupBy switch
        {
            "specialization" => (Text(row, "specializationCode") ?? "none", Text(row, "specializationLabelAr") ?? Text(row, "specialization") ?? "غير محدد"),
            "category" => (CategoryKey(row), Text(row, "categoryLabelAr") ?? CategoryKey(row)),
            "gender" => (Text(row, "gender") ?? "male", Text(row, "gender") == "female" ? "إناث" : "ذكور"),
            "paymentStatus" => (PaymentStatus(row), PaymentStatusLabel(PaymentStatus(row))),
            "ageBracket" => AgeBracket(Age(row)),
            _ => (Text(row, "committeeId") ?? "all", Text(row, "committeeLabelAr") ?? Text(row, "committee") ?? "غير محدد")
        };

    private static string? Text(JsonObject? obj, string name) => obj is null ? null : AdminRecordJson.StringProp(obj, name);
    private static int Stage(JsonObject row) => (int)(AdminRecordJson.NumberProp(row, "stage") ?? AdminRecordJson.NumberProp(row, "currentStage") ?? 1);
    private static string StageLabel(int stage) => StageLabels[Math.Clamp(stage, 1, 11) - 1];
    private static string PaymentStatus(JsonObject row) => Text(row, "paymentStatus") ?? Text(row, "payment_status") ?? "unpaid";
    private static string CategoryKey(JsonObject row) => Text(row, "categoryKey") ?? Text(row, "category") ?? "uncategorized";
    private static string ApplicantType(JsonObject row) => Text(row, "applicantType") ?? Text(row, "type") ?? "civilian";
    private static string ApplicantTypeLabel(string value) => value switch
    {
        "officer" => "ضابط",
        "specialized" => "متخصص",
        "doctorate" => "دكتوراه",
        "law" => "حقوق",
        _ => "مدني"
    };
    private static string PaymentStatusLabel(string value) => value switch
    {
        "paid" => "مدفوع",
        "pending" => "قيد الدفع",
        "refunded" => "مسترد",
        _ => "لم يدفع"
    };
    private static (string Key, string Label) AgeBracket(int? age) =>
        age switch
        {
            null => ("unknown", "غير محدد"),
            < 20 => ("lt20", "أقل من ٢٠"),
            <= 23 => ("20-23", "٢٠–٢٣"),
            <= 26 => ("24-26", "٢٤–٢٦"),
            _ => ("gt26", "أكبر من ٢٦")
        };
    private static DateTimeOffset SubmittedAt(JsonObject row) => ParseDate(Text(row, "submittedAt") ?? Text(row, "registeredAt")) ?? DateTimeOffset.UtcNow;
    private static DateTimeOffset LastActivity(JsonObject row) => ParseDate(Text(row, "lastActivityAt")) ?? SubmittedAt(row);
    private static DateTimeOffset? ParseDate(string? value) => DateTimeOffset.TryParse(value, out var parsed) ? parsed : null;
    private static int? Age(JsonObject row)
    {
        if (AdminRecordJson.NumberProp(row, "age") is { } age) return (int)age;
        if (DateOnly.TryParse(Text(row, "dateOfBirth"), out var dob))
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var value = today.Year - dob.Year;
            return today < dob.AddYears(value) ? value - 1 : value;
        }
        return null;
    }
    private static bool InCycle(JsonObject row, string cycleId) => string.IsNullOrWhiteSpace(cycleId) || (Text(row, "cycleId") ?? cycleId) == cycleId;
    private static bool IsActive(JsonObject row) => Text(row, "status") is "active" or "open" || Text(row, "isActive") == "true";
    private static string NormalizeCycleStatus(string? status) => status switch
    {
        "active" or "open" or "extended" => "active",
        "closed" or "processing" => "closed",
        "archived" or "finalized" => "archived",
        "draft" => "draft",
        _ => "missing"
    };
}
