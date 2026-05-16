using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Grades.Application.Dtos;
using PACademy.Modules.Grades.Application.Mapping;
using PACademy.Modules.Identity.Public;

namespace PACademy.Modules.Grades.Application.Adjustments;

public sealed class UpdateOverrideMaxUseCase(IGradesDbContext db, IIdentityApi identity)
{
    public async Task<GradeRowDto> ExecuteAsync(
        int seat, UpdateOverrideMaxRequest req, CancellationToken ct = default)
    {
        var actor = (await identity.GetCurrentUserAsync(ct))!;
        var row = await db.GradeRows
            .Include(r => r.Adjustments)
            .FirstOrDefaultAsync(r => r.Seat == seat, ct)
            ?? throw new InvalidOperationException($"رقم الجلوس {seat} غير موجود");

        row.SetOverrideMax(req.OverrideMax, actor.Id);
        await db.SaveChangesAsync(ct);
        return GradeMapper.ToDto(row);
    }
}
