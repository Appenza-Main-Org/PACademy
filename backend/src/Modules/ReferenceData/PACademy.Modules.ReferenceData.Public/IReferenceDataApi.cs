namespace PACademy.Modules.ReferenceData.Public;

public interface IReferenceDataApi
{
    Task<IReadOnlyList<ReferenceDataItemDto>> ListByCategoryAsync(string category, CancellationToken ct = default);
    Task<ReferenceDataItemDto?> FindByKeyAsync(string category, string key, CancellationToken ct = default);
}

public sealed record ReferenceDataItemDto(
    Guid Id, string Category, string Key, string NameAr, string? NameEn,
    string? Metadata, int SortOrder, bool IsActive);
