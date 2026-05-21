using System.Globalization;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PACademy.Shared.Domain.Grades;

namespace PACademy.Modules.ApplicantGradesAdmin.Application.Grades;

public static class GradeConstants
{
    public const string ReasonSportsActivity = "SPORTS_ACTIVITY";
    public const string ReasonGrievance = "GRIEVANCE";
    public const string ReasonLegalCase = "LEGAL_CASE";
    public const string ReasonOther = "OTHER";

    public static readonly IReadOnlyDictionary<string, string> ReasonLabels = new Dictionary<string, string>
    {
        [ReasonSportsActivity] = "نشاط رياضي",
        [ReasonGrievance] = "تظلم",
        [ReasonLegalCase] = "حكم قضائي",
        [ReasonOther] = "أخرى",
    };

    public static readonly IReadOnlyDictionary<string, string> SchoolCategoryNames = new Dictionary<string, string>
    {
        ["SCH-01"] = "الثانوية العامة",
        ["SCH-03"] = "الثانوية الأزهرية",
        ["SCH-05"] = "الشهادة الثانوية من الخارج",
        ["SCH-06"] = "الدبلومات الأجنبية",
        ["SCH-07"] = "مدارس المتفوقين في العلوم والتكنولوجيا STEM",
    };
}

public static class GradeMapper
{
    public static GradeRowDto ToDto(ApplicantGrade row)
    {
        var orderedLog = row.Adjustments
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new GradeAdjustmentDto(x.Id, x.Reason, x.ReasonLabel, x.Note, x.Amount, x.By, x.When, x.IsActive))
            .ToList();
        var adjustmentSum = row.Adjustments.Where(x => x.IsActive).Sum(x => x.Amount);
        var effective = Clamp(row.Total + adjustmentSum, 0, row.OverrideMax ?? row.ImportMax);
        var latest = row.Adjustments
            .Where(x => x.IsActive)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => x.ReasonLabel)
            .FirstOrDefault();

        return new GradeRowDto(
            row.Seat,
            row.SeatingNumber,
            row.Nid,
            row.Name,
            row.Kind,
            row.Gender,
            row.Branch,
            row.GraduationYear,
            row.SchoolCategoryCode,
            row.School,
            row.Region,
            row.ExamRound,
            row.Total,
            row.ImportMax,
            row.OverrideMax,
            row.LastEditedAt,
            row.LastEditedBy,
            row.GradeChangedAt,
            row.PreviousGrade,
            row.Status,
            orderedLog,
            effective,
            orderedLog.Any(x => x.IsActive),
            orderedLog.Count(x => x.IsActive),
            latest,
            Convert.ToBase64String(row.RowVersion));
    }

    public static decimal Clamp(decimal value, decimal min, decimal max)
        => Math.Min(Math.Max(value, min), max);
}

public static class GradeImportLogic
{
    public static string NormalizeArabic(string value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "";
        var s = value.Trim()
            .Replace('أ', 'ا')
            .Replace('إ', 'ا')
            .Replace('آ', 'ا')
            .Replace('ٱ', 'ا')
            .Replace('ى', 'ي')
            .Replace('ة', 'ه')
            .Replace("ؤ", "و")
            .Replace("ئ", "ي")
            .Replace("ء", "");
        return RemoveDiacritics(s).ToLowerInvariant();
    }

    public static string ToAsciiDigits(string value)
    {
        var sb = new StringBuilder(value.Length);
        foreach (var ch in value)
        {
            sb.Append(ch switch
            {
                >= '٠' and <= '٩' => (char)('0' + (ch - '٠')),
                >= '۰' and <= '۹' => (char)('0' + (ch - '۰')),
                _ => ch,
            });
        }
        return sb.ToString();
    }

    public static bool IsValidNationalId(string? raw)
    {
        var nid = ToAsciiDigits(raw ?? "");
        if (nid.Length != 14 || nid.Any(ch => !char.IsDigit(ch))) return false;
        var century = nid[0] switch { '2' => 1900, '3' => 2000, _ => 0 };
        if (century == 0) return false;
        var year = century + int.Parse(nid[1..3], CultureInfo.InvariantCulture);
        var month = int.Parse(nid[3..5], CultureInfo.InvariantCulture);
        var day = int.Parse(nid[5..7], CultureInfo.InvariantCulture);
        return month is >= 1 and <= 12
            && day is >= 1 and <= 31
            && DateTime.TryParseExact($"{year:0000}-{month:00}-{day:00}", "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _);
    }

    public static string? ResolveSchoolCategoryCode(string? raw, IReadOnlyCollection<string> selected)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return selected.Count == 1 ? selected.First() : null;
        var trimmed = raw.Trim();
        if (GradeConstants.SchoolCategoryNames.ContainsKey(trimmed)) return trimmed;
        var normal = NormalizeArabic(trimmed);
        foreach (var (code, name) in GradeConstants.SchoolCategoryNames)
        {
            if (NormalizeArabic(name) == normal) return code;
        }
        return selected.Count == 1 ? selected.First() : null;
    }

    public static decimal ResolveMax(string? categoryCode, decimal? rowMax, IReadOnlyDictionary<string, decimal> byCategory)
    {
        if (rowMax.HasValue && rowMax.Value > 0) return rowMax.Value;
        if (categoryCode is not null && byCategory.TryGetValue(categoryCode, out var configured) && configured > 0) return configured;
        return categoryCode == "SCH-03" ? 510 : 410;
    }

    public static string ResolveKind(string? categoryCode, string? track)
        => categoryCode == "SCH-03" || NormalizeArabic(track ?? "").Contains("ازهر", StringComparison.Ordinal)
            ? "azhar"
            : "general";

    public static string Serialize<T>(T value) => JsonSerializer.Serialize(value, JsonOptions);
    public static T? Deserialize<T>(string value) => JsonSerializer.Deserialize<T>(value, JsonOptions);

    public static IQueryable<ApplicantGrade> ApplySort(IQueryable<ApplicantGrade> q, string? sort)
        => (sort ?? "seat:asc").Trim() switch
        {
            "seat:desc" => q.OrderByDescending(x => x.Seat),
            "nid:asc" => q.OrderBy(x => x.Nid),
            "nid:desc" => q.OrderByDescending(x => x.Nid),
            "name:asc" => q.OrderBy(x => x.Name),
            "name:desc" => q.OrderByDescending(x => x.Name),
            "total:asc" => q.OrderBy(x => x.Total),
            "total:desc" => q.OrderByDescending(x => x.Total),
            "branch:asc" => q.OrderBy(x => x.Branch),
            "branch:desc" => q.OrderByDescending(x => x.Branch),
            "school:asc" => q.OrderBy(x => x.School),
            "school:desc" => q.OrderByDescending(x => x.School),
            "region:asc" => q.OrderBy(x => x.Region),
            "region:desc" => q.OrderByDescending(x => x.Region),
            _ => q.OrderBy(x => x.Seat),
        };

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private static string RemoveDiacritics(string text)
    {
        var normalized = text.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(normalized.Length);
        foreach (var ch in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
                sb.Append(ch);
        }
        return sb.ToString().Normalize(NormalizationForm.FormC);
    }
}
