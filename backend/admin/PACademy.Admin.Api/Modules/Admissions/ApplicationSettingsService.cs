using System.Text.Json;
using System.Text.Json.Nodes;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.Audit;
using PACademy.Admin.Api.Modules.Lookups;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Modules.Admissions;

public sealed class ApplicationSettingsService(IAdmissionsDbContext db)
{
    private const string ImplicitDefaultSpecCode = "__default__";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly ApplicationSettingsAttachSpecializationValidator AttachValidator = new();
    private static readonly ApplicationSettingsYearValidator YearValidator = new();

    public async Task<IReadOnlyList<JsonObject>> ListCategoryConfigsAsync(CancellationToken ct)
    {
        var lookups = await LoadLookupsAsync(ct);
        var specs = await db.ApplicationSettingsCategorySpecializations.AsNoTracking().ToListAsync(ct);
        var years = await db.ApplicationSettingsGraduationYears.AsNoTracking().ToListAsync(ct);
        var configs = await EnsureCategoryConfigsForLookupCategoriesAsync(lookups, ct);
        return configs.Select(c => JoinConfig(c, specs, years, lookups)).ToList();
    }

    public async Task<IReadOnlyList<JsonObject>> ListSpecializationsForConfigAsync(string configId, CancellationToken ct)
    {
        var lookups = await LoadLookupsAsync(ct);
        var years = await db.ApplicationSettingsGraduationYears.AsNoTracking().ToListAsync(ct);
        var specs = await db.ApplicationSettingsCategorySpecializations
            .AsNoTracking()
            .Where(x => x.ConfigId == configId && x.SpecializationId != ImplicitDefaultSpecCode)
            .OrderBy(x => x.Id)
            .ToListAsync(ct);

        return specs.Select(s => JoinSpec(s, years, lookups)).ToList();
    }

    public async Task<IReadOnlyList<JsonObject>> EligibleSpecializationsAsync(string configId, CancellationToken ct)
    {
        var config = await db.ApplicationSettingsCategoryConfigs.AsNoTracking().FirstOrDefaultAsync(x => x.Id == configId, ct);
        if (config is null) return [];

        var lookups = await LoadLookupsAsync(ct);
        var category = Lookup(lookups.Categories, config.CategoryId);

        var attached = await db.ApplicationSettingsCategorySpecializations
            .AsNoTracking()
            .Where(x => x.ConfigId == configId)
            .Select(x => x.SpecializationId)
            .ToListAsync(ct);

        var attachedSet = attached.ToHashSet(StringComparer.Ordinal);
        var rows = await db.LookupRows
            .AsNoTracking()
            .Where(x => x.LookupKey == "specializations" && x.IsActive && !attachedSet.Contains(x.Code))
            .ToListAsync(ct);

        return rows
            .Select(LookupToJson)
            .Where(row => IsSpecializationAllowedForCategory(row, category))
            .OrderBy(row => StringProp(row, "facultyCode"), StringComparer.Ordinal)
            .ThenBy(row => StringProp(row, "code"), StringComparer.Ordinal)
            .ToList();
    }

    public async Task<IReadOnlyList<JsonObject>> ListYearsAsync(string categorySpecializationId, CancellationToken ct)
    {
        var rows = await db.ApplicationSettingsGraduationYears
            .AsNoTracking()
            .Where(x => x.CategorySpecializationId == categorySpecializationId)
            .ToListAsync(ct);

        return rows
            .OrderByDescending(MaxGraduationYear)
            .ThenBy(x => x.Id)
            .Select(YearToJson)
            .ToList();
    }

    public async Task<IReadOnlyList<JsonObject>> SummaryAsync(CancellationToken ct)
    {
        var lookups = await LoadLookupsAsync(ct);
        var specs = await db.ApplicationSettingsCategorySpecializations.AsNoTracking().ToListAsync(ct);
        var years = await db.ApplicationSettingsGraduationYears.AsNoTracking().ToListAsync(ct);
        var configs = await EnsureCategoryConfigsForLookupCategoriesAsync(lookups, ct);

        return configs.Select(config =>
        {
            var childSpecs = specs.Where(x => x.ConfigId == config.Id).OrderBy(x => x.Id).ToList();
            var groups = new JsonArray();
            foreach (var spec in childSpecs)
            {
                var isImplicit = spec.SpecializationId == ImplicitDefaultSpecCode;
                var specLookup = isImplicit ? null : Lookup(lookups.Specializations, spec.SpecializationId);
                groups.Add(new JsonObject
                {
                    ["csId"] = spec.Id,
                    ["nameAr"] = isImplicit ? null : StringProp(specLookup, "name") ?? spec.SpecializationId,
                    ["years"] = new JsonArray(years
                        .Where(y => y.CategorySpecializationId == spec.Id)
                        .OrderByDescending(MaxGraduationYear)
                        .ThenBy(y => y.Id)
                        .Select(y => (JsonNode)YearToJson(y))
                        .ToArray())
                });
            }

            return new JsonObject
            {
                ["config"] = JoinConfig(config, specs, years, lookups),
                ["groups"] = groups,
                ["gradingMode"] = childSpecs.Count > 0 ? ResolveGradingMode(childSpecs[0].Id, specs, configs, lookups) : null
            };
        }).ToList();
    }

