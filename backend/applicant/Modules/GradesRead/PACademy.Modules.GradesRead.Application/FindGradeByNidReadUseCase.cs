using Microsoft.EntityFrameworkCore;
using PACademy.Shared.Domain.Grades;

namespace PACademy.Modules.GradesRead.Application;

public sealed class FindGradeByNidReadUseCase(IGradesReadDbContext db)
{
    public async Task<GradeRowReadDto?> ExecuteAsync(string nid, Guid? cycleId, CancellationToken ct = default)
    {
        var row = await db.ApplicantGrades
            .Include(x => x.Adjustments)
            .FirstOrDefaultAsync(x => x.Nid == ToAsciiDigits(nid), ct);
        return row is null ? null : ToDto(row);
    }

    private static GradeRowReadDto ToDto(ApplicantGrade row)
    {
        var log = row.Adjustments
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new GradeAdjustmentReadDto(x.Id, x.Reason, x.ReasonLabel, x.Note, x.Amount, x.By, x.When, x.IsActive))
            .ToList();
        var active = log.Where(x => x.IsActive).ToList();
        var effective = Clamp(row.Total + active.Sum(x => x.Amount), 0, row.OverrideMax ?? row.ImportMax);
        return new GradeRowReadDto(
            row.Seat,
            row.SeatingNumber,
            row.Nid,
            row.Name,
            row.Kind,
            row.Gender,
            row.Branch,
            row.GraduationYear,
            row.SchoolCategoryCode,
            row.School,
            row.Region,
            row.ExamRound,
            row.Total,
            row.ImportMax,
            row.OverrideMax,
            row.LastEditedAt,
            row.LastEditedBy,
            row.GradeChangedAt,
            row.PreviousGrade,
            row.Status,
            log,
            effective,
            active.Count > 0,
            active.Count,
            active.OrderByDescending(x => x.When).Select(x => x.ReasonLabel).FirstOrDefault());
    }

    private static decimal Clamp(decimal value, decimal min, decimal max)
        => Math.Min(Math.Max(value, min), max);

    private static string ToAsciiDigits(string value)
        => new(value.Select(ch => ch switch
        {
            >= '٠' and <= '٩' => (char)('0' + (ch - '٠')),
            >= '۰' and <= '۹' => (char)('0' + (ch - '۰')),
            _ => ch,
        }).ToArray());
}
