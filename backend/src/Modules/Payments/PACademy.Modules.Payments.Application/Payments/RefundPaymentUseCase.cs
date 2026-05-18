using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Payments.Application.Dtos;
using PACademy.Modules.Payments.Domain;
using PACademy.Shared.Audit.Domain;
using PACademy.Shared.Audit.Public;
using PACademy.Shared.Contracts;

namespace PACademy.Modules.Payments.Application.Payments;

public sealed class RefundPaymentUseCase(
    IPaymentsDbContext db,
    ICurrentActor actor,
    IAuditApi audit)
{
    public async Task<(AdminPaymentDto? Ok, string? ErrorCode)> ExecuteAsync(
        string fawryReference,
        string? reason,
        CancellationToken ct = default)
    {
        var p = await db.Payments.FirstOrDefaultAsync(x => x.FawryReference == fawryReference, ct);
        if (p is null) return (null, "NOT_FOUND");

        if (p.Status != PaymentStatus.Paid)
            return (null, "REFUND_REQUIRES_PAID");

        p.Refund(actor.Id);
        await db.SaveChangesAsync(ct);

        var detail = string.IsNullOrWhiteSpace(reason)
            ? $"{p.FawryReference}: refunded"
            : $"{p.FawryReference}: refunded ({reason})";

        await audit.RecordAsync(
            AuditAction.StatusChange,
            "payment",
            p.Id,
            detail,
            AuditOutcome.Success,
            ct: ct);

        return (AdminPaymentDtoMapper.FromDomain(p), null);
    }
}
