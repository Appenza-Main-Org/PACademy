using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Grades.Application.Dtos;
using PACademy.Modules.Grades.Application.Mapping;
using PACademy.Modules.Grades.Domain;
using PACademy.Modules.Identity.Public;

namespace PACademy.Modules.Grades.Application.Import;

public sealed class CommitImportUseCase(IGradesDbContext db, IIdentityApi identity)
{
    public async Task<CommittedImportDto> ExecuteAsync(
        CommitImportRequest req, CancellationToken ct = default)
    {
        var actor = (await identity.GetCurrentUserAsync(ct))!;
        var staging = await db.PendingGradeImports.FirstOrDefaultAsync(p => p.Id == req.StageId, ct)
            ?? throw new InvalidOperationException("لا يوجد استيراد مرحلي مطابق — يرجى البدء من جديد");

        var newRows = JsonSerializer.Deserialize<List<ImportedGradeRowDto>>(staging.NewRowsJson) ?? [];
        var duplicates = JsonSerializer.Deserialize<List<ImportDuplicateRowDto>>(staging.DuplicatesJson) ?? [];

        var acceptedNids = req.Resolutions
            .Where(kv => string.Equals(kv.Value, "ACCEPT", StringComparison.OrdinalIgnoreCase))
            .Select(kv => kv.Key)
            .ToHashSet();
        var keptCount = req.Resolutions
            .Count(kv => string.Equals(kv.Value, "REJECT", StringComparison.OrdinalIgnoreCase));

        var nidsToTouch = acceptedNids.ToList();
        var rowsToUpdate = await db.GradeRows
            .Include(r => r.Adjustments)
            .Where(r => nidsToTouch.Contains(r.Nid))
            .ToListAsync(ct);
        var existingByNid = rowsToUpdate.ToDictionary(r => r.Nid);

        var deactivated = new List<DeactivatedAdjustmentDto>();
        var replaced = 0;

        foreach (var dup in duplicates)
        {
            if (!acceptedNids.Contains(dup.NationalId)) continue;
            if (!existingByNid.TryGetValue(dup.NationalId, out var existing)) continue;

            var adjSum = existing.Adjustments.Where(a => a.IsActive).Sum(a => a.Amount);
            var projected = dup.Incoming.Total + adjSum;
            var overMax = projected > staging.MaxDegree;
            var belowZero = projected < 0;
            var shouldDeactivate = (overMax || belowZero) && existing.Adjustments.Any(a => a.IsActive);

            if (shouldDeactivate)
            {
                existing.DeactivateAllAdjustments(actor.Id);
                deactivated.Add(new DeactivatedAdjustmentDto(dup.NationalId, dup.Name, adjSum));
            }

            existing.ReplaceFromImport(
                dup.SeatIncoming,
                dup.Name,
                staging.Kind,
                dup.Incoming.Branch,
                dup.Incoming.School,
                dup.Incoming.Region,
                dup.Incoming.Total,
                staging.MaxDegree);
            replaced++;
        }

        foreach (var nr in newRows)
        {
            db.GradeRows.Add(GradeRow.Create(
                nr.Seat,
                seatingNumber: null,
                nr.Nid,
                nr.Name,
                staging.Kind,
                nr.Branch,
                nr.School,
                nr.Region,
                nr.Total,
                staging.MaxDegree,
                nr.Status,
                actor.Id));
        }

        db.PendingGradeImports.Remove(staging);
        await db.SaveChangesAsync(ct);

        return new CommittedImportDto(
            Inserted: newRows.Count + acceptedNids.Count,
            Replaced: replaced,
            Kept: keptCount,
            Deactivated: deactivated,
            Skipped: []);
    }
}
