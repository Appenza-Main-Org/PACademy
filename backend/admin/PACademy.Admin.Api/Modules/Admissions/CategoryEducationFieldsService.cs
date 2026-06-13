using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace PACademy.Admin.Api.Modules.Admissions;

/// <summary>
/// Per-category educational score-field configuration (Issue 3 — config-driven
/// educational fields). Rows drive which score fields the applicant profile
/// page renders per category, their labels, and their validation rules.
///
/// Defaults are materialized lazily: a category with no stored rows answers
/// with the built-in default set (replicating the previously hardcoded
/// fields) without writing; the first admin save persists the full row set
/// for that category. This keeps the table seed-free and environment-portable.
/// </summary>
public sealed class CategoryEducationFieldsService(IAdmissionsDbContext db)
{
    /// <summary>Registry of renderable input kinds (string-validated, not an enum).</summary>
    public static readonly IReadOnlySet<string> InputKinds =
        new HashSet<string>(StringComparer.Ordinal) { "number", "percentage", "academic-grade", "text" };

    /// <summary>Registry of profile sections a field can render into.</summary>
    public static readonly IReadOnlySet<string> SectionKeys =
        new HashSet<string>(StringComparer.Ordinal) { "secondary", "university", "postgraduate", "doctorate" };

    public sealed record CategoryEducationFieldDto(
        string Id,
        string CategoryKey,
        string FieldKey,
        string LabelAr,
        string InputKind,
        string SectionKey,
        bool IsRequired,
        decimal? MinValue,
        decimal? MaxValue,
        int SortOrder,
        bool IsActive);

    public async Task<IReadOnlyList<CategoryEducationFieldDto>> ListAsync(string? categoryKey, CancellationToken ct)
    {
        var query = db.CategoryEducationFields.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(categoryKey))
        {
            query = query.Where(x => x.CategoryKey == categoryKey);
        }

        var stored = await query
            .OrderBy(x => x.CategoryKey).ThenBy(x => x.SortOrder).ThenBy(x => x.FieldKey)
            .ToListAsync(ct);

        var result = stored.Select(ToDto).ToList();

        // Lazy defaults — categories with no stored rows answer with the
        // built-in set so the portal always has a field config to render.
        IEnumerable<string> categoriesToBackfill;
        if (string.IsNullOrWhiteSpace(categoryKey))
        {
            categoriesToBackfill = Defaults.Keys.Where(key => stored.All(row => row.CategoryKey != key));
        }
        else
        {
            categoriesToBackfill = Defaults.ContainsKey(categoryKey) && stored.Count == 0
                ? [categoryKey]
                : [];
        }
        foreach (var key in categoriesToBackfill)
        {
            result.AddRange(Defaults[key]);
        }