    public async Task<JsonObject> GradingModeAsync(string categorySpecializationId, CancellationToken ct)
    {
        var lookups = await LoadLookupsAsync(ct);
        var specs = await db.ApplicationSettingsCategorySpecializations.AsNoTracking().ToListAsync(ct);
        var configs = await db.ApplicationSettingsCategoryConfigs.AsNoTracking().ToListAsync(ct);
        return new JsonObject { ["gradingMode"] = ResolveGradingMode(categorySpecializationId, specs, configs, lookups) };
    }

    public async Task<JsonObject?> ParentCategoryAsync(string categorySpecializationId, CancellationToken ct)
    {
        var lookups = await LoadLookupsAsync(ct);
        var spec = await db.ApplicationSettingsCategorySpecializations.AsNoTracking().FirstOrDefaultAsync(x => x.Id == categorySpecializationId, ct);
        if (spec is null) return null;
        var config = await db.ApplicationSettingsCategoryConfigs.AsNoTracking().FirstOrDefaultAsync(x => x.Id == spec.ConfigId, ct);
        if (config is null) return null;
        var category = Lookup(lookups.Categories, config.CategoryId);
        if (category is null) return null;
        return new JsonObject
        {
            ["code"] = config.CategoryId,
            ["lockedGender"] = LockedGender(category)
        };
    }

    public async Task<JsonObject> AttachSpecializationAsync(string configId, JsonObject body, CancellationToken ct)
    {
        await AttachValidator.ValidateAndThrowAsync(body, ct);
        var specializationId = StringProp(body, "specializationId");
        if (string.IsNullOrWhiteSpace(specializationId)) throw new ConflictException("SPECIALIZATION_NOT_MAPPED", "التخصص غير محدد");

        var config = await db.ApplicationSettingsCategoryConfigs.FirstOrDefaultAsync(x => x.Id == configId, ct)
            ?? throw new EntityNotFoundException("إعداد الفئة غير موجود");
        var specExists = specializationId == ImplicitDefaultSpecCode ||
            await db.LookupRows.AnyAsync(x => x.LookupKey == "specializations" && x.Code == specializationId, ct);
        if (!specExists)
        {
            throw new ConflictException("SPECIALIZATION_NOT_MAPPED", "التخصص غير مرتبط بهذه الفئة", new { categoryId = config.CategoryId, specializationId });
        }
        if (specializationId != ImplicitDefaultSpecCode)
        {
            var lookupsForValidation = await LoadLookupsAsync(ct);
            var category = Lookup(lookupsForValidation.Categories, config.CategoryId);
            var specialization = await db.LookupRows
                .AsNoTracking()
                .Where(x => x.LookupKey == "specializations" && x.Code == specializationId)
                .Select(x => x.PayloadJson)
                .FirstOrDefaultAsync(ct);
            var specializationJson = specialization is null ? null : JsonNode.Parse(specialization)?.AsObject();
            if (specializationJson is not null) specializationJson["code"] = specializationId;
            if (specializationJson is null || !IsSpecializationAllowedForCategory(specializationJson, category))
            {
                throw new ConflictException("SPECIALIZATION_NOT_MAPPED", "التخصص غير مرتبط بهذه الفئة", new { categoryId = config.CategoryId, specializationId });
            }
        }

        var existing = await db.ApplicationSettingsCategorySpecializations
            .FirstOrDefaultAsync(x => x.ConfigId == configId && x.SpecializationId == specializationId, ct);
        if (existing is not null)
        {
            var lookups = await LoadLookupsAsync(ct);
            var years = await db.ApplicationSettingsGraduationYears.AsNoTracking().ToListAsync(ct);
            return JoinSpec(existing, years, lookups);
        }

        var now = DateTimeOffset.UtcNow;
        var entity = new ApplicationSettingsCategorySpecializationEntity
        {
            Id = await NextIdAsync("acs", db.ApplicationSettingsCategorySpecializations.Select(x => x.Id), ct),
            ConfigId = configId,
            SpecializationId = specializationId,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };
        db.ApplicationSettingsCategorySpecializations.Add(entity);
        AddAudit("create", "application_settings_specialization", entity.Id, new { configId, specializationId });
        await db.SaveChangesAsync(ct);

        var joinedLookups = await LoadLookupsAsync(ct);
        return JoinSpec(entity, [], joinedLookups);
    }

