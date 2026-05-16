using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Grades.Application.Dtos;
using PACademy.Modules.Grades.Application.Mapping;
using PACademy.Modules.Grades.Domain;
using PACademy.Modules.Identity.Public;

namespace PACademy.Modules.Grades.Application.Import;

public sealed class StageImportUseCase(IGradesDbContext db, IIdentityApi identity)
{
    public async Task<StagedImportResult> ExecuteAsync(
        StageImportRequest req, CancellationToken ct = default)
    {
        var actor = (await identity.GetCurrentUserAsync(ct))!;
        var kind = GradeMapper.ParseKind(req.Kind);
        var existingByNid = await db.GradeRows
            .Include(r => r.Adjustments)
            .ToDictionaryAsync(r => r.Nid, ct);

        var newRows = new List<ImportedGradeRowDto>();
        var duplicates = new List<ImportDuplicateRowDto>();
        var overflow = new List<ImportSkipRowDto>();

        for (int i = 0; i < req.Rows.Count; i++)
        {
            var row = req.Rows[i];
            if (row.Total > req.MaxDegree)
            {
                overflow.Add(new ImportSkipRowDto(
                    i + 2,
                    $"رقم جلوس {row.Seat:N0} · المجموع = {row.Total}"));
                continue;
            }

            if (!existingByNid.TryGetValue(row.Nid, out var existing))
            {
                newRows.Add(row);
                continue;
            }

            var changed = new List<string>();
            if (existing.Total != row.Total) changed.Add("total");
            if (existing.Branch != row.Branch) changed.Add("branch");
            if (existing.School != row.School) changed.Add("school");
            if (existing.Region != row.Region) changed.Add("region");
            if (existing.Status != row.Status) changed.Add("status");
            if (existing.Seat != row.Seat) changed.Add("seat");

            var adjSum = existing.Adjustments
                .Where(a => a.IsActive)
                .Sum(a => a.Amount);

            duplicates.Add(new ImportDuplicateRowDto(
                row.Nid,
                row.Name,
                req.Kind,
                existing.Seat,
                row.Seat,
                req.MaxDegree,
                changed.Count > 0,
                changed,
                new ImportSnapshotDto(existing.Total, existing.Branch, existing.School, existing.Region, existing.Status),
                new ImportSnapshotDto(row.Total, row.Branch, row.School, row.Region, row.Status),
                adjSum,
                existing.Adjustments.Count(a => a.IsActive)));
        }

        var staging = PendingGradeImport.Create(
            kind,
            req.MaxDegree,
            JsonSerializer.Serialize(newRows),
            JsonSerializer.Serialize(duplicates),
            actor.Id);
        db.PendingGradeImports.Add(staging);
        await db.SaveChangesAsync(ct);

        var skipped = new List<ImportSkipBucketDto>();
        if (overflow.Count > 0)
        {
            skipped.Add(new ImportSkipBucketDto(
                "TOTAL_EXCEEDS_MAX", "تجاوز الدرجة العظمى",
                overflow.Count, "terra",
                overflow.Take(50).ToList()));
        }

        return new StagedImportResult(staging.Id, newRows.Count, duplicates, skipped);
    }
}
