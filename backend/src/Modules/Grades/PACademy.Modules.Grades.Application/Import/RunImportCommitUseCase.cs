using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Grades.Application.Dtos;
using PACademy.Modules.Grades.Domain;
using PACademy.Modules.Identity.Public;

namespace PACademy.Modules.Grades.Application.Import;

public sealed class RunImportCommitUseCase(IGradesDbContext db, IIdentityApi identity)
{
    public async Task<ImportCommitResultDto> ExecuteAsync(
        RunImportCommitRequest req, CancellationToken ct = default)
    {
        var actor = (await identity.GetCurrentUserAsync(ct))!;
        var existingNids = await db.GradeRows.Select(r => r.Nid).ToListAsync(ct);
        var existing = new HashSet<string>(existingNids);

        var maxSeatRow = await db.GradeRows.OrderByDescending(r => r.Seat).FirstOrDefaultAsync(ct);
        var nextSeat = (maxSeatRow?.Seat ?? 0) + 1;

        var inserted = 0;
        var failed = 0;
        var dupAction = req.PerGroupActions.TryGetValue("DUPLICATE_NID", out var a) ? a : null;

        foreach (var row in req.Rows)
        {
            if (string.IsNullOrWhiteSpace(row.NationalId)
                || string.IsNullOrWhiteSpace(row.NameAr)
                || string.IsNullOrWhiteSpace(row.Track))
            {
                failed++;
                continue;
            }
            if (!NationalId.IsValid(row.NationalId))
            {
                failed++;
                continue;
            }
            if (row.TotalGrade is null)
            {
                failed++;
                continue;
            }

            if (existing.Contains(row.NationalId!))
            {
                if (string.Equals(dupAction, "skip", StringComparison.OrdinalIgnoreCase)) continue;
                if (!string.Equals(dupAction, "override", StringComparison.OrdinalIgnoreCase))
                {
                    failed++;
                    continue;
                }

                var existingRow = await db.GradeRows
                    .Include(r => r.Adjustments)
                    .FirstAsync(r => r.Nid == row.NationalId, ct);

                existingRow.ReplaceFromImport(
                    row.SeatingNumber is { Length: > 0 } sn && int.TryParse(sn, out var s) ? s : existingRow.Seat,
                    row.NameAr!,
                    existingRow.Kind,
                    row.Track!,
                    existingRow.School,
                    existingRow.Region,
                    row.TotalGrade!.Value,
                    row.MaxGrade ?? existingRow.ImportMax);

                inserted++;
                continue;
            }

            var kind = row.MaxGrade == 510m ? GradeKind.Azhar : GradeKind.General;
            db.GradeRows.Add(GradeRow.Create(
                nextSeat++,
                row.SeatingNumber,
                row.NationalId!,
                row.NameAr!,
                kind,
                row.Track!,
                school: string.Empty,
                region: string.Empty,
                total: row.TotalGrade!.Value,
                importMax: row.MaxGrade ?? 410m,
                status: "—",
                createdBy: actor.Id));

            existing.Add(row.NationalId!);
            inserted++;
        }

        await db.SaveChangesAsync(ct);
        return new ImportCommitResultDto(inserted, failed);
    }
}