    public async Task DeleteSpecializationAsync(string id, CancellationToken ct)
    {
        var entity = await db.ApplicationSettingsCategorySpecializations.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new EntityNotFoundException("تخصص الفئة غير موجود");
        var years = await db.ApplicationSettingsGraduationYears.Where(x => x.CategorySpecializationId == id).ToListAsync(ct);
        db.ApplicationSettingsGraduationYears.RemoveRange(years);
        db.ApplicationSettingsCategorySpecializations.Remove(entity);
        AddAudit("delete", "application_settings_specialization", id, new { deletedYears = years.Count });
        await db.SaveChangesAsync(ct);
    }

    public async Task<JsonObject> CreateYearAsync(string categorySpecializationId, JsonObject row, CancellationToken ct)
    {
        row["categorySpecializationId"] = categorySpecializationId;
        await YearValidator.ValidateAndThrowAsync(row, ct);
        var siblings = await db.ApplicationSettingsGraduationYears
            .Where(x => x.CategorySpecializationId == categorySpecializationId)
            .ToListAsync(ct);
        var entity = JsonToYear(row);
        entity.Id = await NextIdAsync("asy", db.ApplicationSettingsGraduationYears.Select(x => x.Id), ct);
        await ValidateYearAsync(entity, siblings, excludeId: null, ct);
        var now = DateTimeOffset.UtcNow;
        entity.CreatedAt = now;
        entity.UpdatedAt = now;
        db.ApplicationSettingsGraduationYears.Add(entity);
        AddAudit("create", "application_settings_year", entity.Id, YearToJson(entity));
        await db.SaveChangesAsync(ct);
        return YearToJson(entity);
    }

    public async Task<JsonObject> UpdateYearAsync(string id, JsonObject patch, CancellationToken ct)
    {
        var current = await db.ApplicationSettingsGraduationYears.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new EntityNotFoundException("سنة التخرج غير موجودة");
        var merged = YearToJson(current);
        foreach (var item in patch) merged[item.Key] = item.Value?.DeepClone();
        await YearValidator.ValidateAndThrowAsync(merged, ct);
        var next = JsonToYear(merged);
        next.Id = id;
        next.CreatedAt = current.CreatedAt;
        next.RowVersion = current.RowVersion;

        var siblings = await db.ApplicationSettingsGraduationYears
            .Where(x => x.CategorySpecializationId == next.CategorySpecializationId)
            .ToListAsync(ct);
        await ValidateYearAsync(next, siblings, id, ct);

        current.CategorySpecializationId = next.CategorySpecializationId;
        current.GraduationYearsJson = next.GraduationYearsJson;
        current.GenderTypesJson = next.GenderTypesJson;
        current.MaritalStatusCodesJson = next.MaritalStatusCodesJson;
        current.AgeMin = next.AgeMin;
        current.MaxAge = next.MaxAge;
        current.DivisionCodesJson = next.DivisionCodesJson;
        current.SchoolCategoryCodesJson = next.SchoolCategoryCodesJson;
        current.ApplicationStartDate = next.ApplicationStartDate;
        current.ApplicationEndDate = next.ApplicationEndDate;
        current.AgeReferenceDate = next.AgeReferenceDate;
        current.IsActive = next.IsActive;
        current.GradeKind = next.GradeKind;
        current.MinPercentage = next.MinPercentage;
        current.AcademicGradeId = next.AcademicGradeId;
        current.UpdatedAt = DateTimeOffset.UtcNow;
        AddAudit("update", "application_settings_year", id, YearToJson(current));
        await db.SaveChangesAsync(ct);
        return YearToJson(current);
    }

    public async Task DeleteYearAsync(string id, CancellationToken ct)
    {
        var entity = await db.ApplicationSettingsGraduationYears.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new EntityNotFoundException("سنة التخرج غير موجودة");
        db.ApplicationSettingsGraduationYears.Remove(entity);
        AddAudit("delete", "application_settings_year", id, YearToJson(entity));
        await db.SaveChangesAsync(ct);
    }

    public async Task<JsonObject> ToggleYearAsync(string id, CancellationToken ct)
    {
        var entity = await db.ApplicationSettingsGraduationYears.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new EntityNotFoundException("سنة التخرج غير موجودة");
        entity.IsActive = !entity.IsActive;
        entity.UpdatedAt = DateTimeOffset.UtcNow;
        AddAudit("toggle", "application_settings_year", id, new { entity.IsActive });
        await db.SaveChangesAsync(ct);
        return YearToJson(entity);
    }

