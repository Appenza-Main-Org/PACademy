using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;

namespace PACademy.Modules.Admissions.Application.Admin.CycleExams;

public sealed class RestoreCycleExamUseCase(IAdmissionsDbContext db)
{
    public async Task<CycleExamDto?> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var exam = await db.CycleExams.FirstOrDefaultAsync(e => e.Id == id, ct);
        if (exam is null) return null;
        exam.Restore();
        await db.SaveChangesAsync(ct);
        return CycleExamMapper.ToDto(exam);
    }
}
