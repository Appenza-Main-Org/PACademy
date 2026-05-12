namespace PACademy.Modules.Committees.Public;

public interface ICommitteeApi
{
    /// <summary>Returns committee ids that belong to the given cycle.</summary>
    Task<IReadOnlyList<CommitteeSummaryDto>> GetByCycleAsync(Guid cycleId, CancellationToken ct = default);

    /// <summary>Returns true when the committee exists and is not archived.</summary>
    Task<bool> ExistsAsync(Guid committeeId, CancellationToken ct = default);
}

public sealed record CommitteeSummaryDto(
    Guid Id,
    string Key,
    string NameAr,
    string? NameEn,
    int DailyCapacity,
    string Status);
