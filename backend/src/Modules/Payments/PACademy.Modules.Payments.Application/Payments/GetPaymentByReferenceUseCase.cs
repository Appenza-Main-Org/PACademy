using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Payments.Application.Dtos;

namespace PACademy.Modules.Payments.Application.Payments;

public sealed class GetPaymentByReferenceUseCase(IPaymentsDbContext db)
{
    public async Task<AdminPaymentDto?> ExecuteAsync(string fawryReference, CancellationToken ct = default)
    {
        var p = await db.Payments.AsNoTracking()
            .FirstOrDefaultAsync(x => x.FawryReference == fawryReference, ct);
        return p is null ? null : AdminPaymentDtoMapper.FromDomain(p);
    }
}
