using System.Globalization;
using System.Text.Json.Nodes;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Modules.OperationalRecords;
using PACademy.Admin.Api.Modules.Settings;
using PACademy.Admin.Api.Persistence;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Modules.Admissions.Eligibility;

public sealed class ApplicantEligibilityService(
    AdminDbContext db,
    OperationalRecordsService? records = null,
    OperationalRecordStore? operationalRecords = null)
{
    private const int SqlInvalidColumnName = 207;
    private const int SqlInvalidObjectName = 208;

    public async Task<ApplicantEligibilityResponse> GetEligibleCategoriesAsync(
        string nationalId,
        CancellationToken ct,
        bool includeIneligible = false)
    {
        var nid = NationalIdParser.ParseEgyptianNationalId(nationalId);
        var snapshot = await LoadActiveSettingsSnapshotAsync(ct);
        var activeCycle = snapshot.ActiveCycle;
        var configs = snapshot.Configs;
        var specs = snapshot.Specs;
        var years = await LoadActiveYearsAsync(specs, ct);
        var lookupRows = snapshot.LookupRows;
        var categoryLookups = snapshot.CategoryLookups;
        var committeeLookups = snapshot.CommitteeLookups;
        var lookups = snapshot.Lookups;
        var examDateSettings = await LoadExamDateSettingsAsync(ct);
        var examSlotsByCommitteeKey = await LoadCommitteeExamSlotsAsync(activeCycle.Id, examDateSettings, ct);

        var grade = await LoadGradeAsync(nid.NationalId, ct);
        var firstReferenceDate = years.Select(x => (DateOnly?)x.AgeReferenceDate).OrderBy(x => x).FirstOrDefault()
            ?? DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var applicant = BuildApplicantContext(nid, grade, firstReferenceDate, lookups);
        var draftRules = await LoadCycleDraftRulesAsync(activeCycle.Id, configs, specs, categoryLookups, lookups.AcademicGrades, ct);
        var committeeIdsByRuleId = draftRules
            .Where(x => x.CommitteeIds.Count > 0)
            .ToDictionary(x => x.Rule.Id, x => x.CommitteeIds, StringComparer.OrdinalIgnoreCase);
        var academicProgramsByRuleId = draftRules
            .Where(x => x.AcademicPrograms.Count > 0)
            .ToDictionary(x => x.Rule.Id, x => x.AcademicPrograms, StringComparer.OrdinalIgnoreCase);
        var allYears = draftRules.Select(x => x.Rule).Concat(years).ToArray();

        var results = new List<CategoryEligibilityResult>();
        foreach (var config in configs)
        {
            var categoryRules = allYears
                .Where(year => specs.Any(spec => spec.ConfigId == config.Id && spec.Id == year.CategorySpecializationId))
                .ToArray();
            categoryLookups.TryGetValue(config.CategoryId, out var categoryLookup);
            categoryLookup ??= new JsonObject { ["code"] = config.CategoryId, ["name"] = config.CategoryId };
            var settings = new CategoryEligibilitySettings(
                config.CategoryId,
                EligibilityJson.StringProp(categoryLookup, "name") ?? config.CategoryId,
                categoryLookup,
                categoryRules,
                lookups.SchoolCategories);

            var evaluation = EvaluateCategory(applicant, settings, lookups);
            var checks = evaluation.Checks;
            var failedReasons = evaluation.FailedReasons;
            var committees = failedReasons.Count == 0
                ? ResolveCommittees(
                    committeeLookups,
                    settings.CategoryId,
                    settings.CategoryName,
                    evaluation.MatchedRuleId,
                    committeeIdsByRuleId,
                    examSlotsByCommitteeKey)
                : [];
            var academicPrograms = failedReasons.Count == 0
                ? ResolveAcademicPrograms(settings.CategoryName, evaluation.MatchedRuleIds, academicProgramsByRuleId)
                : [];
            var allowedMaritalStatusCodes = failedReasons.Count == 0
                ? ResolveAllowedMaritalStatusCodes(evaluation.MatchedRuleIds, categoryRules)
                : [];
            var allowedAcademicDegreeCodes = failedReasons.Count == 0
                ? ResolveAllowedAcademicDegreeCodes(evaluation.MatchedRuleIds, draftRules)
                : [];
            var allowedAcademicGradeCodes = failedReasons.Count == 0
                ? ResolveAllowedAcademicGradeCodes(evaluation.MatchedRuleIds, draftRules)
                : [];
            var allowedGraduationYears = failedReasons.Count == 0
                ? ResolveAllowedGraduationYears(evaluation.MatchedRuleIds, categoryRules)
                : [];
            results.Add(new CategoryEligibilityResult(
                settings.CategoryId,
                settings.CategoryName,
                failedReasons.Count == 0,
                evaluation.MatchedRule?.ApplicationStartDate,
                evaluation.MatchedRule?.ApplicationEndDate,
                evaluation.MatchedRule?.AgeReferenceDate,
                evaluation.MatchedRule?.MaxAge,
                checks,
                committees,
                academicPrograms,
                allowedMaritalStatusCodes,
                allowedAcademicDegreeCodes,
                allowedAcademicGradeCodes,
                allowedGraduationYears,
                failedReasons));
        }

        return new ApplicantEligibilityResponse(
            nid.NationalId,
            new ApplicantDerivedEligibility(
                nid.BirthDate,
                applicant.Age,
                nid.GenderAr,
                nid.GovernorateCode),
            BuildGradeResponse(grade, applicant.GradeSource),
            activeCycle.Id,
            includeIneligible ? results : results.Where(x => x.Eligible).ToArray());
    }

    private async Task<ActiveEligibilitySnapshot> LoadActiveSettingsSnapshotAsync(CancellationToken ct)
    {
        var activeCycle = await db.AdmissionCycles
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.IsActive, ct)
            ?? throw new EntityNotFoundException("لا توجد دورة قبول نشطة");

        var configs = await db.ApplicationSettingsCategoryConfigs
            .AsNoTracking()
            .Where(x => x.IsActive)
            .OrderBy(x => x.SortOrder)
            .ToListAsync(ct);
        var configIds = configs.Select(x => x.Id).ToArray();
        var specs = await db.ApplicationSettingsCategorySpecializations
            .AsNoTracking()
            .Where(x => x.IsActive && configIds.Contains(x.ConfigId))
            .ToListAsync(ct);

        var lookupRows = await db.LookupRows
            .AsNoTracking()
            .Where(x => x.IsActive && (x.LookupKey == "applicant-categories" || x.LookupKey == "school-categories" || x.LookupKey == "committees" || x.LookupKey == "academic-grades"))
            .OrderBy(x => x.LookupKey)
            .ThenBy(x => x.Code)
            .ToListAsync(ct);
        var categoryLookups = lookupRows
            .Where(x => x.LookupKey == "applicant-categories")
            .Select(LookupToJson)
            .ToDictionary(x => EligibilityJson.StringProp(x, "code") ?? "", StringComparer.OrdinalIgnoreCase);
        var committeeLookups = lookupRows
            .Where(x => x.LookupKey == "committees")
            .Select(LookupToJson)
            .ToArray();
        var lookups = new EligibilityLookupSnapshot(
            lookupRows.Where(x => x.LookupKey == "school-categories").Select(LookupToJson).ToArray(),
            lookupRows.Where(x => x.LookupKey == "academic-grades").Select(LookupToJson).ToArray());

        return new ActiveEligibilitySnapshot(
            activeCycle,
            configs,
            specs,
            lookupRows,
            categoryLookups,
            committeeLookups,
            lookups);
    }

    private async Task<IReadOnlyList<ApplicationSettingsGraduationYearEntity>> LoadActiveYearsAsync(
        IReadOnlyList<ApplicationSettingsCategorySpecializationEntity> specs,
        CancellationToken ct)
    {
        var specIds = specs.Select(x => x.Id).ToArray();
        return await db.ApplicationSettingsGraduationYears
            .AsNoTracking()
            .Where(x => x.IsActive && specIds.Contains(x.CategorySpecializationId))
            .ToListAsync(ct);
    }

    private async Task<JsonObject?> LoadGradeAsync(string nationalId, CancellationToken ct)
    {
        if (db.Database.IsSqlServer())
        {
            var parameter = new SqlParameter("@nid", nationalId);
#pragma warning disable EF1002
            string? payload;
            try
            {
                payload = await db.Database
                    .SqlQueryRaw<string>($"""
                        SELECT TOP(1)
                            (
                                SELECT
                                    CONVERT(nvarchar(36), [id]) AS [id],
                                    [admin_record_id] AS [adminRecordId],
                                    [seat],
                                    [nid],
                                    COALESCE([seating_number], CONVERT(nvarchar(32), [seat])) AS [seatingNumber],
                                    [name],
                                    [kind],
                                    [gender],
                                    [branch],
                                    [graduation_year] AS [graduationYear],
                                    [school_category_code] AS [schoolCategoryCode],
                                    [school],
                                    [region],
                                    [exam_round] AS [examRound],
                                    [total],
                                    [import_max] AS [importMax],
                                    [override_max] AS [overrideMax],
                                    JSON_VALUE([payload_json], '$.academicGradeId') AS [academicGradeId],
                                    JSON_VALUE([payload_json], '$.academicGrade') AS [academicGrade],
                                    JSON_VALUE([payload_json], '$.grade') AS [grade],
                                    JSON_VALUE([payload_json], '$.facultyCode') AS [facultyCode],
                                    JSON_VALUE([payload_json], '$.specializationCode') AS [specializationCode],
                                    [status],
                                    [last_edited_at] AS [lastEditedAt],
                                    [last_edited_by] AS [lastEditedBy],
                                    [grade_changed_at] AS [gradeChangedAt],
                                    [previous_grade] AS [previousGrade],
                                    [created_at] AS [createdAt],
                                    [updated_at] AS [updatedAt],
                                    sys.fn_varbintohexstr([row_version]) AS [rowVersion],
                                    JSON_QUERY([payload_json]) AS [payload]
                                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
                            ) AS [Value]
                        FROM {AdminDbContext.QualifiedTableName("applicant_grades")}
                        WHERE [nid] = @nid
                        ORDER BY [seat]
                        """, parameter)
                    .FirstOrDefaultAsync(ct);
            }
            catch (SqlException ex) when (HasSqlError(ex, SqlInvalidColumnName))
            {
                return await LoadGradeFromLegacyApplicantGradesAsync(nationalId, ct);
            }
            catch (SqlException ex) when (HasSqlError(ex, SqlInvalidObjectName))
            {
                return await LoadGradeFromAdminRecordsAsync(nationalId, ct);
            }
#pragma warning restore EF1002
            return payload is null ? null : MergeGradePayload(AdminRecordJson.Parse(payload));
        }

        return await LoadGradeFromAdminRecordsAsync(nationalId, ct);
    }

    private async Task<JsonObject?> LoadGradeFromLegacyApplicantGradesAsync(string nationalId, CancellationToken ct)
    {
        var parameter = new SqlParameter("@nid", nationalId);
#pragma warning disable EF1002
        try
        {
            var payload = await db.Database
                .SqlQueryRaw<string>($"""
                    SELECT TOP(1)
                        (
                            SELECT
                                CONVERT(nvarchar(36), [id]) AS [id],
                                [seat],
                                [nid],
                                COALESCE([seating_number], CONVERT(nvarchar(32), [seat])) AS [seatingNumber],
                                [name],
                                [kind],
                                [gender],
                                [branch],
                                [graduation_year] AS [graduationYear],
                                [school_category_code] AS [schoolCategoryCode],
                                [school],
                                [region],
                                [exam_round] AS [examRound],
                                [total],
                                [import_max] AS [importMax],
                                [override_max] AS [overrideMax],
                                [status],
                                [last_edited_at] AS [lastEditedAt],
                                [last_edited_by] AS [lastEditedBy],
                                [grade_changed_at] AS [gradeChangedAt],
                                [previous_grade] AS [previousGrade],
                                [created_at] AS [createdAt],
                                [updated_at] AS [updatedAt],
                                sys.fn_varbintohexstr([row_version]) AS [rowVersion]
                            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
                        ) AS [Value]
                    FROM {AdminDbContext.QualifiedTableName("applicant_grades")}
                    WHERE [nid] = @nid
                    ORDER BY [seat]
                    """, parameter)
                .FirstOrDefaultAsync(ct);
            return payload is null ? null : AdminRecordJson.Parse(payload);
        }
        catch (SqlException ex) when (HasSqlError(ex, SqlInvalidObjectName))
        {
            return await LoadGradeFromAdminRecordsAsync(nationalId, ct);
        }
#pragma warning restore EF1002
    }

    private static bool HasSqlError(SqlException ex, int number)
    {
        foreach (SqlError error in ex.Errors)
        {
            if (error.Number == number) return true;
        }

        return ex.Number == number;
    }

    private static JsonObject MergeGradePayload(JsonObject row)
    {
        var payload = EligibilityJson.ObjectProp(row, "payload");
        if (payload is null) return row;

        foreach (var field in payload)
        {
            if (row.ContainsKey(field.Key)) continue;
            row[field.Key] = field.Value is null
                ? null
                : JsonNode.Parse(field.Value.ToJsonString());
        }
        row.Remove("payload");

        return row;
    }

    private async Task<JsonObject?> LoadGradeFromAdminRecordsAsync(string nationalId, CancellationToken ct)
    {
        // By-NID seek — loading the full grades table per eligibility check
        // (~50k rows on staging) starved the instance under applicant traffic.
        var candidates = records is not null
            ? await records.ListGradesByNationalIdAsync(nationalId, ct)
            : (await Store().ListAsync("grades", ct))
                .Where(x => x.ToJsonString(AdminRecordJson.Options).Contains(nationalId, StringComparison.Ordinal))
                .ToList();
        return candidates
            .FirstOrDefault(x =>
                !AdminRecordJson.IsSoftDeleted(x) &&
                string.Equals(AdminRecordJson.StringProp(x, "nid") ?? AdminRecordJson.StringProp(x, "nationalId"), nationalId, StringComparison.Ordinal));
    }

    private async Task<ExamDateAvailabilitySettings> LoadExamDateSettingsAsync(CancellationToken ct)
    {
        var settings = await db.GeneralSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == GeneralSettingsEntity.SingletonId, ct);
        var defaults = settings ?? new GeneralSettingsEntity { Id = GeneralSettingsEntity.SingletonId };
        return new ExamDateAvailabilitySettings(
            Math.Max(1, defaults.ExamDaysPerApplicant),
            Math.Max(0, defaults.ExamSlotSelectionWindowDays));
    }

    private async Task<IReadOnlyDictionary<string, IReadOnlyList<EligibleCommitteeExamSlot>>> LoadCommitteeExamSlotsAsync(
        string cycleId,
        ExamDateAvailabilitySettings settings,
        CancellationToken ct)
    {
        var rows = records is not null
            ? await records.ListAsync("committeeInstances", ct)
            : await Store().ListAsync("committeeInstances", ct);

        return rows
            .Where(row => EligibilityJson.TextEquals(EligibilityJson.StringProp(row, "cycleId"), cycleId))
            .Select(ToCommitteeExamSlot)
            .Where(x => x is not null)
            .Select(x => x!)
            .GroupBy(
                x => CommitteeExamSlotKey(x.CategoryKey, x.DefinitionCode),
                StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                x => x.Key,
                x => (IReadOnlyList<EligibleCommitteeExamSlot>)ApplyExamDateSettings(
                    x
                    .OrderBy(slot => slot.Result.Date, StringComparer.Ordinal)
                    .ThenBy(slot => slot.Result.Id, StringComparer.Ordinal)
                    .Select(slot => slot.Result)
                    .ToArray(),
                    settings),
                StringComparer.OrdinalIgnoreCase);
    }

    private static IReadOnlyList<EligibleCommitteeExamSlot> ApplyExamDateSettings(
        IReadOnlyList<EligibleCommitteeExamSlot> slots,
        ExamDateAvailabilitySettings settings)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var firstSelectableDate = today.AddDays(settings.MinimumLeadDays);
        var allowedDates = slots
            .Select(slot => TryParseExamDate(slot.Date, out var date) ? date : (DateOnly?)null)
            .Where(date => date is not null && date >= today && date >= firstSelectableDate)
            .Select(date => date!.Value)
            .Distinct()
            .OrderBy(date => date)
            .Take(settings.ExamDaysPerApplicant)
            .ToHashSet();

        if (allowedDates.Count == 0) return [];

        return slots
            .Where(slot => TryParseExamDate(slot.Date, out var date) && allowedDates.Contains(date))
            .ToArray();
    }

    private static bool TryParseExamDate(string value, out DateOnly date)
    {
        var trimmed = value.Trim();
        var dateOnly = trimmed.Length >= 10 ? trimmed[..10] : trimmed;
        return DateOnly.TryParseExact(
            dateOnly,
            "yyyy-MM-dd",
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out date);
    }

    private async Task<IReadOnlyList<DraftEligibilityRule>> LoadCycleDraftRulesAsync(
        string cycleId,
        IReadOnlyList<ApplicationSettingsCategoryConfigEntity> configs,
        IReadOnlyList<ApplicationSettingsCategorySpecializationEntity> specs,
        IReadOnlyDictionary<string, JsonObject> categoryLookups,
        IReadOnlyList<JsonObject> academicGrades,
        CancellationToken ct)
    {
        var module = $"admissionSetup.applicationSettings.{cycleId}";
        JsonObject? draft;
        if (db.Database.IsSqlServer())
        {
            var parameter = new SqlParameter("@id", module);
#pragma warning disable EF1002
            string? payload;
            try
            {
                payload = await db.Database
                    .SqlQueryRaw<string>($"""
                        SELECT TOP(1) [payload_json] AS [Value]
                        FROM {AdminDbContext.QualifiedTableName("cycle_application_settings")}
                        WHERE [id] = @id
                        """, parameter)
                    .FirstOrDefaultAsync(ct);
            }
            catch (SqlException ex) when (HasSqlError(ex, SqlInvalidObjectName))
            {
                payload = await LoadCompatibilityDocumentPayloadAsync(module, ct);
            }
#pragma warning restore EF1002
            draft = payload is null ? null : AdminRecordJson.Parse(payload);
        }
        else
        {
            draft = await Store().GetAsync(module, module, ct);
        }
        if (draft is null) return [];

        var rows = new List<JsonObject>();
        AddRows(rows, EligibilityJson.ArrayProp(draft, "approved"));
        AddRows(rows, EligibilityJson.ArrayProp(draft, "local"));
        if (rows.Count == 0) return [];

        var configByCategory = configs.ToDictionary(x => x.CategoryId, StringComparer.OrdinalIgnoreCase);
        var specsByConfig = specs
            .GroupBy(x => x.ConfigId)
            .ToDictionary(x => x.Key, x => x.ToArray(), StringComparer.OrdinalIgnoreCase);
        var output = new List<DraftEligibilityRule>();
        foreach (var row in rows)
        {
            var categoryCode = EligibilityJson.StringProp(row, "categoryCode");
            if (string.IsNullOrWhiteSpace(categoryCode) || !configByCategory.TryGetValue(categoryCode, out var config)) continue;
            if (!specsByConfig.TryGetValue(config.Id, out var categorySpecs) || categorySpecs.Length == 0) continue;

            var spec = ResolveDraftSpec(row, categorySpecs);
            var header = EligibilityJson.ObjectProp(row, "header") ?? [];
            categoryLookups.TryGetValue(categoryCode, out var categoryLookup);
            var graduationYears = EligibilityJson.IntArray(row, "graduationYears");
            if (graduationYears.Count == 0 && EligibilityJson.IntProp(row, "graduationYear") is { } graduationYear)
            {
                graduationYears = [graduationYear];
            }

            var genders = EligibilityJson.StringArray(row, "type");
            if (genders.Count == 0)
            {
                genders = EligibilityJson.StringArray(categoryLookup, "genderScope");
            }

            var schoolCategoryCodes = EligibilityJson.StringArray(row, "schoolCategories");
            var scoreMin = EligibilityJson.DecimalProp(row, "scoreMin");
            var academicGradeId = EligibilityJson.FirstString(row, "grade", "academicGradeId");
            var gradeKind = string.IsNullOrWhiteSpace(academicGradeId) ? "GRADES" : "TAGDIR";

            output.Add(new DraftEligibilityRule(
                new ApplicationSettingsGraduationYearEntity
                {
                    Id = EligibilityJson.StringProp(row, "id") ?? $"draft-{output.Count + 1}",
                    CategorySpecializationId = spec.Id,
                    GraduationYearsJson = EligibilityJson.Serialize(graduationYears),
                    GenderTypesJson = EligibilityJson.Serialize(genders),
                    MaritalStatusCodesJson = EligibilityJson.Serialize(EligibilityJson.StringArray(header, "maritalStatus")),
                    AgeMin = EligibilityJson.IntProp(categoryLookup, "minAge") ?? 17,
                    MaxAge = EligibilityJson.IntProp(header, "maxAge"),
                    DivisionCodesJson = "[]",
                    SchoolCategoryCodesJson = EligibilityJson.Serialize(schoolCategoryCodes),
                    ApplicationStartDate = ParseDate(EligibilityJson.StringProp(header, "applicationStart")),
                    ApplicationEndDate = ParseDate(EligibilityJson.StringProp(header, "applicationEnd")),
                    AgeReferenceDate = ParseDate(EligibilityJson.StringProp(header, "ageReferenceDate")),
                    IsActive = true,
                    GradeKind = gradeKind,
                    MinPercentage = gradeKind == "GRADES" ? scoreMin : null,
                    AcademicGradeId = gradeKind == "TAGDIR" ? academicGradeId : null,
                    CreatedAt = DateTimeOffset.UtcNow,
                    UpdatedAt = DateTimeOffset.UtcNow
                },
                ResolveDraftCommitteeIds(row),
                ResolveDraftAcademicPrograms(row),
                EligibilityJson.StringArray(row, "academicDegrees"),
                ResolveDraftAcademicGradeCodes(row, academicGrades)));
        }

        return output;
    }

    private async Task<string?> LoadCompatibilityDocumentPayloadAsync(string module, CancellationToken ct)
    {
        if (records is not null)
        {
            var record = await records.SingletonAsync(module, [], ct);
            return record.Count == 0 ? null : record.ToJsonString(AdminRecordJson.Options);
        }

        try
        {
            var document = await Store().GetAsync(module, module, ct);
            return document?.ToJsonString(AdminRecordJson.Options);
        }
        catch (SqlException ex) when (HasSqlError(ex, SqlInvalidObjectName))
        {
            return null;
        }
    }

    private OperationalRecordStore Store() => operationalRecords ?? new OperationalRecordStore(db);

    private static ApplicantEligibilityContext BuildApplicantContext(
        EgyptianNationalIdInfo nid,
        JsonObject? grade,
        DateOnly referenceDate,
        EligibilityLookupSnapshot lookups)
    {
        var schoolCategoryCode = EligibilityJson.FirstString(grade, "schoolCategoryCode", "schoolCategory");
        var schoolCategory = EligibilityJson.FirstString(grade, "schoolCategoryName", "schoolCategory", "certificateTypeName", "kind");
        var certificateType = EligibilityJson.FirstString(grade, "certificateType", "certificateTypeName", "kind", "schoolCategory");
        var gradeSource = EligibilityJson.FirstString(grade, "gradesSource", "source", "مصدر الدرجات")
            ?? InferGradeSourceFromSchoolCategory(grade, schoolCategoryCode, schoolCategory, certificateType, lookups);
        var stage = EligibilityJson.FirstString(grade, "stage", "requiredStage", "gradeKind", "kind");
        var graduationYear = EligibilityJson.IntProp(grade, "graduationYear")
            ?? EligibilityJson.IntProp(grade, "year")
            ?? EligibilityJson.IntProp(grade, "سنة التخرج");
        var percentage = EligibilityJson.DecimalProp(grade, "percentage")
            ?? EligibilityJson.DecimalProp(grade, "effectivePercentage")
            ?? EligibilityJson.DecimalProp(grade, "percent")
            ?? CalculatePercentage(grade);
        var academicGradeId = EligibilityJson.FirstString(grade, "academicGradeId", "academicGrade", "grade", "tagdir", "التقدير");
        return new ApplicantEligibilityContext(
            nid,
            NationalIdParser.CalculateAge(nid.BirthDate, referenceDate),
            grade,
            schoolCategory,
            schoolCategoryCode,
            certificateType,
            gradeSource,
            graduationYear,
            percentage,
            academicGradeId,
            stage,
            nid.GovernorateCode);
    }

    private static string? InferGradeSourceFromSchoolCategory(
        JsonObject? grade,
        string? schoolCategoryCode,
        string? schoolCategory,
        string? certificateType,
        EligibilityLookupSnapshot lookups)
    {
        if (grade is null) return null;

        var matched = lookups.SchoolCategories.FirstOrDefault(lookup =>
        {
            var lookupCode = EligibilityJson.StringProp(lookup, "code");
            var lookupNames = new[]
            {
                EligibilityJson.StringProp(lookup, "name"),
                EligibilityJson.StringProp(lookup, "certificateType"),
                EligibilityJson.StringProp(lookup, "certificateTypeName"),
                EligibilityJson.StringProp(lookup, "نوع الشهادة"),
                lookupCode
            };
            var gradeNames = new[] { schoolCategoryCode, schoolCategory, certificateType };
            return lookupNames.Any(lookupValue =>
                gradeNames.Any(gradeValue => EligibilityJson.TextEquals(lookupValue, gradeValue)));
        });

        if (matched is null) return "استيراد خارجي";

        var explicitSource = EligibilityJson.FirstString(matched, "gradesSource", "source", "مصدر الدرجات");
        if (!string.IsNullOrWhiteSpace(explicitSource)) return explicitSource;

        if (EligibilityJson.BoolProp(matched, "externalGradesImport") is { } externalImport)
        {
            return externalImport ? "استيراد خارجي" : "إدخال يدوي";
        }

        return "استيراد خارجي";
    }

    private static JsonObject? BuildGradeResponse(JsonObject? grade, string? gradeSource)
    {
        if (grade is null) return null;

        var output = MergeGradePayload(EligibilityJson.Clone(grade));
        if (!string.IsNullOrWhiteSpace(gradeSource)
            && EligibilityJson.FirstString(output, "gradesSource", "source", "مصدر الدرجات") is null)
        {
            output["gradesSource"] = gradeSource;
        }

        return output;
    }

    private static CategoryEvaluation EvaluateCategory(
        ApplicantEligibilityContext applicant,
        CategoryEligibilitySettings category,
        EligibilityLookupSnapshot lookups)
    {
        if (category.Rules.Count == 0)
        {
            var checks = RunChecks(applicant, category, lookups);
            return new CategoryEvaluation(checks, null, [], null, ["لا توجد إعدادات قبول نشطة لهذه الفئة"]);
        }

        CategoryEvaluation? best = null;
        CategoryEvaluation? firstMatch = null;
        var matchingRuleIds = new List<string>();
        var validatesGrades = IsPreUniversityCategory(category.CategoryLookup) ||
            category.Rules.Any(rule => EligibilityJson.StringArray(rule.SchoolCategoryCodesJson).Count > 0);
        foreach (var rule in category.Rules)
        {
            var rowSettings = category with
            {
                Rules = [rule],
                RequiredSchoolCategoryCodes = EligibilityJson.StringArray(rule.SchoolCategoryCodesJson),
                RequiredGraduationYears = EligibilityJson.IntArray(rule.GraduationYearsJson),
                AllowedGenders = ResolveAllowedGenders(category.CategoryLookup, rule),
                MaxAge = rule.MaxAge,
                MinAge = rule.AgeMin ?? EligibilityJson.IntProp(category.CategoryLookup, "minAge") ?? 17,
                AgeReferenceDate = rule.AgeReferenceDate,
                MinPercentage = rule.MinPercentage,
                AcademicGradeId = rule.AcademicGradeId,
                ValidateGrades = validatesGrades,
                AllowsManualGradeEntryWithoutRecord = validatesGrades
            };
            var checks = RunChecks(applicant, rowSettings, lookups);
            var failedReasons = BuildFailedReasons(checks, rowSettings);
            var evaluation = new CategoryEvaluation(checks, rule.Id, [rule.Id], rule, failedReasons);
            if (failedReasons.Count == 0)
            {
                matchingRuleIds.Add(rule.Id);
                firstMatch ??= evaluation;
                continue;
            }

            if (best is null || CountPassed(checks) > CountPassed(best.Checks))
            {
                best = evaluation;
            }
        }

        if (matchingRuleIds.Count > 0)
        {
            return firstMatch! with { MatchedRuleIds = matchingRuleIds };
        }

        return best ?? new CategoryEvaluation(RunChecks(applicant, category, lookups), null, [], null, ["لا توجد إعدادات قبول نشطة لهذه الفئة"]);
    }

    private static IReadOnlyList<string> ResolveAllowedGenders(
        JsonObject categoryLookup,
        ApplicationSettingsGraduationYearEntity rule)
    {
        var categoryGenders = EligibilityJson.StringArray(categoryLookup, "genderScope");
        if (categoryGenders.Count == 0)
        {
            var conditionGender = EligibilityJson.FirstString(
                EligibilityJson.ObjectProp(categoryLookup, "conditions"),
                "gender");
            if (!string.IsNullOrWhiteSpace(conditionGender) &&
                !EligibilityJson.TextEquals(conditionGender, "any"))
            {
                categoryGenders = [conditionGender];
            }
        }

        var ruleGenders = EligibilityJson.StringArray(rule.GenderTypesJson);
        if (categoryGenders.Count == 0) return DistinctGenderValues(ruleGenders);
        if (ruleGenders.Count == 0) return DistinctGenderValues(categoryGenders);

        return DistinctGenderValues(ruleGenders
            .Where(ruleGender =>
                categoryGenders.Any(categoryGender =>
                    EligibilityJson.TextEquals(categoryGender, ruleGender))));
    }

    private static IReadOnlyList<string> DistinctGenderValues(IEnumerable<string> values) =>
        values
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

    private static EligibilityChecks RunChecks(
        ApplicantEligibilityContext applicant,
        CategoryEligibilitySettings settings,
        EligibilityLookupSnapshot lookups)
    {
        var age = (AgeCheckResult)EligibilityCheckRegistry.Checks["ageCheck"](applicant, settings, lookups);
        var gender = (GenderCheckResult)EligibilityCheckRegistry.Checks["genderCheck"](applicant, settings, lookups);
        var stage = (StageCheckResult)EligibilityCheckRegistry.Checks["stageCheck"](applicant, settings, lookups);
        var grades = (GradesCheckResult)EligibilityCheckRegistry.Checks["gradesCheck"](applicant, settings, lookups);
        return new EligibilityChecks(age, gender, stage, grades);
    }

    private static int CountPassed(EligibilityChecks checks)
    {
        var count = 0;
        if (checks.AgeCheck.Passed) count++;
        if (checks.GenderCheck.Passed) count++;
        if (checks.StageCheck.Passed) count++;
        if (checks.GradesCheck.Passed) count++;
        return count;
    }

    private static IReadOnlyList<EligibleCommitteeResult> ResolveCommittees(
        IReadOnlyList<JsonObject> committeeLookups,
        string categoryId,
        string categoryName,
        string? matchedRuleId,
        IReadOnlyDictionary<string, IReadOnlyList<string>> committeeIdsByRuleId,
        IReadOnlyDictionary<string, IReadOnlyList<EligibleCommitteeExamSlot>> examSlotsByCommitteeKey)
    {
        var allowedIds = matchedRuleId is not null && committeeIdsByRuleId.TryGetValue(matchedRuleId, out var ids)
            ? ids
            : [];
        return committeeLookups
            .Where(row => EligibilityJson.TextEquals(EligibilityJson.FirstString(row, "applicantCategoryId", "categoryId", "categoryCode"), categoryId))
            .Where(row => allowedIds.Count == 0 || allowedIds.Contains(EligibilityJson.StringProp(row, "code") ?? "", StringComparer.OrdinalIgnoreCase))
            .Select(row =>
            {
                var committeeId = EligibilityJson.StringProp(row, "code") ?? "";
                examSlotsByCommitteeKey.TryGetValue(CommitteeExamSlotKey(categoryId, committeeId), out var slots);
                slots ??= [];
                return new EligibleCommitteeResult(
                    committeeId,
                    EligibilityJson.StringProp(row, "name") ?? committeeId,
                    $"مطابق لإعدادات فئة {categoryName} واللجنة مربوطة بهذه الفئة",
                    slots.Select(x => x.Date).Distinct(StringComparer.Ordinal).ToArray(),
                    slots);
            })
            .Where(row => !string.IsNullOrWhiteSpace(row.CommitteeId))
            .ToArray();
    }

    private static CommitteeExamSlotCandidate? ToCommitteeExamSlot(JsonObject row)
    {
        var id = EligibilityJson.StringProp(row, "id");
        var categoryKey = EligibilityJson.StringProp(row, "categoryKey");
        var definitionCode = EligibilityJson.StringProp(row, "definitionCode");
        var date = EligibilityJson.StringProp(row, "date");
        if (
            string.IsNullOrWhiteSpace(id) ||
            string.IsNullOrWhiteSpace(categoryKey) ||
            string.IsNullOrWhiteSpace(definitionCode) ||
            string.IsNullOrWhiteSpace(date))
        {
            return null;
        }

        var capacity = EligibilityJson.IntProp(row, "capacity") ?? 0;
        var reserved = EligibilityJson.IntProp(row, "reserved") ?? 0;
        return new CommitteeExamSlotCandidate(
            categoryKey,
            definitionCode,
            new EligibleCommitteeExamSlot(id, date, capacity, reserved));
    }

    private static string CommitteeExamSlotKey(string categoryId, string committeeId) =>
        $"{categoryId}::{committeeId}";

    private static IReadOnlyList<EligibleAcademicProgramResult> ResolveAcademicPrograms(
        string categoryName,
        IReadOnlyList<string> matchedRuleIds,
        IReadOnlyDictionary<string, IReadOnlyList<EligibleAcademicProgramResult>> academicProgramsByRuleId)
    {
        if (matchedRuleIds.Count == 0)
        {
            return [];
        }

        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        return matchedRuleIds
            .SelectMany(ruleId =>
                academicProgramsByRuleId.TryGetValue(ruleId, out var programs)
                    ? programs
                    : [])
            .Where(program =>
            {
                var key = $"{program.FacultyCode}::{program.SpecializationCode}";
                return seen.Add(key);
            })
            .Select(program => program with
            {
                Reason = $"مطابق لإعدادات فئة {categoryName} لهذا التخصص"
            })
            .ToArray();
    }

    private static IReadOnlyList<string> ResolveAllowedMaritalStatusCodes(
        IReadOnlyList<string> matchedRuleIds,
        IReadOnlyList<ApplicationSettingsGraduationYearEntity> categoryRules)
    {
        if (matchedRuleIds.Count == 0) return [];
        var matched = new HashSet<string>(matchedRuleIds, StringComparer.OrdinalIgnoreCase);
        return categoryRules
            .Where(rule => matched.Contains(rule.Id))
            .SelectMany(rule => EligibilityJson.StringArray(rule.MaritalStatusCodesJson))
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    private static IReadOnlyList<string> ResolveAllowedAcademicDegreeCodes(
        IReadOnlyList<string> matchedRuleIds,
        IReadOnlyList<DraftEligibilityRule> draftRules)
    {
        if (matchedRuleIds.Count == 0) return [];
        var matched = new HashSet<string>(matchedRuleIds, StringComparer.OrdinalIgnoreCase);
        return draftRules
            .Where(rule => matched.Contains(rule.Rule.Id))
            .SelectMany(rule => rule.AcademicDegreeCodes)
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    private static IReadOnlyList<string> ResolveAllowedAcademicGradeCodes(
        IReadOnlyList<string> matchedRuleIds,
        IReadOnlyList<DraftEligibilityRule> draftRules)
    {
        if (matchedRuleIds.Count == 0) return [];
        var matched = new HashSet<string>(matchedRuleIds, StringComparer.OrdinalIgnoreCase);
        return draftRules
            .Where(rule => matched.Contains(rule.Rule.Id))
            .SelectMany(rule => rule.AcademicGradeCodes)
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    private static IReadOnlyList<int> ResolveAllowedGraduationYears(
        IReadOnlyList<string> matchedRuleIds,
        IReadOnlyList<ApplicationSettingsGraduationYearEntity> categoryRules)
    {
        if (matchedRuleIds.Count == 0) return [];
        var matched = new HashSet<string>(matchedRuleIds, StringComparer.OrdinalIgnoreCase);
        return categoryRules
            .Where(rule => matched.Contains(rule.Id))
            .SelectMany(rule => EligibilityJson.IntArray(rule.GraduationYearsJson))
            .Distinct()
            .OrderBy(year => year)
            .ToArray();
    }

    private static decimal? CalculatePercentage(JsonObject? grade)
    {
        var total = EligibilityJson.DecimalProp(grade, "effectiveTotal")
            ?? EligibilityJson.DecimalProp(grade, "total")
            ?? EligibilityJson.DecimalProp(grade, "totalGrade");
        var max = EligibilityJson.DecimalProp(grade, "max")
            ?? EligibilityJson.DecimalProp(grade, "maxGrade")
            ?? EligibilityJson.DecimalProp(grade, "importMax");
        if (total is null || max is null || max <= 0) return null;
        return Math.Round((total.Value / max.Value) * 100, 2);
    }

    private static void AddRows(List<JsonObject> target, JsonArray? rows)
    {
        if (rows is null) return;
        target.AddRange(rows.OfType<JsonObject>());
    }

    private static ApplicationSettingsCategorySpecializationEntity ResolveDraftSpec(
        JsonObject row,
        IReadOnlyList<ApplicationSettingsCategorySpecializationEntity> specs)
    {
        var specializationCode = EligibilityJson.StringProp(row, "specializationCode");
        if (!string.IsNullOrWhiteSpace(specializationCode))
        {
            var matched = specs.FirstOrDefault(x => EligibilityJson.TextEquals(x.SpecializationId, specializationCode));
            if (matched is not null) return matched;
        }

        return specs[0];
    }

    private static IReadOnlyList<string> ResolveDraftCommitteeIds(JsonObject row)
    {
        var ids = EligibilityJson.StringArray(row, "committees");
        if (ids.Count > 0) return ids;
        var committee = EligibilityJson.StringProp(row, "committee");
        return string.IsNullOrWhiteSpace(committee) ? [] : [committee];
    }

    private static IReadOnlyList<EligibleAcademicProgramResult> ResolveDraftAcademicPrograms(JsonObject row)
    {
        var facultyCode = EligibilityJson.StringProp(row, "facultyCode");
        var specializationCode = EligibilityJson.StringProp(row, "specializationCode");
        if (string.IsNullOrWhiteSpace(facultyCode) && string.IsNullOrWhiteSpace(specializationCode))
        {
            return [];
        }

        return
        [
            new EligibleAcademicProgramResult(
                facultyCode ?? "",
                EligibilityJson.StringProp(row, "facultyNameAr") ?? facultyCode ?? "",
                specializationCode ?? "",
                EligibilityJson.StringProp(row, "specializationNameAr") ?? specializationCode ?? "",
                "")
        ];
    }

    private static IReadOnlyList<string> ResolveDraftAcademicGradeCodes(
        JsonObject row,
        IReadOnlyList<JsonObject> academicGrades)
    {
        var minCode = EligibilityJson.FirstString(row, "grade", "academicGradeId");
        var maxCode = EligibilityJson.FirstString(row, "gradeMax", "academicGradeMaxId");
        var orderedCodes = academicGrades
            .Select(grade => EligibilityJson.StringProp(grade, "code"))
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Select(code => code!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        if (!string.IsNullOrWhiteSpace(minCode) && !string.IsNullOrWhiteSpace(maxCode))
        {
            var minIndex = Array.FindIndex(orderedCodes, code => EligibilityJson.TextEquals(code, minCode));
            var maxIndex = Array.FindIndex(orderedCodes, code => EligibilityJson.TextEquals(code, maxCode));
            if (minIndex >= 0 && maxIndex >= 0)
            {
                var start = Math.Min(minIndex, maxIndex);
                var count = Math.Abs(minIndex - maxIndex) + 1;
                return orderedCodes.Skip(start).Take(count).ToArray();
            }
        }

        return new[] { minCode, maxCode }
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Select(code => code!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    private static DateOnly ParseDate(string? value) =>
        DateOnly.TryParse(value, out var parsed) ? parsed : DateOnly.FromDateTime(DateTime.UtcNow.Date);

    private static bool IsPreUniversityCategory(JsonObject categoryLookup)
    {
        var type = EligibilityJson.FirstString(categoryLookup, "type", "categoryType", "stage", "مرحلة الالتحاق");
        return EligibilityJson.TextEquals(type, "pre_university") ||
            EligibilityJson.TextEquals(type, "ثانوي");
    }

    private static IReadOnlyList<string> BuildFailedReasons(EligibilityChecks checks, CategoryEligibilitySettings settings)
    {
        var reasons = new List<string>();
        if (!checks.AgeCheck.Passed)
        {
            reasons.Add("السن خارج النطاق المسموح لهذه الفئة");
        }

        if (!checks.GenderCheck.Passed)
        {
            reasons.Add("النوع لا يطابق إعدادات الفئة");
        }

        if (!checks.StageCheck.Passed)
        {
            reasons.Add("مرحلة الالتحاق لا تطابق إعدادات الفئة");
        }

        if (!checks.GradesCheck.Passed)
        {
            switch (checks.GradesCheck.FailureCode)
            {
                case GradesCheckFailureCodes.BelowMinimumPercentage:
                    reasons.Add("عذرًا، مجموع الثانوية العامة الخاص بك أقل من الحد الأدنى المطلوب للتقديم في هذه الدورة، لذلك لا يمكنك استكمال طلب التقديم.");
                    break;
                case GradesCheckFailureCodes.GraduationYearMismatch:
                    reasons.Add("سنة التخرج لا تطابق إعدادات الفئة");
                    break;
                case GradesCheckFailureCodes.AcademicGradeMismatch:
                    reasons.Add("التقدير لا يطابق الحد الأدنى المطلوب لهذه الفئة");
                    break;
                case GradesCheckFailureCodes.MissingGrade:
                    reasons.Add("لا يوجد سجل درجات مرتبط بهذا الرقم القومي");
                    break;
                default:
                    if (!checks.GradesCheck.HasGrade)
                    {
                        reasons.Add("لا يوجد سجل درجات مرتبط بهذا الرقم القومي");
                    }
                    else if (!string.IsNullOrWhiteSpace(settings.RequiredGradesSource))
                    {
                        reasons.Add($"فئة المدرسة لا تطابق مصدر الدرجات المطلوب ({settings.RequiredGradesSource})");
                    }
                    else
                    {
                        reasons.Add("فئة المدرسة لا تطابق إعدادات الفئة");
                    }
                    break;
            }
        }

        return reasons;
    }

    private sealed record CategoryEvaluation(
        EligibilityChecks Checks,
        string? MatchedRuleId,
        IReadOnlyList<string> MatchedRuleIds,
        ApplicationSettingsGraduationYearEntity? MatchedRule,
        IReadOnlyList<string> FailedReasons);

    private sealed record DraftEligibilityRule(
        ApplicationSettingsGraduationYearEntity Rule,
        IReadOnlyList<string> CommitteeIds,
        IReadOnlyList<EligibleAcademicProgramResult> AcademicPrograms,
        IReadOnlyList<string> AcademicDegreeCodes,
        IReadOnlyList<string> AcademicGradeCodes);

    private sealed record CommitteeExamSlotCandidate(
        string CategoryKey,
        string DefinitionCode,
        EligibleCommitteeExamSlot Result);

    private sealed record ExamDateAvailabilitySettings(
        int ExamDaysPerApplicant,
        int MinimumLeadDays);

    private sealed record ActiveEligibilitySnapshot(
        AdmissionCycleEntity ActiveCycle,
        IReadOnlyList<ApplicationSettingsCategoryConfigEntity> Configs,
        IReadOnlyList<ApplicationSettingsCategorySpecializationEntity> Specs,
        IReadOnlyList<Modules.Lookups.LookupRowEntity> LookupRows,
        IReadOnlyDictionary<string, JsonObject> CategoryLookups,
        IReadOnlyList<JsonObject> CommitteeLookups,
        EligibilityLookupSnapshot Lookups);

    private static JsonObject LookupToJson(Modules.Lookups.LookupRowEntity entity)
    {
        var obj = EligibilityJson.ParseObject(entity.PayloadJson);
        obj["code"] = entity.Code;
        obj["name"] = entity.Name;
        obj["isActive"] = entity.IsActive;
        return obj;
    }
}