    public async Task<JsonObject> ToggleCategoryAsync(string configId, CancellationToken ct)
    {
        var config = await db.ApplicationSettingsCategoryConfigs.FirstOrDefaultAsync(x => x.Id == configId, ct)
            ?? throw new EntityNotFoundException("إعداد الفئة غير موجود");
        var nextActive = !config.IsActive;
        if (!nextActive)
        {
            var childSpecIds = await db.ApplicationSettingsCategorySpecializations
                .Where(x => x.ConfigId == configId)
                .Select(x => x.Id)
                .ToListAsync(ct);
            var hasActiveYears = await db.ApplicationSettingsGraduationYears
                .AnyAsync(x => childSpecIds.Contains(x.CategorySpecializationId) && x.IsActive, ct);
            if (hasActiveYears) throw new ConflictException("CATEGORY_HAS_ACTIVE_YEARS", "لا يمكن تعطيل الفئة قبل تعطيل سنواتها النشطة", new { configId });
        }

        config.IsActive = nextActive;
        config.UpdatedAt = DateTimeOffset.UtcNow;
        AddAudit("toggle", "application_settings_category_config", configId, new { config.IsActive });
        await db.SaveChangesAsync(ct);

        var lookups = await LoadLookupsAsync(ct);
        var specs = await db.ApplicationSettingsCategorySpecializations.AsNoTracking().ToListAsync(ct);
        var years = await db.ApplicationSettingsGraduationYears.AsNoTracking().ToListAsync(ct);
        return JoinConfig(config, specs, years, lookups);
    }

    public async Task<JsonObject> BulkSaveAsync(JsonArray changes, CancellationToken ct)
    {
        var created = 0;
        var updated = 0;
        var deleted = 0;

        var working = await db.ApplicationSettingsGraduationYears.ToListAsync(ct);
        var byCs = changes.OfType<JsonObject>()
            .GroupBy(x => StringProp(x, "categorySpecializationId") ?? "")
            .Where(x => !string.IsNullOrWhiteSpace(x.Key))
            .ToList();

        foreach (var group in byCs)
        {
            var hypothetical = working.Where(x => x.CategorySpecializationId == group.Key).Select(CloneYear).ToList();
            var temp = 0;
            foreach (var change in group)
            {
                var kind = StringProp(change, "kind");
                var id = StringProp(change, "id");
                var row = change["row"] as JsonObject;
                if (kind == "delete" && id is not null)
                {
                    hypothetical = hypothetical.Where(x => x.Id != id).ToList();
                }
                else if (kind == "update" && id is not null && row is not null)
                {
                    var current = hypothetical.FirstOrDefault(x => x.Id == id);
                    if (current is null) continue;
                    var merged = YearToJson(current);
                    foreach (var item in row) merged[item.Key] = item.Value?.DeepClone();
                    var next = JsonToYear(merged);
                    next.Id = id;
                    hypothetical = hypothetical.Select(x => x.Id == id ? next : x).ToList();
                }
                else if (kind == "create" && row is not null)
                {
                    row["categorySpecializationId"] = group.Key;
                    await YearValidator.ValidateAndThrowAsync(row, ct);
                    var next = JsonToYear(row);
                    next.Id = $"__pending-{temp++}";
                    hypothetical.Add(next);
                }
            }

            foreach (var row in hypothetical)
            {
                await ValidateYearAsync(row, hypothetical, row.Id, ct);
            }
        }

        foreach (var change in changes.OfType<JsonObject>())
        {
            var kind = StringProp(change, "kind");
            var id = StringProp(change, "id");
            var csId = StringProp(change, "categorySpecializationId");
            var row = change["row"] as JsonObject;
            if (kind == "delete" && id is not null)
            {
                var current = working.FirstOrDefault(x => x.Id == id);
                if (current is null) continue;
                db.ApplicationSettingsGraduationYears.Remove(current);
                working.Remove(current);
                deleted++;
            }
            else if (kind == "update" && id is not null && row is not null)
            {
                await UpdateYearAsync(id, row, ct);
                updated++;
            }
            else if (kind == "create" && csId is not null && row is not null)
            {
                await CreateYearAsync(csId, row, ct);
                created++;
            }
        }

        AddAudit("bulk_save", "application_settings_year", "bulk", new { created, updated, deleted });
        await db.SaveChangesAsync(ct);
        return new JsonObject { ["created"] = created, ["updated"] = updated, ["deleted"] = deleted };
    }

