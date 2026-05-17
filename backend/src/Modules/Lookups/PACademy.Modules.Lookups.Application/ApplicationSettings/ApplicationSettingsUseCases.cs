using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Lookups.Domain;
using PACademy.Shared.Contracts;

namespace PACademy.Modules.Lookups.Application.ApplicationSettings;

/// <summary>
/// Application Settings (spec 011) — minimal-CRUD use cases with
/// app-layer conflict validation. No DB triggers; conflict codes
/// (DUPLICATE_YEAR, OVERLAPPING_PERIOD, CATEGORY_HAS_ACTIVE_YEARS, …) are
/// thrown via <see cref="DomainConflictException"/> and surfaced as 422
/// by <c>GlobalExceptionMiddleware</c>.
/// </summary>
public sealed class ApplicationSettingsUseCases(ILookupsDbContext db)
{
    /* ── Category configs ───────────────────────────────────────────── */

    public async Task<IReadOnlyList<ApplicantCategoryConfigDto>> ListCategoryConfigsAsync(
        CancellationToken ct = default)
    {
        // Auto-seed: ensure every active applicant-category lookup row has a
        // config. Idempotent — only creates rows that don't exist yet.
        await EnsureSeededAsync(ct);

        var rows = await db.ApplicantCategoryConfigs
            .OrderBy(c => c.SortOrder).ThenBy(c => c.CreatedAt)
            .ToListAsync(ct);
        return rows.Select(AppSettingsMapper.ToDto).ToList();
    }

    public async Task<ApplicantCategoryConfigDto?> PatchCategoryConfigAsync(
        Guid id, PatchCategoryConfigRequest request, CancellationToken ct = default)
    {
        var row = await db.ApplicantCategoryConfigs.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (row is null) return null;

        var now = DateTimeOffset.UtcNow;

        if (request.IsActive.HasValue && request.IsActive.Value != row.IsActive)
        {
            // Guard CATEGORY_HAS_ACTIVE_YEARS when flipping to false.
            if (!request.IsActive.Value)
            {
                var specIds = await db.ApplicantCategorySpecializations
                    .Where(s => s.ConfigId == row.Id)
                    .Select(s => s.Id)
                    .ToListAsync(ct);
                if (specIds.Count > 0)
                {
                    var hasActiveYears = await db.ApplicantSpecializationYears
                        .AnyAsync(y => specIds.Contains(y.CategorySpecializationId) && y.IsActive, ct);
                    if (hasActiveYears)
                        throw new DomainConflictException(
                            "لا يمكن إيقاف الفئة قبل إيقاف السنوات النشطة",
                            "CATEGORY_HAS_ACTIVE_YEARS");
                }
            }
            row.SetActive(request.IsActive.Value, now);
        }

        if (request.SortOrder.HasValue)
            row.UpdateSortOrder(request.SortOrder.Value, now);

        await db.SaveChangesAsync(ct);
        return AppSettingsMapper.ToDto(row);
    }

    /* ── Specialization junctions ───────────────────────────────────── */

    public async Task<IReadOnlyList<ApplicantCategorySpecializationDto>> ListSpecializationsAsync(
        Guid configId, CancellationToken ct = default)
    {
        var rows = await db.ApplicantCategorySpecializations
            .Where(s => s.ConfigId == configId)
            .OrderBy(s => s.CreatedAt)
            .ToListAsync(ct);
        return rows.Select(AppSettingsMapper.ToDto).ToList();
    }

    public async Task<ApplicantCategorySpecializationDto> AttachSpecializationAsync(
        Guid configId, string specializationId, CancellationToken ct = default)
    {
        var config = await db.ApplicantCategoryConfigs.FirstOrDefaultAsync(c => c.Id == configId, ct)
            ?? throw new DomainConflictException("الفئة غير موجودة", "UNKNOWN_CATEGORY");

        var existing = await db.ApplicantCategorySpecializations
            .FirstOrDefaultAsync(s => s.ConfigId == configId && s.SpecializationId == specializationId, ct);
        if (existing is not null)
            return AppSettingsMapper.ToDto(existing);

        var row = ApplicantCategorySpecialization.Create(
            Guid.NewGuid(), configId, specializationId, DateTimeOffset.UtcNow);
        db.ApplicantCategorySpecializations.Add(row);
        await db.SaveChangesAsync(ct);
        return AppSettingsMapper.ToDto(row);
    }

