using Microsoft.EntityFrameworkCore;
using PACademy.Shared.Domain.Grades;

namespace PACademy.Modules.ApplicantGradesAdmin.Application.Grades;

public sealed class StageImportUseCase(IApplicantGradesAdminDbContext db, IAuditApi audit)
{
    public async Task<StageImportResponse> ExecuteAsync(StageImportRequest request, CancellationToken ct = default)
    {
        var existing = await db.ApplicantGrades
            .AsNoTracking()
            .Include(x => x.Adjustments)
            .ToDictionaryAsync(x => x.Nid, ct);

        var duplicates = new List<ImportDuplicateRow>();
        var skipped = new List<ImportSkippedRow>();
        var validRows = new List<ImportedGradeRow>();

        for (var i = 0; i < request.Rows.Count; i++)
        {
            var row = request.Rows[i] with { Nid = GradeImportLogic.ToAsciiDigits(request.Rows[i].Nid) };
            if (row.Total > request.MaxDegree)
            {
                skipped.Add(new ImportSkippedRow(i, row.Nid, row.Name, row.Total, "المجموع أكبر من الدرجة العظمى", "TOTAL_EXCEEDS_MAX"));
                continue;
            }

            if (existing.TryGetValue(row.Nid, out var existingRow))
            {
                duplicates.Add(BuildDuplicate(i, row, existingRow));
                validRows.Add(row);
                continue;
            }

            validRows.Add(row);
        }

        var batch = GradeImportBatch.Create(
            request.Kind,
            null,
            "[]",
            "{}",
            request.Rows.Count,
            validRows.Count,
            skipped.Count);
        foreach (var (row, index) in request.Rows.Select((x, i) => (x, i)))
        {
            batch.AddRow(GradeImportRow.Create(index, GradeImportLogic.ToAsciiDigits(row.Nid), !skipped.Any(x => x.RowIndex == index), GradeImportLogic.Serialize(row), "[]"));
        }

        db.GradeImportBatches.Add(batch);
        await db.SaveChangesAsync(ct);
        await audit.RecordAsync("grade.import.stage", "applicant_grade", "system", batch.Id.ToString(), AuditOutcome.Success, "admin", ct);

        var newRows = validRows.Count(x => !existing.ContainsKey(x.Nid));
        return new StageImportResponse(true, batch.Id, new ImportStagedDto(newRows, duplicates, skipped));
    }

    private static ImportDuplicateRow BuildDuplicate(int index, ImportedGradeRow incoming, ApplicantGrade existing)
    {
        var changed = new List<ChangedFieldDto>();
        AddChanged(changed, "total", existing.Total.ToString(), incoming.Total.ToString());
        AddChanged(changed, "branch", existing.Branch, incoming.Branch);
        AddChanged(changed, "school", existing.School, incoming.School);
        AddChanged(changed, "region", existing.Region, incoming.Region);
        AddChanged(changed, "status", existing.Status, "—");
        AddChanged(changed, "seat", existing.Seat.ToString(), incoming.Seat.ToString());
        var activeAdjustments = existing.Adjustments.Where(x => x.IsActive).ToList();
        return new ImportDuplicateRow(index, incoming.Nid, incoming.Name, existing.Name, changed, activeAdjustments.Sum(x => x.Amount), activeAdjustments.Count);
    }

    private static void AddChanged(List<ChangedFieldDto> changed, string field, string existing, string incoming)
    {
        if (!string.Equals(existing, incoming, StringComparison.Ordinal))
            changed.Add(new ChangedFieldDto(field, existing, incoming));
    }
}

