namespace PACademy.Modules.Payments.Public;

/// <summary>
/// Cross-module read-projection of a payment row. Used by callers that
/// need to display ledger summaries without taking a dependency on the
/// Payments domain (e.g. Reports module). Frontend `AdminPaymentRow`
/// mirrors this shape.
/// </summary>
public sealed record PaymentSummaryDto(
    Guid Id,
    Guid ApplicantId,
    string ApplicantName,
    string NationalId,
    Guid CycleId,
    string FawryReference,
    decimal Amount,
    string Status,
    DateTime LastSyncAt,
    DateTime? PaidAt);
