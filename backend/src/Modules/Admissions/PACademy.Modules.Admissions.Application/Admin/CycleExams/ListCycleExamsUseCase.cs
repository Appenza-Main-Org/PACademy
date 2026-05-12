using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;

namespace PACademy.Modules.Admissions.Application.Admin.CycleExams;

public sealed class ListCycleExamsUseCase(IAdmissionsDbContext db)
{
    public async Task<IReadOnlyList<CycleExamDto>> ExecuteAsync(
        Guid cycleId, Guid? categoryId = null, CancellationToken ct = default)
    {
        var query = db.CycleExams
            .AsNoTracking()
            .Where(e => e.CycleId == cycleId && !e.IsArchived);

        if (categoryId.HasValue)
            query = query.Where(e => e.CategoryId == categoryId);

        var exams = await query.OrderBy(e => e.Order).ToListAsync(ct);
        return exams.Select(CycleExamMapper.ToDto).ToList();
    }
}
