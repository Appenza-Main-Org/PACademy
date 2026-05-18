using PACademy.Modules.Payments.Domain;

namespace PACademy.Modules.Payments.Application.Dtos;

/// <summary>
/// Wire shape for the admin ledger row. Camel-cased on the wire so it
/// drops into the frontend's `AdminPaymentRow` without remapping.
/// </summary>
public sealed record AdminPaymentDto(
    Guid Id,
    Guid ApplicantId,
    string ApplicantName,
    string NationalId,
    Guid CycleId,
    string FawryReference,
    decimal Amount,
    PaymentStatus Status,
    DateTime LastSyncAt,
    DateTime? PaidAt,
    string RowVersion);

public static class AdminPaymentDtoMapper
{
    public static AdminPaymentDto FromDomain(Payment p) =>
        new(
            p.Id,
            p.ApplicantId,
            p.ApplicantName,
            p.NationalId,
            p.CycleId,
            p.FawryReference,
            p.Amount,
            p.Status,
            p.LastSyncAt,
            p.PaidAt,
            Convert.ToBase64String(p.RowVersion));
}