public sealed class CommitStagedImportUseCase(IApplicantGradesAdminDbContext db, IAuditApi audit)
{
    public async Task<CommitImportResponse> ExecuteAsync(CommitImportRequest request, CancellationToken ct = default)
    {
        var batch = await db.GradeImportBatches
            .Include(x => x.Rows)
            .FirstOrDefaultAsync(x => x.Id == request.BatchId, ct)
            ?? throw new KeyNotFoundException("دفعة الاستيراد غير موجودة.");

        var resolutions = request.Resolutions.ToDictionary(x => GradeImportLogic.ToAsciiDigits(x.Nid), x => x.Action);
        var existing = await db.ApplicantGrades
            .Include(x => x.Adjustments)
            .ToDictionaryAsync(x => x.Nid, ct);

        var inserted = 0;
        var updated = 0;
        var deactivated = new List<DeactivatedAdjustmentDto>();
        var nextSeat = existing.Count == 0 ? 1 : existing.Values.Max(x => x.Seat) + 1;

        foreach (var stagedRow in batch.Rows.Where(x => x.IsValid).OrderBy(x => x.SourceRowIndex))
        {
            var row = GradeImportLogic.Deserialize<ImportedGradeRow>(stagedRow.PayloadJson);
            if (row is null) continue;
            var nid = GradeImportLogic.ToAsciiDigits(row.Nid);

            if (existing.TryGetValue(nid, out var current))
            {
                if (!resolutions.TryGetValue(nid, out var action) || action != "accept") continue;
                var beforeActive = current.Adjustments.Where(x => x.IsActive).ToList();
                current.ReplaceFromImport(
                    row.SeatingNumber,
                    row.Name,
                    row.Kind,
                    row.Gender ?? "male",
                    row.Branch,
                    row.GraduationYear,
                    row.SchoolCategoryCode,
                    row.School,
                    row.Region,
                    row.ExamRound,
                    row.Total,
                    row.MaxGrade ?? current.ImportMax);

                var max = current.OverrideMax ?? current.ImportMax;
                var effective = current.Total + current.Adjustments.Where(x => x.IsActive).Sum(x => x.Amount);
                if (effective > max || effective < 0)
                {
                    current.DeactivateAdjustments();
                    deactivated.AddRange(beforeActive.Select(x => new DeactivatedAdjustmentDto(nid, x.Id, x.ReasonLabel, x.Amount)));
                }
                updated++;
                continue;
            }

            var entity = ApplicantGrade.Create(
                row.Seat > 0 ? row.Seat : nextSeat++,
                row.SeatingNumber,
                nid,
                row.Name,
                row.Kind,
                row.Gender ?? "male",
                row.Branch,
                row.GraduationYear,
                row.SchoolCategoryCode,
                row.School,
                row.Region,
                row.ExamRound,
                row.Total,
                row.MaxGrade ?? (row.Kind == "azhar" ? 510 : 410));
            db.ApplicantGrades.Add(entity);
            inserted++;
        }

        batch.MarkCommitted();
        await db.SaveChangesAsync(ct);
        await audit.RecordAsync("grade.import.commit", "applicant_grade", "system", batch.Id.ToString(), AuditOutcome.Success, "admin", ct);

        return new CommitImportResponse(true, inserted, updated, deactivated);
    }
}

public sealed class RunImportPreflightUseCase(IApplicantGradesAdminDbContext db)
{
    public async Task<ImportReport> ExecuteAsync(RunImportPreflightRequest request, CancellationToken ct = default)
    {
        var existingNids = await db.ApplicantGrades.AsNoTracking().Select(x => x.Nid).ToListAsync(ct);
        var buckets = new Dictionary<string, List<ImportIssueRow>>();

        foreach (var row in request.Rows)
        {
            var nid = GradeImportLogic.ToAsciiDigits(row.NationalId ?? "");
            var issue = GetIssue(row, nid, existingNids);
            if (issue is null) continue;
            if (!buckets.TryGetValue(issue, out var rows)) buckets[issue] = rows = [];
            rows.Add(new ImportIssueRow(row.SourceRowIndex, row.NationalId, row.NameAr, IssueMessage(issue)));
        }

        var groups = buckets.Select(kvp => new ImportIssueGroup(kvp.Key, IssueLabel(kvp.Key), kvp.Value, IssueActions(kvp.Key))).ToList();
        return new ImportReport(new ImportTotals(request.Rows.Count, request.Rows.Count - groups.Sum(x => x.Rows.Count), 0, groups.Sum(x => x.Rows.Count)), groups);
    }

    private static string? GetIssue(NormalisedRow row, string nid, IReadOnlyCollection<string> existing)
    {
        if (string.IsNullOrWhiteSpace(row.NationalId) || string.IsNullOrWhiteSpace(row.NameAr)) return "MISSING_REQUIRED";
        if (!GradeImportLogic.IsValidNationalId(nid)) return "INVALID_NID";
        if (!row.TotalGrade.HasValue) return "UNREADABLE_VALUE";
        if (row.TotalGrade.Value < 0 || (row.MaxGrade.HasValue && row.TotalGrade.Value > row.MaxGrade.Value)) return "GRADE_OUT_OF_RANGE";
        if (existing.Contains(nid)) return "DUPLICATE_NID";
        return null;
    }

    private static string IssueLabel(string code) => code switch
    {
        "DUPLICATE_NID" => "أرقام قومية مكررة",
        "INVALID_NID" => "أرقام قومية غير صالحة",
        "MISSING_REQUIRED" => "بيانات إلزامية ناقصة",
        "NID_NOT_FOUND" => "أرقام غير موجودة",
        "GRADE_OUT_OF_RANGE" => "درجات خارج النطاق",
        "UNREADABLE_VALUE" => "قيم غير قابلة للقراءة",
        _ => code,
    };

    private static string IssueMessage(string code) => IssueLabel(code);

    private static IReadOnlyList<string> IssueActions(string code) => code switch
    {
        "DUPLICATE_NID" => ["skip", "override", "export"],
        "NID_NOT_FOUND" => ["skip", "create-applicant", "export"],
        _ => ["skip", "export"],
    };
}

