namespace PACademy.Modules.Payments.Public;

/// <summary>
/// Inter-module API surface for Payments. Other modules (Reports,
/// dashboards) consume payment summaries through this interface so they
/// don't take a dependency on the Payments domain or DbContext.
/// </summary>
public interface IPaymentsApi
{
    /// <summary>Total payments for a cycle (across all statuses).</summary>
    Task<int> CountForCycleAsync(Guid cycleId, CancellationToken ct = default);

    /// <summary>Single payment summary by Fawry reference; null if unknown.</summary>
    Task<PaymentSummaryDto?> GetByReferenceAsync(string fawryReference, CancellationToken ct = default);
}
