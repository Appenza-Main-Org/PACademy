using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Payments.Infrastructure.Persistence;
using PACademy.Modules.Payments.Public;

namespace PACademy.Modules.Payments.Infrastructure;

internal sealed class PaymentsApiService(PaymentsDbContext db) : IPaymentsApi
{
    public Task<int> CountForCycleAsync(Guid cycleId, CancellationToken ct = default)
        => db.Payments.AsNoTracking().CountAsync(p => p.CycleId == cycleId, ct);

    public async Task<PaymentSummaryDto?> GetByReferenceAsync(
        string fawryReference, CancellationToken ct = default)
    {
        var p = await db.Payments.AsNoTracking()
            .FirstOrDefaultAsync(x => x.FawryReference == fawryReference, ct);
        return p is null
            ? null
            : new PaymentSummaryDto(
                p.Id,
                p.ApplicantId,
                p.ApplicantName,
                p.NationalId,
                p.CycleId,
                p.FawryReference,
                p.Amount,
                p.Status.ToString(),
                p.LastSyncAt,
                p.PaidAt);
    }
}