    public async Task<bool> DetachSpecializationAsync(Guid id, CancellationToken ct = default)
    {
        var row = await db.ApplicantCategorySpecializations.FirstOrDefaultAsync(s => s.Id == id, ct);
        if (row is null) return false;
        // Cascade FK will sweep descendant years.
        db.ApplicantCategorySpecializations.Remove(row);
        await db.SaveChangesAsync(ct);
        return true;
    }

    /* ── Years ──────────────────────────────────────────────────────── */

    public async Task<IReadOnlyList<ApplicantSpecializationYearDto>> ListYearsAsync(
        Guid categorySpecializationId, CancellationToken ct = default)
    {
        var rows = await db.ApplicantSpecializationYears
            .Where(y => y.CategorySpecializationId == categorySpecializationId)
            .ToListAsync(ct);
        // Sort by max graduation year DESC (mirrors frontend mock).
        return rows
            .Select(AppSettingsMapper.ToDto)
            .OrderByDescending(d => d.GraduationYears.Count > 0 ? d.GraduationYears.Max() : 0)
            .ToList();
    }

    public async Task<ApplicantSpecializationYearDto> CreateYearAsync(
        Guid categorySpecializationId, YearRowPayload row, CancellationToken ct = default)
    {
        var parent = await db.ApplicantCategorySpecializations
            .FirstOrDefaultAsync(s => s.Id == categorySpecializationId, ct)
            ?? throw new DomainConflictException("التخصص غير موجود", "UNKNOWN_SPECIALIZATION");

        AppSettingsValidation.ValidatePayload(row);

        var siblings = await db.ApplicantSpecializationYears
            .Where(y => y.CategorySpecializationId == categorySpecializationId)
            .ToListAsync(ct);
        AppSettingsValidation.ValidateAgainstSiblings(row, siblings, excludeId: null);

        var now = DateTimeOffset.UtcNow;
        var entity = ApplicantSpecializationYear.Create(
            Guid.NewGuid(),
            categorySpecializationId,
            AppSettingsValidation.SerializeInts(row.GraduationYears),
            AppSettingsValidation.SerializeStrings(row.GenderTypes),
            AppSettingsValidation.SerializeStrings(row.MaritalStatusCodes),
            AppSettingsValidation.SerializeStrings(row.DivisionCodes),
            AppSettingsValidation.SerializeStrings(row.SchoolCategoryCodes),
            row.AgeMin,
            row.MaxAge,
            DateOnly.Parse(row.ApplicationStartDate),
            DateOnly.Parse(row.ApplicationEndDate),
            DateOnly.Parse(row.AgeReferenceDate),
            row.IsActive,
            row.GradeKind,
            row.MinPercentage,
            row.AcademicGradeId,
            now);

        db.ApplicantSpecializationYears.Add(entity);
        await db.SaveChangesAsync(ct);
        return AppSettingsMapper.ToDto(entity);
    }

    public async Task<ApplicantSpecializationYearDto?> UpdateYearAsync(
        Guid id, UpdateYearRequest request, CancellationToken ct = default)
    {
        var row = await db.ApplicantSpecializationYears.FirstOrDefaultAsync(y => y.Id == id, ct);
        if (row is null) return null;

        var now = DateTimeOffset.UtcNow;

        if (request.Row is { } payload)
        {
            AppSettingsValidation.ValidatePayload(payload);
            var siblings = await db.ApplicantSpecializationYears
                .Where(y => y.CategorySpecializationId == row.CategorySpecializationId)
                .ToListAsync(ct);
            AppSettingsValidation.ValidateAgainstSiblings(payload, siblings, excludeId: id);

            row.Update(
                AppSettingsValidation.SerializeInts(payload.GraduationYears),
                AppSettingsValidation.SerializeStrings(payload.GenderTypes),
                AppSettingsValidation.SerializeStrings(payload.MaritalStatusCodes),
                AppSettingsValidation.SerializeStrings(payload.DivisionCodes),
                AppSettingsValidation.SerializeStrings(payload.SchoolCategoryCodes),
                payload.AgeMin,
                payload.MaxAge,
                DateOnly.Parse(payload.ApplicationStartDate),
                DateOnly.Parse(payload.ApplicationEndDate),
                DateOnly.Parse(payload.AgeReferenceDate),
                payload.IsActive,
                payload.GradeKind,
                payload.MinPercentage,
                payload.AcademicGradeId,
                now);
        }
        else if (request.IsActive.HasValue)
        {
            row.SetActive(request.IsActive.Value, now);
        }

        await db.SaveChangesAsync(ct);
        return AppSettingsMapper.ToDto(row);
    }