        return result
            .OrderBy(x => x.CategoryKey).ThenBy(x => x.SortOrder).ThenBy(x => x.FieldKey)
            .ToList();
    }

    /// <summary>Replace the full row set for one category (admin save).</summary>
    public async Task<IReadOnlyList<CategoryEducationFieldDto>> SaveCategoryAsync(
        string categoryKey,
        IReadOnlyList<CategoryEducationFieldDto> rows,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(categoryKey))
            throw new ValidationException("categoryKey مطلوب");
        ValidateRows(rows);

        var now = DateTimeOffset.UtcNow;
        var existing = await db.CategoryEducationFields
            .Where(x => x.CategoryKey == categoryKey)
            .ToListAsync(ct);
        var existingById = existing.ToDictionary(x => x.Id, StringComparer.Ordinal);
        var keptIds = new HashSet<string>(StringComparer.Ordinal);

        foreach (var row in rows)
        {
            if (!string.IsNullOrWhiteSpace(row.Id) && existingById.TryGetValue(row.Id, out var entity))
            {
                entity.FieldKey = row.FieldKey.Trim();
                entity.LabelAr = row.LabelAr.Trim();
                entity.InputKind = row.InputKind;
                entity.SectionKey = row.SectionKey;
                entity.IsRequired = row.IsRequired;
                entity.MinValue = row.MinValue;
                entity.MaxValue = row.MaxValue;
                entity.SortOrder = row.SortOrder;
                entity.IsActive = row.IsActive;
                entity.UpdatedAt = now;
                keptIds.Add(entity.Id);
                continue;
            }

            var created = new CategoryEducationFieldEntity
            {
                Id = $"CEF-{Guid.NewGuid():N}",
                CategoryKey = categoryKey,
                FieldKey = row.FieldKey.Trim(),
                LabelAr = row.LabelAr.Trim(),
                InputKind = row.InputKind,
                SectionKey = row.SectionKey,
                IsRequired = row.IsRequired,
                MinValue = row.MinValue,
                MaxValue = row.MaxValue,
                SortOrder = row.SortOrder,
                IsActive = row.IsActive,
                CreatedAt = now,
                UpdatedAt = now,
            };
            db.CategoryEducationFields.Add(created);
            keptIds.Add(created.Id);
        }

        foreach (var stale in existing.Where(x => !keptIds.Contains(x.Id)))
        {
            db.CategoryEducationFields.Remove(stale);
        }

        await db.SaveChangesAsync(ct);
        return await ListAsync(categoryKey, ct);
    }

    private static void ValidateRows(IReadOnlyList<CategoryEducationFieldDto> rows)
    {
        var seenKeys = new HashSet<string>(StringComparer.Ordinal);
        foreach (var row in rows)
        {
            if (string.IsNullOrWhiteSpace(row.FieldKey))
                throw new ValidationException("fieldKey مطلوب لكل حقل");
            if (string.IsNullOrWhiteSpace(row.LabelAr))
                throw new ValidationException($"labelAr مطلوب للحقل {row.FieldKey}");
            if (!InputKinds.Contains(row.InputKind))
                throw new ValidationException($"inputKind غير معروف: {row.InputKind}");
            if (!SectionKeys.Contains(row.SectionKey))
                throw new ValidationException($"sectionKey غير معروف: {row.SectionKey}");
            if (row.MinValue is { } min && row.MaxValue is { } max && min > max)
                throw new ValidationException($"الحد الأدنى أكبر من الحد الأقصى للحقل {row.FieldKey}");
            if (!seenKeys.Add(row.FieldKey.Trim()))
                throw new ValidationException($"fieldKey مكرر: {row.FieldKey}");
        }
    }

    private static CategoryEducationFieldDto ToDto(CategoryEducationFieldEntity entity) => new(
        entity.Id,
        entity.CategoryKey,
        entity.FieldKey,
        entity.LabelAr,
        entity.InputKind,
        entity.SectionKey,
        entity.IsRequired,
        entity.MinValue,
        entity.MaxValue,
        entity.SortOrder,
        entity.IsActive);

    private static CategoryEducationFieldDto Default(
        string categoryKey, string fieldKey, string labelAr, string inputKind, string sectionKey,
        bool isRequired, decimal? minValue, decimal? maxValue, int sortOrder) =>
        new($"default:{categoryKey}:{fieldKey}", categoryKey, fieldKey, labelAr, inputKind, sectionKey,
            isRequired, minValue, maxValue, sortOrder, IsActive: true);

    private static IReadOnlyList<CategoryEducationFieldDto> SecondaryTrio(string categoryKey) =>
    [
        Default(categoryKey, "thanawiTotal", "مجموع الثانوية العامة", "number", "secondary", isRequired: true, minValue: 0, maxValue: null, sortOrder: 10),
        Default(categoryKey, "thanawiPercentage", "النسبة المئوية للثانوية العامة", "percentage", "secondary", isRequired: true, minValue: 0, maxValue: 100, sortOrder: 20),
        Default(categoryKey, "thanawiGrade", "التقدير", "academic-grade", "secondary", isRequired: true, minValue: null, maxValue: null, sortOrder: 30),
    ];

    /// <summary>
    /// Built-in defaults replicating the field sets the profile page used to
    /// hardcode per category — including ليسانس حقوق omitting the university
    /// percentage (was an `isLawBachelor` conditional in the page).
    /// </summary>
    internal static readonly IReadOnlyDictionary<string, IReadOnlyList<CategoryEducationFieldDto>> Defaults =
        new Dictionary<string, IReadOnlyList<CategoryEducationFieldDto>>(StringComparer.Ordinal)
        {
            ["officers_general"] = SecondaryTrio("officers_general"),
            ["law_bachelor"] =
            [
                .. SecondaryTrio("law_bachelor"),
                Default("law_bachelor", "bachelorGrade", "تقدير الجامعة", "academic-grade", "university", isRequired: true, minValue: null, maxValue: null, sortOrder: 40),
            ],
            ["physical_education_bachelor"] =
            [
                .. SecondaryTrio("physical_education_bachelor"),
                Default("physical_education_bachelor", "bachelorPercentage", "النسبة المئوية للجامعة", "percentage", "university", isRequired: true, minValue: 0, maxValue: 100, sortOrder: 40),
                Default("physical_education_bachelor", "bachelorGrade", "تقدير الجامعة", "academic-grade", "university", isRequired: true, minValue: null, maxValue: null, sortOrder: 50),
            ],
            ["specialized_officers"] =
            [
                .. SecondaryTrio("specialized_officers"),
                Default("specialized_officers", "bachelorPercentage", "النسبة المئوية للجامعة", "percentage", "university", isRequired: true, minValue: 0, maxValue: 100, sortOrder: 40),
                Default("specialized_officers", "bachelorGrade", "تقدير الجامعة", "academic-grade", "university", isRequired: true, minValue: null, maxValue: null, sortOrder: 50),
                Default("specialized_officers", "postgradGrade", "التقدير", "academic-grade", "postgraduate", isRequired: true, minValue: null, maxValue: null, sortOrder: 60),
                Default("specialized_officers", "doctorateGrade", "التقدير", "academic-grade", "doctorate", isRequired: true, minValue: null, maxValue: null, sortOrder: 70),
            ],
        };
}
