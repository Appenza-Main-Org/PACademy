using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Payments.Application.Dtos;
using PACademy.Modules.Payments.Domain;

namespace PACademy.Modules.Payments.Application.Payments;

/// <summary>
/// Refund-eligibility view (RFP §p.42 — صلاحية إعادة المقابل المالي).
/// Returns paid payments whose owning cycle is archived. Controller
/// passes the archived cycle ID set so this use case stays free of
/// cross-module data dependencies (cycles live in Admissions / legacy
/// PaDbContext; the controller does the join).
/// </summary>
public sealed class ListRefundEligiblePaymentsUseCase(IPaymentsDbContext db)
{
    public async Task<IReadOnlyList<AdminPaymentDto>> ExecuteAsync(
        IReadOnlyCollection<Guid> archivedCycleIds,
        CancellationToken ct = default)
    {
        if (archivedCycleIds.Count == 0)
            return Array.Empty<AdminPaymentDto>();

        var ids = archivedCycleIds.ToHashSet();

        var rows = await db.Payments.AsNoTracking()
            .Where(p => p.Status == PaymentStatus.Paid && ids.Contains(p.CycleId))
            .OrderByDescending(p => p.PaidAt)
            .ToListAsync(ct);

        return rows.Select(AdminPaymentDtoMapper.FromDomain).ToList();
    }
}