    private async Task ValidateYearAsync(ApplicationSettingsGraduationYearEntity row, IReadOnlyList<ApplicationSettingsGraduationYearEntity> siblings, string? excludeId, CancellationToken ct)
    {
        var parentMode = await ResolveGradingModeAsync(row.CategorySpecializationId, ct);
        if (parentMode is not null && row.GradeKind != parentMode)
            throw new ConflictException("GRADE_MODE_MISMATCH", "نمط التقدير لا يطابق نوع تقديم الفئة", YearToJson(row));

        var graduationYears = IntArray(row.GraduationYearsJson);
        if (graduationYears.Count == 0) throw new ConflictException("GRAD_YEAR_REQUIRED", "اختر سنة تخرج واحدة على الأقل", YearToJson(row));

        var genders = StringArray(row.GenderTypesJson);
        if (genders.Count == 0) throw new ConflictException("GENDER_REQUIRED", "اختر نوعًا واحدًا على الأقل", YearToJson(row));

        if (row.MaxAge is not null and <= 0) throw new ConflictException("AGE_NOT_POSITIVE", "الحد الأقصى للسن يجب أن يكون موجبًا", YearToJson(row));
        if (row.AgeMin is not null and <= 0) throw new ConflictException("AGE_NOT_POSITIVE", "الحد الأدنى للسن يجب أن يكون موجبًا", YearToJson(row));
        if (row.AgeMin is not null && row.MaxAge is not null && row.AgeMin > row.MaxAge)
            throw new ConflictException("AGE_RANGE_INVALID", "الحد الأدنى للسن أكبر من الحد الأقصى", YearToJson(row));
        if (row.GradeKind == "GRADES" && (row.MinPercentage is null or < 0 or > 100))
            throw new ConflictException("PERCENTAGE_OUT_OF_RANGE", "النسبة المئوية خارج النطاق", YearToJson(row));
        if (row.ApplicationEndDate < row.ApplicationStartDate)
            throw new ConflictException("INVALID_DATE_RANGE", "تاريخ نهاية التقديم يسبق تاريخ البداية", YearToJson(row));
        if (row.AgeReferenceDate > row.ApplicationStartDate)
            throw new ConflictException("AGE_REFERENCE_AFTER_START", "تاريخ حساب السن يجب أن يسبق بداية التقديم", YearToJson(row));

        foreach (var sibling in siblings.Where(x => x.Id != excludeId && x.Id != row.Id))
        {
            if (!Overlaps(genders, StringArray(sibling.GenderTypesJson))) continue;
            if (Overlaps(graduationYears, IntArray(sibling.GraduationYearsJson)))
                throw new ConflictException("DUPLICATE_YEAR", "سنة التخرج مكررة لنفس النوع", YearToJson(row));
            if (row.ApplicationStartDate <= sibling.ApplicationEndDate && sibling.ApplicationStartDate <= row.ApplicationEndDate)
                throw new ConflictException("OVERLAPPING_PERIOD", "فترة التقديم متداخلة مع صف آخر", YearToJson(row));
        }
    }

    private async Task<string?> ResolveGradingModeAsync(string categorySpecializationId, CancellationToken ct)
    {
        var lookups = await LoadLookupsAsync(ct);
        var specs = await db.ApplicationSettingsCategorySpecializations.AsNoTracking().ToListAsync(ct);
        var configs = await db.ApplicationSettingsCategoryConfigs.AsNoTracking().ToListAsync(ct);
        return ResolveGradingMode(categorySpecializationId, specs, configs, lookups);
    }

    private static string? ResolveGradingMode(string categorySpecializationId, IReadOnlyList<ApplicationSettingsCategorySpecializationEntity> specs, IReadOnlyList<ApplicationSettingsCategoryConfigEntity> configs, LookupSnapshot lookups)
    {
        var spec = specs.FirstOrDefault(x => x.Id == categorySpecializationId);
        if (spec is null) return null;
        var config = configs.FirstOrDefault(x => x.Id == spec.ConfigId);
        if (config is null) return null;
        var category = Lookup(lookups.Categories, config.CategoryId);
        var metadata = category?["metadata"] as JsonObject;
        var submissionTypeCode = StringProp(metadata, "submissionTypeCode");
        if (submissionTypeCode is null) return null;
        var submissionType = Lookup(lookups.SubmissionTypes, submissionTypeCode);
        var submissionMetadata = submissionType?["metadata"] as JsonObject;
        var mode = StringProp(submissionMetadata, "gradingMode");
        return mode is "GRADES" or "TAGDIR" ? mode : null;
    }

    private async Task<LookupSnapshot> LoadLookupsAsync(CancellationToken ct)
    {
        var rows = await db.LookupRows.AsNoTracking()
            .Where(x => x.LookupKey == "applicant-categories" || x.LookupKey == "specializations" || x.LookupKey == "submission-types")
            .ToListAsync(ct);
        return new LookupSnapshot(
            rows.Where(x => x.LookupKey == "applicant-categories").Select(LookupToJson).ToList(),
            rows.Where(x => x.LookupKey == "specializations").Select(LookupToJson).ToList(),
            rows.Where(x => x.LookupKey == "submission-types").Select(LookupToJson).ToList());
    }

