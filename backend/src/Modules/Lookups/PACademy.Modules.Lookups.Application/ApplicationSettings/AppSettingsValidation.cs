using System.Text.Json;
using PACademy.Modules.Lookups.Domain;
using PACademy.Shared.Contracts;

namespace PACademy.Modules.Lookups.Application.ApplicationSettings;

internal static class AppSettingsValidation
{
    private static readonly JsonSerializerOptions JsonOpts = new() { WriteIndented = false };

    internal static string SerializeInts(IReadOnlyList<int> values)
        => JsonSerializer.Serialize(values ?? Array.Empty<int>(), JsonOpts);

    internal static string SerializeStrings(IReadOnlyList<string> values)
        => JsonSerializer.Serialize(values ?? Array.Empty<string>(), JsonOpts);

    internal static IReadOnlyList<int> DeserializeInts(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return Array.Empty<int>();
        try
        {
            return JsonSerializer.Deserialize<List<int>>(json) ?? new List<int>();
        }
        catch
        {
            return Array.Empty<int>();
        }
    }

    internal static IReadOnlyList<string> DeserializeStrings(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return Array.Empty<string>();
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json) ?? new List<string>();
        }
        catch
        {
            return Array.Empty<string>();
        }
    }

    /// <summary>
    /// Validates a year-row payload in isolation (no sibling-row checks).
    /// Throws <see cref="DomainConflictException"/> on any failure.
    /// Mirrors frontend appSettingsValidation.ts.
    /// </summary>
    internal static void ValidatePayload(YearRowPayload row)
    {
        if (row.GraduationYears is null || row.GraduationYears.Count == 0)
            throw new DomainConflictException("اختر سنة تخرج واحدة على الأقل", "GRAD_YEAR_REQUIRED");

        if (row.GenderTypes is null || row.GenderTypes.Count == 0)
            throw new DomainConflictException("اختر النوع (ذكور أو إناث على الأقل)", "GENDER_REQUIRED");

        if (row.MaxAge.HasValue && row.MaxAge.Value <= 0)
            throw new DomainConflictException("السن يجب أن يكون رقماً موجباً", "AGE_NOT_POSITIVE");

        if (row.AgeMin.HasValue && row.AgeMin.Value <= 0)
            throw new DomainConflictException("السن يجب أن يكون رقماً موجباً", "AGE_NOT_POSITIVE");

        if (row.AgeMin.HasValue && row.MaxAge.HasValue && row.AgeMin.Value > row.MaxAge.Value)
            throw new DomainConflictException(
                "السن الأدنى يجب أن يكون أقل من أو يساوي السن الأقصى",
                "AGE_RANGE_INVALID");

        if (row.GradeKind == ApplicantSpecializationYear.GradeKindGrades)
        {
            if (!row.MinPercentage.HasValue || row.MinPercentage.Value < 0 || row.MinPercentage.Value > 100)
                throw new DomainConflictException(
                    "الدرجة المئوية يجب أن تكون بين 0 و 100",
                    "PERCENTAGE_OUT_OF_RANGE");
        }
        else if (row.GradeKind == ApplicantSpecializationYear.GradeKindTagdir)
        {
            if (string.IsNullOrWhiteSpace(row.AcademicGradeId))
                throw new DomainConflictException(
                    "اختر تقديراً صالحاً",
                    "PERCENTAGE_OUT_OF_RANGE");
        }
        else
        {
            throw new DomainConflictException(
                "نمط التقدير غير معروف",
                "GRADE_MODE_MISMATCH");
        }

        if (!DateOnly.TryParse(row.ApplicationStartDate, out var start) ||
            !DateOnly.TryParse(row.ApplicationEndDate, out var end))
            throw new DomainConflictException(
                "تاريخ التقديم غير صالح",
                "INVALID_DATE_RANGE");

        if (end < start)
            throw new DomainConflictException(
                "تاريخ النهاية يجب أن يكون بعد تاريخ البداية",
                "INVALID_DATE_RANGE");

        if (!DateOnly.TryParse(row.AgeReferenceDate, out var refDate))
            throw new DomainConflictException(
                "تاريخ احتساب السن غير صالح",
                "INVALID_DATE_RANGE");

        if (refDate > start)
            throw new DomainConflictException(
                "تاريخ احتساب السن يجب أن يسبق بداية التقديم",
                "AGE_REFERENCE_AFTER_START");
    }

    /// <summary>
    /// Validates the candidate row against existing sibling rows under the
    /// same category-specialization, throwing on DUPLICATE_YEAR or
    /// OVERLAPPING_PERIOD. <paramref name="excludeId"/> excludes the row
    /// being updated from the sibling set.
    /// </summary>
    internal static void ValidateAgainstSiblings(
        YearRowPayload row,
        IEnumerable<ApplicantSpecializationYear> siblings,
        Guid? excludeId)
    {
        DateOnly.TryParse(row.ApplicationStartDate, out var cStart);
        DateOnly.TryParse(row.ApplicationEndDate, out var cEnd);
        var cYears = new HashSet<int>(row.GraduationYears);
        var cGenders = new HashSet<string>(row.GenderTypes);

        foreach (var sib in siblings)
        {
            if (excludeId.HasValue && sib.Id == excludeId.Value) continue;

            var sibYears = DeserializeInts(sib.GraduationYearsJson);
            var sibGenders = DeserializeStrings(sib.GenderTypesJson);

            var genderOverlap = sibGenders.Any(g => cGenders.Contains(g));
            if (!genderOverlap) continue;

            var yearOverlap = sibYears.Any(y => cYears.Contains(y));
            if (yearOverlap)
                throw new DomainConflictException(
                    "سنة التخرج موجودة بالفعل لنفس النوع في هذا التخصص",
                    "DUPLICATE_YEAR");

            var sibStart = sib.ApplicationStartDate;
            var sibEnd = sib.ApplicationEndDate;
            if (cStart <= sibEnd && sibStart <= cEnd)
                throw new DomainConflictException(
                    "فترة التقديم تتداخل مع سنة أخرى لنفس النوع",
                    "OVERLAPPING_PERIOD");
        }
    }
}