    public async Task<bool> DeleteYearAsync(Guid id, CancellationToken ct = default)
    {
        var row = await db.ApplicantSpecializationYears.FirstOrDefaultAsync(y => y.Id == id, ct);
        if (row is null) return false;
        db.ApplicantSpecializationYears.Remove(row);
        await db.SaveChangesAsync(ct);
        return true;
    }

    /* ── Bulk save ──────────────────────────────────────────────────── */

    public async Task<BulkSaveResult> BulkSaveAsync(
        IReadOnlyList<BulkYearChange> changes, CancellationToken ct = default)
    {
        if (changes is null || changes.Count == 0)
            return new BulkSaveResult(0, 0, 0);

        // Validate every non-delete change against the post-state of its
        // category-specialization sibling set before persisting any change.
        var byCs = changes.GroupBy(c => c.CategorySpecializationId).ToList();
        var now = DateTimeOffset.UtcNow;

        // Pre-load existing rows per group.
        var groupSiblings = new Dictionary<string, List<ApplicantSpecializationYear>>();
        foreach (var group in byCs)
        {
            if (!Guid.TryParse(group.Key, out var csId))
                throw new DomainConflictException("معرف التخصص غير صالح", "INVALID_OPERATION");
            var siblings = await db.ApplicantSpecializationYears
                .Where(y => y.CategorySpecializationId == csId)
                .ToListAsync(ct);
            groupSiblings[group.Key] = siblings;
        }

        // Build hypothetical post-states per group, then validate.
        foreach (var group in byCs)
        {
            var hypothetical = groupSiblings[group.Key].ToList();

            foreach (var change in group)
            {
                if (change.Kind == "delete")
                {
                    if (string.IsNullOrEmpty(change.Id) || !Guid.TryParse(change.Id, out var did)) continue;
                    hypothetical = hypothetical.Where(y => y.Id != did).ToList();
                }
                else if (change.Kind == "update")
                {
                    if (string.IsNullOrEmpty(change.Id) || !Guid.TryParse(change.Id, out var uid)) continue;
                    if (change.Row is null) continue;
                    var idx = hypothetical.FindIndex(y => y.Id == uid);
                    if (idx >= 0)
                    {
                        // Replace with a hypothetical reflecting the patch.
                        hypothetical[idx] = BuildHypothetical(
                            uid,
                            Guid.Parse(group.Key),
                            change.Row,
                            now);
                    }
                }
                else if (change.Kind == "create")
                {
                    if (change.Row is null) continue;
                    hypothetical.Add(BuildHypothetical(
                        Guid.NewGuid(),
                        Guid.Parse(group.Key),
                        change.Row,
                        now));
                }
            }

            // Validate each non-delete change's row vs. the post-state.
            foreach (var change in group)
            {
                if (change.Kind == "delete" || change.Row is null) continue;
                AppSettingsValidation.ValidatePayload(change.Row);

                var rowsExcludingSelf = hypothetical;
                if (change.Kind == "update" && Guid.TryParse(change.Id, out var uid))
                    rowsExcludingSelf = hypothetical.Where(y => y.Id != uid).ToList();
                AppSettingsValidation.ValidateAgainstSiblings(
                    change.Row,
                    rowsExcludingSelf,
                    excludeId: null);
            }
        }

        // Persist.
        int created = 0, updated = 0, deleted = 0;

        foreach (var change in changes)
        {
            switch (change.Kind)
            {
                case "delete":
                    if (Guid.TryParse(change.Id, out var did))
                    {
                        var existing = await db.ApplicantSpecializationYears
                            .FirstOrDefaultAsync(y => y.Id == did, ct);
                        if (existing is not null)
                        {
                            db.ApplicantSpecializationYears.Remove(existing);
                            deleted++;
                        }
                    }
                    break;

                case "update":
                    if (Guid.TryParse(change.Id, out var uid) && change.Row is not null)
                    {
                        var existing = await db.ApplicantSpecializationYears
                            .FirstOrDefaultAsync(y => y.Id == uid, ct);
                        if (existing is not null)
                        {
                            ApplyPayload(existing, change.Row, now);
                            updated++;
                        }
                    }
                    break;

                case "create":
                    if (change.Row is not null && Guid.TryParse(change.CategorySpecializationId, out var csId))
                    {
                        db.ApplicantSpecializationYears.Add(BuildHypothetical(
                            Guid.NewGuid(), csId, change.Row, now));
                        created++;
                    }
                    break;
            }
        }

        await db.SaveChangesAsync(ct);
        return new BulkSaveResult(created, updated, deleted);
    }