    private async Task<IReadOnlyList<ApplicationSettingsCategoryConfigEntity>> EnsureCategoryConfigsForLookupCategoriesAsync(
        LookupSnapshot lookups,
        CancellationToken ct)
    {
        var configs = await db.ApplicationSettingsCategoryConfigs
            .OrderBy(x => x.SortOrder)
            .ToListAsync(ct);
        var knownCategoryIds = configs
            .Select(x => x.CategoryId)
            .ToHashSet(StringComparer.Ordinal);
        var activeCategories = lookups.Categories
            .Where(x => BoolProp(x, "isActive") != false)
            .OrderBy(x => StringProp(x, "code"))
            .ToList();
        var maxSerial = MaxNumericSuffix(configs.Select(x => x.Id));
        var nextSortOrder = configs.Count == 0 ? 1 : configs.Max(x => x.SortOrder) + 1;
        var now = DateTimeOffset.UtcNow;
        var added = false;

        foreach (var category in activeCategories)
        {
            var code = StringProp(category, "code");
            if (string.IsNullOrWhiteSpace(code) || knownCategoryIds.Contains(code)) continue;
            var entity = new ApplicationSettingsCategoryConfigEntity
            {
                Id = $"acc-{++maxSerial}",
                CategoryId = code,
                IsActive = true,
                SortOrder = nextSortOrder++,
                CreatedAt = now,
                UpdatedAt = now
            };
            db.ApplicationSettingsCategoryConfigs.Add(entity);
            configs.Add(entity);
            knownCategoryIds.Add(code);
            added = true;
            AddAudit("create", "application_settings_category_config", entity.Id, new
            {
                categoryId = code,
                source = "lookup:applicant-categories"
            });
        }

        if (added) await db.SaveChangesAsync(ct);
        return configs.OrderBy(x => x.SortOrder).ToList();
    }

    private static JsonObject JoinConfig(ApplicationSettingsCategoryConfigEntity config, IReadOnlyList<ApplicationSettingsCategorySpecializationEntity> specs, IReadOnlyList<ApplicationSettingsGraduationYearEntity> years, LookupSnapshot lookups)
    {
        var category = Lookup(lookups.Categories, config.CategoryId);
        var childSpecs = specs.Where(x => x.ConfigId == config.Id).ToList();
        var childIds = childSpecs.Select(x => x.Id).ToHashSet(StringComparer.Ordinal);
        var implicitSpec = childSpecs.FirstOrDefault(x => x.SpecializationId == ImplicitDefaultSpecCode);
        var realSpecs = childSpecs.Where(x => x.SpecializationId != ImplicitDefaultSpecCode).ToList();
        var singleAxis = implicitSpec is not null && realSpecs.Count == 0;

        return new JsonObject
        {
            ["id"] = config.Id,
            ["categoryId"] = config.CategoryId,
            ["isActive"] = config.IsActive,
            ["sortOrder"] = config.SortOrder,
            ["createdAt"] = config.CreatedAt,
            ["updatedAt"] = config.UpdatedAt,
            ["categoryCode"] = config.CategoryId,
            ["categoryNameAr"] = StringProp(category, "name") ?? config.CategoryId,
            ["categoryType"] = StringProp(category, "type") ?? "university",
            ["categoryFacultyCodes"] = ToJsonArray(StringArray(category?["facultyCodes"])),
            ["categorySpecializationCodes"] = ToJsonArray(StringArray(category?["specializationCodes"])),
            ["lockedGender"] = LockedGender(category),
            ["singleAxis"] = singleAxis,
            ["implicitSpecId"] = singleAxis ? implicitSpec?.Id : null,
            ["specializationCount"] = realSpecs.Count,
            ["yearCount"] = years.Count(x => childIds.Contains(x.CategorySpecializationId)),
            ["excellenceCriterion"] = ToJsonArray(StringArray(category?["excellenceCriterion"]))
        };
    }

    private static JsonObject JoinSpec(ApplicationSettingsCategorySpecializationEntity spec, IReadOnlyList<ApplicationSettingsGraduationYearEntity> years, LookupSnapshot lookups)
    {
        var lookup = Lookup(lookups.Specializations, spec.SpecializationId);
        return new JsonObject
        {
            ["id"] = spec.Id,
            ["configId"] = spec.ConfigId,
            ["specializationId"] = spec.SpecializationId,
            ["isActive"] = spec.IsActive,
            ["specializationNameAr"] = StringProp(lookup, "name") ?? spec.SpecializationId,
            ["yearCount"] = years.Count(x => x.CategorySpecializationId == spec.Id)
        };
    }

