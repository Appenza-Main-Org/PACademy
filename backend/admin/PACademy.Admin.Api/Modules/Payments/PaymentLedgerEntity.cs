namespace PACademy.Admin.Api.Modules.Payments;

/// <summary>
/// Normalized "Shape A" table for the durable payments ledger. Extracted from the
/// JSON <c>payments</c> bucket (operational table also named <c>payments</c>) — the
/// new table is named <c>payment_ledger</c> to avoid colliding with that Shape-B table.
///
/// House mirror strategy: typed columns own query/index/integrity; <see cref="PayloadJson"/>
/// keeps the full DTO verbatim so the read path returns the identical wire shape
/// (<c>frontend/src/features/admin/api/payments.service.ts</c>). Soft-delete fields are
/// stored as typed columns AND inside the payload (callers read <c>deletedAt</c> from JSON).
/// </summary>
public sealed class PaymentLedgerEntity
{
    public required string Id { get; set; }
    public string? ApplicantId { get; set; }
    public string? ApplicantName { get; set; }
    public string? NationalId { get; set; }
    public string? CycleId { get; set; }
    public required string FawryReference { get; set; }
    public decimal Amount { get; set; }
    public required string Status { get; set; }
    public DateTimeOffset? LastSyncAt { get; set; }
    public DateTimeOffset? PaidAt { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public string? DeletedBy { get; set; }
    public string? DeleteReason { get; set; }
    /// <summary>Full DTO mirror — returned verbatim by the read path.</summary>
    public required string PayloadJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
}