public sealed class RunImportCommitUseCase(IApplicantGradesAdminDbContext db, IAuditApi audit)
{
    public async Task<ImportCommitResult> ExecuteAsync(RunImportCommitRequest request, CancellationToken ct = default)
    {
        var rows = ResolveUploadDuplicates(request);
        var existing = await db.ApplicantGrades
            .Include(x => x.Adjustments)
            .ToDictionaryAsync(x => x.Nid, ct);
        var existingDecisions = (request.ExistingDiffDecisions ?? [])
            .ToDictionary(x => GradeImportLogic.ToAsciiDigits(x.NationalId), x => x.Action);

        var inserted = 0;
        var failed = 0;
        var already = 0;
        var nextSeat = existing.Count == 0 ? 1 : existing.Values.Max(x => x.Seat) + 1;

        foreach (var row in rows)
        {
            var nid = GradeImportLogic.ToAsciiDigits(row.NationalId ?? "");
            if (!IsCommitRowReadable(row, nid, request.SelectedSchoolCategories, out var categoryCode))
            {
                failed++;
                continue;
            }

            var max = GradeImportLogic.ResolveMax(categoryCode, row.MaxGrade, request.MaxGradeByCategory);
            if (row.TotalGrade!.Value < 0 || row.TotalGrade.Value > max)
            {
                failed++;
                continue;
            }

            if (existing.TryGetValue(nid, out var current))
            {
                if (current.GraduationYear.HasValue && current.GraduationYear == request.GraduationYear)
                {
                    already++;
                    continue;
                }

                var groupAction = request.PerGroupActions.TryGetValue("DUPLICATE_NID", out var a) ? a : "skip";
                var action = existingDecisions.TryGetValue(nid, out var perRow) ? perRow : groupAction;
                if (action == "skip")
                {
                    already++;
                    continue;
                }
                if (action != "override")
                {
                    failed++;
                    continue;
                }

                current.ReplaceFromImport(
                    row.SeatingNumber,
                    row.NameAr!,
                    GradeImportLogic.ResolveKind(categoryCode, row.Track),
                    string.IsNullOrWhiteSpace(row.Gender) ? "male" : row.Gender!,
                    row.Track ?? "—",
                    request.GraduationYear,
                    categoryCode,
                    row.SchoolName ?? current.School,
                    row.RegionName ?? current.Region,
                    row.ExamRound,
                    row.TotalGrade.Value,
                    max);
                continue;
            }

            var entity = ApplicantGrade.Create(
                nextSeat++,
                row.SeatingNumber,
                nid,
                row.NameAr!,
                GradeImportLogic.ResolveKind(categoryCode, row.Track),
                string.IsNullOrWhiteSpace(row.Gender) ? "male" : row.Gender!,
                row.Track ?? "—",
                request.GraduationYear,
                categoryCode,
                row.SchoolName ?? "—",
                row.RegionName ?? "—",
                row.ExamRound,
                row.TotalGrade.Value,
                max);
            db.ApplicantGrades.Add(entity);
            inserted++;
            existing[nid] = entity;
        }

        await db.SaveChangesAsync(ct);
        await audit.RecordAsync("grade.import.commit", "applicant_grade", "system", "v2", AuditOutcome.Success, "admin", ct);
        return new ImportCommitResult(inserted, failed, already);
    }

    private static IReadOnlyList<NormalisedRow> ResolveUploadDuplicates(RunImportCommitRequest request)
    {
        var decisions = (request.UploadDuplicateDecisions ?? [])
            .ToDictionary(x => GradeImportLogic.ToAsciiDigits(x.NationalId), x => x);
        var result = new List<NormalisedRow>();
        foreach (var group in request.Rows.GroupBy(x => GradeImportLogic.ToAsciiDigits(x.NationalId ?? "")))
        {
            var items = group.ToList();
            if (string.IsNullOrWhiteSpace(group.Key) || items.Count == 1)
            {
                result.Add(items[0]);
                continue;
            }

            if (decisions.TryGetValue(group.Key, out var decision))
            {
                if (decision.Action == "reject") continue;
                if (decision.Action == "pick-row" && decision.SourceRowIndex.HasValue)
                {
                    result.Add(items.FirstOrDefault(x => x.SourceRowIndex == decision.SourceRowIndex.Value) ?? items.OrderByDescending(x => x.TotalGrade ?? decimal.MinValue).First());
                    continue;
                }
            }
            result.Add(items.OrderByDescending(x => x.TotalGrade ?? decimal.MinValue).First());
        }
        return result;
    }

    private static bool IsCommitRowReadable(NormalisedRow row, string nid, IReadOnlyCollection<string> selected, out string? categoryCode)
    {
        categoryCode = GradeImportLogic.ResolveSchoolCategoryCode(row.SchoolCategory, selected);
        return !string.IsNullOrWhiteSpace(nid)
            && !string.IsNullOrWhiteSpace(row.NameAr)
            && !string.IsNullOrWhiteSpace(row.Track)
            && GradeImportLogic.IsValidNationalId(nid)
            && row.TotalGrade.HasValue
            && (selected.Count == 0 || (categoryCode is not null && selected.Contains(categoryCode)));
    }
}
