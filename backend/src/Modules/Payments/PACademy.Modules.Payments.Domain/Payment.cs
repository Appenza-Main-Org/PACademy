namespace PACademy.Modules.Payments.Domain;

/// <summary>
/// Fawry payment ledger row — one record per applicant per cycle.
/// Wraps the vendor's Fawry reference and tracks status transitions for
/// the admin ledger surfaced at /admin/payments (Gap K).
///
/// Audit + concurrency invariants:
///   • <see cref="LastSyncAt"/> bumps on every state-changing mutation
///     (sync / setStatus / refund) so the ledger surface can sort by
///     freshness without a join to the audit log.
///   • <see cref="PaidAt"/> stamps once on the first transition to
///     <see cref="PaymentStatus.Paid"/> and is preserved on a later
///     refund — the ledger shows when money moved, not when it came back.
///   • <see cref="RowVersion"/> is a SQL rowversion concurrency token.
/// </summary>
public sealed class Payment
{
    private Payment() { }

    public Guid Id { get; private set; }
    public Guid ApplicantId { get; private set; }

    /// <summary>Applicant display name, snapshotted at payment-creation time.
    /// Denormalized to avoid a cross-module join on every ledger read
    /// (matches the Grades module's precedent of carrying NID + Name inline).</summary>
    public string ApplicantName { get; private set; } = string.Empty;

    /// <summary>Egyptian 14-digit national ID, snapshotted at creation.</summary>
    public string NationalId { get; private set; } = string.Empty;

    public Guid CycleId { get; private set; }
    public string FawryReference { get; private set; } = string.Empty;
    public decimal Amount { get; private set; }
    public PaymentStatus Status { get; private set; }

    /// <summary>ISO timestamp of the last Fawry status sync (or any mutation).</summary>
    public DateTime LastSyncAt { get; private set; }

    /// <summary>First-paid timestamp. Preserved across a later refund.</summary>
    public DateTime? PaidAt { get; private set; }

    public DateTime CreatedAt { get; private set; }
    public Guid CreatedBy { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public Guid UpdatedBy { get; private set; }
    public byte[] RowVersion { get; private set; } = Array.Empty<byte>();

    /// <summary>True for seeder-emitted rows; lets a re-seed skip without scrubbing real data.</summary>
    public bool DemoOrigin { get; private set; }

    public static Payment Create(
        Guid applicantId,
        string applicantName,
        string nationalId,
        Guid cycleId,
        string fawryReference,
        decimal amount,
        PaymentStatus initialStatus,
        Guid actorId)
    {
        if (string.IsNullOrWhiteSpace(fawryReference))
            throw new ArgumentException("Fawry reference is required.", nameof(fawryReference));
        if (string.IsNullOrWhiteSpace(applicantName))
            throw new ArgumentException("Applicant name is required.", nameof(applicantName));
        if (string.IsNullOrWhiteSpace(nationalId))
            throw new ArgumentException("National ID is required.", nameof(nationalId));
        if (amount <= 0)
            throw new ArgumentException("Amount must be positive.", nameof(amount));

        var now = DateTime.UtcNow;
        return new Payment
        {
            Id = Guid.NewGuid(),
            ApplicantId = applicantId,
            ApplicantName = applicantName,
            NationalId = nationalId,
            CycleId = cycleId,
            FawryReference = fawryReference,
            Amount = amount,
            Status = initialStatus,
            LastSyncAt = now,
            PaidAt = initialStatus == PaymentStatus.Paid ? now : null,
            CreatedAt = now,
            CreatedBy = actorId,
            UpdatedAt = now,
            UpdatedBy = actorId,
        };
    }

    /// <summary>Refresh the last-sync timestamp without touching status.</summary>
    public void RefreshSync(Guid actorId)
    {
        var now = DateTime.UtcNow;
        LastSyncAt = now;
        UpdatedAt = now;
        UpdatedBy = actorId;
    }

    /// <summary>Mutate status; stamps <see cref="PaidAt"/> on the first transition to Paid.</summary>
    public void SetStatus(PaymentStatus newStatus, Guid actorId)
    {
        var now = DateTime.UtcNow;
        Status = newStatus;
        if (newStatus == PaymentStatus.Paid && PaidAt is null)
            PaidAt = now;
        LastSyncAt = now;
        UpdatedAt = now;
        UpdatedBy = actorId;
    }

    /// <summary>Refund convenience — equivalent to <see cref="SetStatus"/> with Refunded.</summary>
    public void Refund(Guid actorId)
    {
        SetStatus(PaymentStatus.Refunded, actorId);
    }

    /// <summary>
    /// Seeder-only factory. Lets <c>DemoDataSeeder</c> emit rows whose
    /// timestamps deterministically derive from the seed RNG instead of
    /// <c>DateTime.UtcNow</c>, so a re-seed produces the same shape.
    /// </summary>
    public static Payment CreateSeeded(
        Guid applicantId,
        string applicantName,
        string nationalId,
        Guid cycleId,
        string fawryReference,
        decimal amount,
        PaymentStatus status,
        DateTime lastSyncAt,
        DateTime? paidAt,
        Guid actorId)
    {
        return new Payment
        {
            Id = Guid.NewGuid(),
            ApplicantId = applicantId,
            ApplicantName = applicantName,
            NationalId = nationalId,
            CycleId = cycleId,
            FawryReference = fawryReference,
            Amount = amount,
            Status = status,
            LastSyncAt = lastSyncAt,
            PaidAt = paidAt,
            CreatedAt = lastSyncAt,
            CreatedBy = actorId,
            UpdatedAt = lastSyncAt,
            UpdatedBy = actorId,
            DemoOrigin = true,
        };
    }
}