    private static JsonObject YearToJson(ApplicationSettingsGraduationYearEntity year)
    {
        var obj = new JsonObject
        {
            ["id"] = year.Id,
            ["categorySpecializationId"] = year.CategorySpecializationId,
            ["graduationYears"] = ToJsonArray(IntArray(year.GraduationYearsJson)),
            ["genderTypes"] = ToJsonArray(StringArray(year.GenderTypesJson)),
            ["maritalStatusCodes"] = ToJsonArray(StringArray(year.MaritalStatusCodesJson)),
            ["ageMin"] = year.AgeMin,
            ["maxAge"] = year.MaxAge,
            ["divisionCodes"] = ToJsonArray(StringArray(year.DivisionCodesJson)),
            ["schoolCategoryCodes"] = ToJsonArray(StringArray(year.SchoolCategoryCodesJson)),
            ["applicationStartDate"] = year.ApplicationStartDate.ToString("yyyy-MM-dd"),
            ["applicationEndDate"] = year.ApplicationEndDate.ToString("yyyy-MM-dd"),
            ["ageReferenceDate"] = year.AgeReferenceDate.ToString("yyyy-MM-dd"),
            ["isActive"] = year.IsActive,
            ["gradeKind"] = year.GradeKind
        };
        if (year.GradeKind == "TAGDIR") obj["academicGradeId"] = year.AcademicGradeId;
        else obj["minPercentage"] = year.MinPercentage;
        return obj;
    }

