using System.Text.Json.Nodes;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Persistence;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Modules.Admissions.Eligibility;

public sealed class ApplicantEligibilityService(
    AdminDbContext db,
    AdminRecordsService? records = null)
{
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
        var examSlotsByCommitteeKey = await LoadCommitteeExamSlotsAsync(activeCycle.Id, ct);

        var grade = await LoadGradeAsync(nid.NationalId, ct);
        var firstReferenceDate = years.Select(x => (DateOnly?)x.AgeReferenceDate).OrderBy(x => x).FirstOrDefault()
            ?? DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var applicant = BuildApplicantContext(nid, grade, firstReferenceDate);
        var draftRules = await LoadCycleDraftRulesAsync(activeCycle.Id, configs, specs, categoryLookups, ct);
        var committeeIdsByRuleId = draftRules
            .Where(x => x.CommitteeIds.Count > 0)
            .ToDictionary(x => x.Rule.Id, x => x.CommitteeIds, StringComparer.OrdinalIgnoreCase);
        var academicProgramsByRuleId = draftRules
            .Where(x => x.AcademicPrograms.Count > 0)
            .ToDictionary(x => x.Rule.Id, x => x.AcademicPrograms, StringComparer.OrdinalIgnoreCase);
        var allYears = years.Concat(draftRules.Select(x => x.Rule)).ToArray();

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
                ? ResolveAcademicPrograms(settings.CategoryName, evaluation.MatchedRuleId, academicProgramsByRuleId)
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
                failedReasons));
        }

        return new ApplicantEligibilityResponse(
            nid.NationalId,
            new ApplicantDerivedEligibility(
                nid.BirthDate,
                applicant.Age,
                nid.GenderAr,
                nid.GovernorateCode),
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
            .Where(x => x.IsActive && (x.LookupKey == "applicant-categories" || x.LookupKey == "school-categories" || x.LookupKey == "committees"))
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
            lookupRows.Where(x => x.LookupKey == "school-categories").Select(LookupToJson).ToArray());

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
                        SELECT TOP(1) [payload_json] AS [Value]
                        FROM {AdminDbContext.QualifiedTableName("applicant_grades")}
                        WHERE [nid] = @nid
                        ORDER BY [seat]
                        """, parameter)
                    .FirstOrDefaultAsync(ct);
            }
            catch (SqlException ex) when (ex.Number == 208)
            {
                return await LoadGradeFromAdminRecordsAsync(nationalId, ct);
            }
#pragma warning restore EF1002
            return payload is null ? null : AdminRecordJson.Parse(payload);
        }

        return await LoadGradeFromAdminRecordsAsync(nationalId, ct);
    }

    private async Task<JsonObject?> LoadGradeFromAdminRecordsAsync(string nationalId, CancellationToken ct)
    {
        var candidates = records is not null
            ? await records.ListAsync("grades", ct)
            : (await db.AdminRecordDocuments
                .AsNoTracking()
                .Where(x => x.Module == "grades" && x.PayloadJson.Contains(nationalId))
                .OrderBy(x => x.Id)
                .ToListAsync(ct))
                .Select(x => AdminRecordJson.Parse(x.PayloadJson))
                .ToList();
        return candidates
            .FirstOrDefault(x =>
                !AdminRecordJson.IsSoftDeleted(x) &&
                string.Equals(AdminRecordJson.StringProp(x, "nid") ?? AdminRecordJson.StringProp(x, "nationalId"), nationalId, StringComparison.Ordinal));
    }

    private async Task<IReadOnlyDictionary<string, IReadOnlyList<EligibleCommitteeExamSlot>>> LoadCommitteeExamSlotsAsync(
        string cycleId,
        CancellationToken ct)
    {
        var rows = records is not null
            ? await records.ListAsync("committeeInstances", ct)
            : await db.AdminRecordDocuments
                .AsNoTracking()
                .Where(x => x.Module == "committeeInstances")
                .OrderBy(x => x.Id)
                .Select(x => EligibilityJson.ParseObject(x.PayloadJson))
                .ToListAsync(ct);

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
                x => (IReadOnlyList<EligibleCommitteeExamSlot>)x
                    .OrderBy(slot => slot.Result.Date, StringComparer.Ordinal)
                    .ThenBy(slot => slot.Result.Id, StringComparer.Ordinal)
                    .Select(slot => slot.Result)
                    .ToArray(),
                StringComparer.OrdinalIgnoreCase);
    }

    private async Task<IReadOnlyList<DraftEligibilityRule>> LoadCycleDraftRulesAsync(
        string cycleId,
        IReadOnlyList<ApplicationSettingsCategoryConfigEntity> configs,
        IReadOnlyList<ApplicationSettingsCategorySpecializationEntity> specs,
        IReadOnlyDictionary<string, JsonObject> categoryLookups,
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
            catch (SqlException ex) when (ex.Number == 208)
            {
                var record = await db.AdminRecordDocuments
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Module == module && x.Id == module, ct);
                payload = record?.PayloadJson;
            }
#pragma warning restore EF1002
            draft = payload is null ? null : AdminRecordJson.Parse(payload);
        }
        else
        {
            var record = await db.AdminRecordDocuments
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Module == module && x.Id == module, ct);
            draft = record is null ? null : AdminRecordJson.Parse(record.PayloadJson);
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
                ResolveDraftAcademicPrograms(row)));
        }

        return output;
    }

    private static ApplicantEligibilityContext BuildApplicantContext(
        EgyptianNationalIdInfo nid,
        JsonObject? grade,
        DateOnly referenceDate)
    {
        var schoolCategoryCode = EligibilityJson.FirstString(grade, "schoolCategoryCode", "schoolCategory");
        var schoolCategory = EligibilityJson.FirstString(grade, "schoolCategoryName", "schoolCategory", "certificateTypeName", "kind");
        var certificateType = EligibilityJson.FirstString(grade, "certificateType", "certificateTypeName", "kind", "schoolCategory");
        var gradeSource = EligibilityJson.FirstString(grade, "gradesSource", "source", "مصدر الدرجات");
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

    private static CategoryEvaluation EvaluateCategory(
        ApplicantEligibilityContext applicant,
        CategoryEligibilitySettings category,
        EligibilityLookupSnapshot lookups)
    {
        if (category.Rules.Count == 0)
        {
            var checks = RunChecks(applicant, category, lookups);
            return new CategoryEvaluation(checks, null, null, ["لا توجد إعدادات قبول نشطة لهذه الفئة"]);
        }

        CategoryEvaluation? best = null;
        foreach (var rule in category.Rules)
        {
            var rowSettings = category with
            {
                Rules = [rule],
                RequiredSchoolCategoryCodes = EligibilityJson.StringArray(rule.SchoolCategoryCodesJson),
                RequiredGraduationYears = EligibilityJson.IntArray(rule.GraduationYearsJson),
                AllowedGenders = EligibilityJson.StringArray(rule.GenderTypesJson),
                MaxAge = rule.MaxAge,
                MinAge = rule.AgeMin ?? EligibilityJson.IntProp(category.CategoryLookup, "minAge") ?? 17,
                AgeReferenceDate = rule.AgeReferenceDate,
                MinPercentage = rule.MinPercentage,
                AcademicGradeId = rule.AcademicGradeId,
                AllowsManualGradeEntryWithoutRecord = IsPreUniversityCategory(category.CategoryLookup)
            };
            var checks = RunChecks(applicant, rowSettings, lookups);
            var failedReasons = BuildFailedReasons(checks, rowSettings);
            var evaluation = new CategoryEvaluation(checks, rule.Id, rule, failedReasons);
            if (failedReasons.Count == 0)
            {
                return evaluation;
            }

            if (best is null || CountPassed(checks) > CountPassed(best.Checks))
            {
                best = evaluation;
            }
        }

        return best ?? new CategoryEvaluation(RunChecks(applicant, category, lookups), null, null, ["لا توجد إعدادات قبول نشطة لهذه الفئة"]);
    }

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
        string? matchedRuleId,
        IReadOnlyDictionary<string, IReadOnlyList<EligibleAcademicProgramResult>> academicProgramsByRuleId)
    {
        if (matchedRuleId is null || !academicProgramsByRuleId.TryGetValue(matchedRuleId, out var programs))
        {
            return [];
        }

        return programs
            .Select(program => program with
            {
                Reason = $"مطابق لإعدادات فئة {categoryName} لهذا التخصص"
            })
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
        }

        return reasons;
    }

    private sealed record CategoryEvaluation(
        EligibilityChecks Checks,
        string? MatchedRuleId,
        ApplicationSettingsGraduationYearEntity? MatchedRule,
        IReadOnlyList<string> FailedReasons);

    private sealed record DraftEligibilityRule(
        ApplicationSettingsGraduationYearEntity Rule,
        IReadOnlyList<string> CommitteeIds,
        IReadOnlyList<EligibleAcademicProgramResult> AcademicPrograms);

    private sealed record CommitteeExamSlotCandidate(
        string CategoryKey,
        string DefinitionCode,
        EligibleCommitteeExamSlot Result);

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