    /* ── Helpers ────────────────────────────────────────────────────── */

    private static ApplicantSpecializationYear BuildHypothetical(
        Guid id, Guid csId, YearRowPayload row, DateTimeOffset now)
        => ApplicantSpecializationYear.Create(
            id, csId,
            AppSettingsValidation.SerializeInts(row.GraduationYears),
            AppSettingsValidation.SerializeStrings(row.GenderTypes),
            AppSettingsValidation.SerializeStrings(row.MaritalStatusCodes),
            AppSettingsValidation.SerializeStrings(row.DivisionCodes),
            AppSettingsValidation.SerializeStrings(row.SchoolCategoryCodes),
            row.AgeMin, row.MaxAge,
            DateOnly.Parse(row.ApplicationStartDate),
            DateOnly.Parse(row.ApplicationEndDate),
            DateOnly.Parse(row.AgeReferenceDate),
            row.IsActive,
            row.GradeKind, row.MinPercentage, row.AcademicGradeId,
            now);

    private static void ApplyPayload(
        ApplicantSpecializationYear entity, YearRowPayload row, DateTimeOffset now)
        => entity.Update(
            AppSettingsValidation.SerializeInts(row.GraduationYears),
            AppSettingsValidation.SerializeStrings(row.GenderTypes),
            AppSettingsValidation.SerializeStrings(row.MaritalStatusCodes),
            AppSettingsValidation.SerializeStrings(row.DivisionCodes),
            AppSettingsValidation.SerializeStrings(row.SchoolCategoryCodes),
            row.AgeMin, row.MaxAge,
            DateOnly.Parse(row.ApplicationStartDate),
            DateOnly.Parse(row.ApplicationEndDate),
            DateOnly.Parse(row.AgeReferenceDate),
            row.IsActive,
            row.GradeKind, row.MinPercentage, row.AcademicGradeId,
            now);

    /// <summary>
    /// On first read, materialise one <see cref="ApplicantCategoryConfig"/>
    /// per active <c>applicant-categories</c> lookup row that doesn't
    /// already have a config. Idempotent. Keeps the page usable without
    /// requiring a separate seeding step.
    /// </summary>
    private async Task EnsureSeededAsync(CancellationToken ct)
    {
        var existing = await db.ApplicantCategoryConfigs.Select(c => c.CategoryId).ToListAsync(ct);
        var existingSet = new HashSet<string>(existing, StringComparer.OrdinalIgnoreCase);

        var lookupRows = await db.LookupItems
            .Where(i => i.LookupTypeCode == "APPLICANT_CATEGORIES" && i.DeletedAt == null && i.IsActive)
            .OrderBy(i => i.SortOrder).ThenBy(i => i.CreatedAt)
            .Select(i => new { i.Code, i.SortOrder })
            .ToListAsync(ct);

        if (lookupRows.Count == 0) return;

        var now = DateTimeOffset.UtcNow;
        var added = 0;
        foreach (var lk in lookupRows)
        {
            if (existingSet.Contains(lk.Code)) continue;
            db.ApplicantCategoryConfigs.Add(ApplicantCategoryConfig.Create(
                Guid.NewGuid(), lk.Code, lk.SortOrder, now));
            added++;
        }
        if (added > 0)
            await db.SaveChangesAsync(ct);
    }
}
