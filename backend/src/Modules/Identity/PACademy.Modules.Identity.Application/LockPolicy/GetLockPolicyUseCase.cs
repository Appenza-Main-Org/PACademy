using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Identity.Domain;

namespace PACademy.Modules.Identity.Application.LockPolicies;

public sealed record LockPolicyDto(int MaxFailedAttempts, int LockDurationMinutes);

public sealed class GetLockPolicyUseCase(IIdentityDbContext db)
{
    public async Task<LockPolicyDto> ExecuteAsync(CancellationToken ct = default)
    {
        var policy = await db.LockPolicies.FirstOrDefaultAsync(ct) ?? Domain.LockPolicy.Default();
        return new LockPolicyDto(policy.MaxFailedAttempts, policy.LockDurationMinutes);
    }
}

