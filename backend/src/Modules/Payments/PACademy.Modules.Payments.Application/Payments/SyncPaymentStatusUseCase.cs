using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Payments.Application.Dtos;
using PACademy.Shared.Audit.Domain;
using PACademy.Shared.Audit.Public;
using PACademy.Shared.Contracts;

namespace PACademy.Modules.Payments.Application.Payments;

/// <summary>
/// Refresh the Fawry sync timestamp. Production wiring hits the vendor's
/// status API; the in-app version just stamps <c>LastSyncAt</c> + emits
/// an audit row so the demo flow looks active in the ledger.
/// </summary>
public sealed class SyncPaymentStatusUseCase(
    IPaymentsDbContext db,
    ICurrentActor actor,
    IAuditApi audit)
{
    public async Task<AdminPaymentDto?> ExecuteAsync(string fawryReference, CancellationToken ct = default)
    {
        var p = await db.Payments.FirstOrDefaultAsync(x => x.FawryReference == fawryReference, ct);
        if (p is null) return null;

        p.RefreshSync(actor.Id);
        await db.SaveChangesAsync(ct);

        await audit.RecordAsync(
            AuditAction.StatusChange,
            "payment",
            p.Id,
            $"{p.FawryReference}: sync",
            AuditOutcome.Success,
            ct: ct);

        return AdminPaymentDtoMapper.FromDomain(p);
    }
}
