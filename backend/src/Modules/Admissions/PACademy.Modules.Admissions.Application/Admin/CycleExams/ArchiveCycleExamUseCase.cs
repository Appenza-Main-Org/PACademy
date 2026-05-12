using Microsoft.EntityFrameworkCore;

namespace PACademy.Modules.Admissions.Application.Admin.CycleExams;

public sealed class ArchiveCycleExamUseCase(IAdmissionsDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var exam = await db.CycleExams.FirstOrDefaultAsync(e => e.Id == id, ct);
        if (exam is null) return false;
        exam.Archive();
        await db.SaveChangesAsync(ct);
        return true;
    }
}
