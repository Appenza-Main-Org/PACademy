using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Payments.Application.Dtos;
using PACademy.Modules.Payments.Domain;

namespace PACademy.Modules.Payments.Application.Payments;

public sealed record ListPaymentsFilters(
    PaymentStatus? Status,
    string? Search,
    Guid? CycleId);

public sealed class ListPaymentsUseCase(IPaymentsDbContext db)
{
    public async Task<IReadOnlyList<AdminPaymentDto>> ExecuteAsync(
        ListPaymentsFilters filters,
        CancellationToken ct = default)
    {
        IQueryable<Payment> q = db.Payments.AsNoTracking();

        if (filters.Status.HasValue)
            q = q.Where(p => p.Status == filters.Status.Value);

        if (filters.CycleId.HasValue)
            q = q.Where(p => p.CycleId == filters.CycleId.Value);

        if (!string.IsNullOrWhiteSpace(filters.Search))
        {
            var s = filters.Search.Trim();
            q = q.Where(p =>
                EF.Functions.Like(p.ApplicantName, $"%{s}%") ||
                EF.Functions.Like(p.NationalId, $"%{s}%") ||
                EF.Functions.Like(p.FawryReference, $"%{s}%"));
        }

        var rows = await q
            .OrderByDescending(p => p.LastSyncAt)
            .ToListAsync(ct);

        return rows.Select(AdminPaymentDtoMapper.FromDomain).ToList();
    }
}
