namespace PACademy.Modules.Admissions.Public;

public interface IAdmissionsApi
{
    Task<CycleSummaryDto?> GetActiveCycleAsync(CancellationToken ct = default);
    Task<CategorySummaryDto?> GetCategoryByKeyAsync(string key, CancellationToken ct = default);
}

public sealed record CycleSummaryDto(Guid Id, string Name, string Status, DateTime StartDate, DateTime EndDate);
public sealed record CategorySummaryDto(Guid Id, string Key, string NameAr, string? NameEn);
