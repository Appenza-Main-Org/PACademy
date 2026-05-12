using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;

namespace PACademy.Modules.Admissions.Application.Admin.MergeSplit;

public sealed class GetMergeSplitRuleUseCase(IAdmissionsDbContext db)
{
    public async Task<MergeSplitRuleDto?> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var rule = await db.CommitteeMergeSplitRules
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == id, ct);
        return rule is null ? null : MergeSplitMapper.ToDto(rule);
    }
}
