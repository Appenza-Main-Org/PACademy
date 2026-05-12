using Microsoft.EntityFrameworkCore;

namespace PACademy.Modules.Admissions.Application.Admin.MergeSplit;

public sealed class ArchiveMergeSplitRuleUseCase(IAdmissionsDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var rule = await db.CommitteeMergeSplitRules
            .FirstOrDefaultAsync(r => r.Id == id, ct);
        if (rule is null) return false;
        rule.Archive();
        await db.SaveChangesAsync(ct);
        return true;
    }
}
