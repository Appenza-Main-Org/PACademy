using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;
using PACademy.Modules.Admissions.Domain;

namespace PACademy.Modules.Admissions.Application.Admin.MergeSplit;

public sealed class ListMergeSplitRulesUseCase(IAdmissionsDbContext db)
{
    public async Task<IReadOnlyList<MergeSplitRuleDto>> ExecuteAsync(
        Guid cycleId, string? status = null, CancellationToken ct = default)
    {
        var query = db.CommitteeMergeSplitRules
            .AsNoTracking()
            .Where(r => r.CycleId == cycleId && !r.IsArchived);

        if (status is not null && Enum.TryParse<MergeSplitStatus>(status, true, out var s))
            query = query.Where(r => r.Status == s);

        var rules = await query.OrderByDescending(r => r.CreatedAt).ToListAsync(ct);
        return rules.Select(MergeSplitMapper.ToDto).ToList();
    }
}