    private static ApplicationSettingsGraduationYearEntity JsonToYear(JsonObject obj)
    {
        var gradeKind = StringProp(obj, "gradeKind") ?? "GRADES";
        return new ApplicationSettingsGraduationYearEntity
        {
            Id = StringProp(obj, "id") ?? "",
            CategorySpecializationId = StringProp(obj, "categorySpecializationId") ?? throw new ConflictException("VALIDATION_FAILED", "categorySpecializationId مطلوب"),
            GraduationYearsJson = Serialize(IntArray(obj["graduationYears"])),
            GenderTypesJson = Serialize(StringArray(obj["genderTypes"])),
            MaritalStatusCodesJson = Serialize(StringArray(obj["maritalStatusCodes"])),
            AgeMin = IntProp(obj, "ageMin"),
            MaxAge = IntProp(obj, "maxAge"),
            DivisionCodesJson = Serialize(StringArray(obj["divisionCodes"])),
            SchoolCategoryCodesJson = Serialize(StringArray(obj["schoolCategoryCodes"])),
            ApplicationStartDate = ParseDate(StringProp(obj, "applicationStartDate")),
            ApplicationEndDate = ParseDate(StringProp(obj, "applicationEndDate")),
            AgeReferenceDate = ParseDate(StringProp(obj, "ageReferenceDate")),
            IsActive = BoolProp(obj, "isActive") ?? true,
            GradeKind = gradeKind,
            MinPercentage = gradeKind == "GRADES" ? DecimalProp(obj, "minPercentage") : null,
            AcademicGradeId = gradeKind == "TAGDIR" ? StringProp(obj, "academicGradeId") : null,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
    }

    private static ApplicationSettingsGraduationYearEntity CloneYear(ApplicationSettingsGraduationYearEntity source) => new()
    {
        Id = source.Id,
        CategorySpecializationId = source.CategorySpecializationId,
        GraduationYearsJson = source.GraduationYearsJson,
        GenderTypesJson = source.GenderTypesJson,
        MaritalStatusCodesJson = source.MaritalStatusCodesJson,
        AgeMin = source.AgeMin,
        MaxAge = source.MaxAge,
        DivisionCodesJson = source.DivisionCodesJson,
        SchoolCategoryCodesJson = source.SchoolCategoryCodesJson,
        ApplicationStartDate = source.ApplicationStartDate,
        ApplicationEndDate = source.ApplicationEndDate,
        AgeReferenceDate = source.AgeReferenceDate,
        IsActive = source.IsActive,
        GradeKind = source.GradeKind,
        MinPercentage = source.MinPercentage,
        AcademicGradeId = source.AcademicGradeId,
        CreatedAt = source.CreatedAt,
        UpdatedAt = source.UpdatedAt,
        RowVersion = source.RowVersion
    };

    private void AddAudit(string action, string entity, string entityId, object details)
    {
        var now = DateTimeOffset.UtcNow;
        db.AuditRows.Add(new AuditRowEntity
        {
            Id = $"aud-app-settings-{Guid.NewGuid():N}",
            Module = "admissions",
            Action = action,
            Entity = entity,
            EntityId = entityId,
            ActorUserId = "system",
            ActorName = "النظام",
            Details = JsonSerializer.Serialize(details, JsonOptions),
            CreatedAt = now,
            UpdatedAt = now
        });
    }

    private static int MaxGraduationYear(ApplicationSettingsGraduationYearEntity year)
    {
        var values = IntArray(year.GraduationYearsJson);
        return values.Count == 0 ? 0 : values.Max();
    }

    private static JsonObject Lookup(IEnumerable<JsonObject> rows, string code) =>
        rows.FirstOrDefault(x => StringProp(x, "code") == code) ?? [];

    private static JsonObject? Lookup(IReadOnlyList<JsonObject> rows, string code) =>
        rows.FirstOrDefault(x => StringProp(x, "code") == code);

    private static JsonObject LookupToJson(LookupRowEntity entity)
    {
        var obj = JsonNode.Parse(entity.PayloadJson)?.AsObject() ?? [];
        obj["code"] = entity.Code;
        obj["name"] = entity.Name;
        obj["isActive"] = entity.IsActive;
        return obj;
    }

    private static string? LockedGender(JsonObject? category)
    {
        var genders = StringArray(category?["genderScope"]);
        return genders.Count == 1 ? genders[0] : null;
    }

    private static bool IsSpecializationAllowedForCategory(JsonObject specialization, JsonObject? category)
    {
        if (category is null) return false;

        var specializationCodes = StringArray(category["specializationCodes"]);
        var specializationCode = StringProp(specialization, "code");
        if (specializationCodes.Count > 0)
        {
            return specializationCode is not null &&
                specializationCodes.Contains(specializationCode, StringComparer.Ordinal);
        }

        var facultyCodes = StringArray(category["facultyCodes"]);
        if (facultyCodes.Count == 0) return true;

        var facultyCode = StringProp(specialization, "facultyCode");
        return facultyCode is not null &&
            facultyCodes.Contains(facultyCode, StringComparer.Ordinal);
    }

    private static bool Overlaps<T>(IEnumerable<T> a, IReadOnlyCollection<T> b) => a.Any(b.Contains);

    private static JsonArray ToJsonArray(IEnumerable<string> values) => new(values.Select(x => (JsonNode)JsonValue.Create(x)!).ToArray());
    private static JsonArray ToJsonArray(IEnumerable<int> values) => new(values.Select(x => (JsonNode)JsonValue.Create(x)!).ToArray());
    private static string Serialize<T>(IEnumerable<T> values) => JsonSerializer.Serialize(values, JsonOptions);

    private static IReadOnlyList<string> StringArray(JsonNode? node)
    {
        if (node is null) return [];
        return node.Deserialize<List<string>>(JsonOptions) ?? [];
    }

    private static IReadOnlyList<string> StringArray(string json) =>
        JsonSerializer.Deserialize<List<string>>(json, JsonOptions) ?? [];

    private static IReadOnlyList<int> IntArray(JsonNode? node)
    {
        if (node is null) return [];
        return node.Deserialize<List<int>>(JsonOptions) ?? [];
    }

    private static IReadOnlyList<int> IntArray(string json) =>
        JsonSerializer.Deserialize<List<int>>(json, JsonOptions) ?? [];

    private static string? StringProp(JsonObject? obj, string name) =>
        obj is not null && obj.TryGetPropertyValue(name, out var node) ? node?.GetValue<string>() : null;

    private static bool? BoolProp(JsonObject obj, string name) =>
        obj.TryGetPropertyValue(name, out var node) ? node?.GetValue<bool>() : null;

    private static int? IntProp(JsonObject obj, string name) =>
        obj.TryGetPropertyValue(name, out var node) && node is not null ? node.GetValue<int?>() : null;

    private static decimal? DecimalProp(JsonObject obj, string name) =>
        obj.TryGetPropertyValue(name, out var node) && node is not null ? node.GetValue<decimal?>() : null;

    private static DateOnly ParseDate(string? value) =>
        DateOnly.TryParse(value, out var parsed) ? parsed : throw new ConflictException("INVALID_DATE_RANGE", "تاريخ غير صالح");

    private static async Task<string> NextIdAsync(string prefix, IQueryable<string> ids, CancellationToken ct)
    {
        var existing = await ids.ToListAsync(ct);
        var max = 0;
        foreach (var id in existing)
        {
            var dash = id.LastIndexOf('-');
            if (dash < 0) continue;
            if (int.TryParse(id[(dash + 1)..], out var serial) && serial > max) max = serial;
        }
        return $"{prefix}-{max + 1}";
    }

    private static int MaxNumericSuffix(IEnumerable<string> ids)
    {
        var max = 0;
        foreach (var id in ids)
        {
            var dash = id.LastIndexOf('-');
            if (dash < 0) continue;
            if (int.TryParse(id[(dash + 1)..], out var serial) && serial > max) max = serial;
        }
        return max;
    }

    private sealed record LookupSnapshot(IReadOnlyList<JsonObject> Categories, IReadOnlyList<JsonObject> Specializations, IReadOnlyList<JsonObject> SubmissionTypes);
}
