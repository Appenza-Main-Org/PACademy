using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;

namespace PACademy.Modules.Admissions.Application.Admin.CycleExams;

public sealed class ReorderCycleExamsUseCase(IAdmissionsDbContext db)
{
    public async Task<IReadOnlyList<CycleExamDto>> ExecuteAsync(
        Guid cycleId, ReorderCycleExamsRequest request, CancellationToken ct = default)
    {
        var exams = await db.CycleExams
            .Where(e => e.CycleId == cycleId && !e.IsArchived)
            .ToListAsync(ct);

        var examById = exams.ToDictionary(e => e.Id);
        var order = 10;
        foreach (var id in request.OrderedIds)
        {
            if (examById.TryGetValue(id, out var exam))
                exam.Update(order, null, null);
            order += 10;
        }

        await db.SaveChangesAsync(ct);
        return exams.OrderBy(e => e.Order).Select(CycleExamMapper.ToDto).ToList();
    }
}
