namespace PACademy.Modules.Grades.Public;

public interface IGradeApi
{
    /// <summary>Returns the count of grade rows matching the given NID, or 0.</summary>
    Task<int> CountByNidAsync(string nid, CancellationToken ct = default);

    /// <summary>Returns the total imported grade rows (used by audit/reports).</summary>
    Task<int> TotalCountAsync(CancellationToken ct = default);
}

public sealed record GradeRowSummaryDto(
    Guid Id,
    int Seat,
    string Nid,
    string Name,
    decimal Total,
    decimal? OverrideMax);
