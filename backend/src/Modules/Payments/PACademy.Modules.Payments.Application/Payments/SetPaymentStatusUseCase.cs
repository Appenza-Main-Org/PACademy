using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Payments.Application.Dtos;
using PACademy.Modules.Payments.Domain;
using PACademy.Shared.Audit.Domain;
using PACademy.Shared.Audit.Public;
using PACademy.Shared.Contracts;

namespace PACademy.Modules.Payments.Application.Payments;

public sealed class SetPaymentStatusUseCase(
    IPaymentsDbContext db,
    ICurrentActor actor,
    IAuditApi audit)
{
    public async Task<AdminPaymentDto?> ExecuteAsync(
        string fawryReference,
        PaymentStatus newStatus,
        string? reason,
        CancellationToken ct = default)
    {
        var p = await db.Payments.FirstOrDefaultAsync(x => x.FawryReference == fawryReference, ct);
        if (p is null) return null;

        var previousStatus = p.Status;
        p.SetStatus(newStatus, actor.Id);
        await db.SaveChangesAsync(ct);

        var detail = string.IsNullOrWhiteSpace(reason)
            ? $"{p.FawryReference}: {previousStatus} → {newStatus}"
            : $"{p.FawryReference}: {previousStatus} → {newStatus} ({reason})";

        await audit.RecordAsync(
            AuditAction.StatusChange,
            "payment",
            p.Id,
            detail,
            AuditOutcome.Success,
            ct: ct);

        return AdminPaymentDtoMapper.FromDomain(p);
    }
}
