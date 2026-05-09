using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.Categories;
using System.Text.Json;

namespace PACademy.Application.Admin.Categories;

public sealed class GetCategoryUseCase(IPaDbContext db)
{
    public async Task<CategoryDetailDto?> ExecuteByIdAsync(Guid id, CancellationToken ct = default)
    {
        var c = await db.Categories.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return c is null ? null : MapToDetail(c);
    }

    public async Task<CategoryDetailDto?> ExecuteByKeyAsync(string key, CancellationToken ct = default)
    {
        var c = await db.Categories.AsNoTracking().FirstOrDefaultAsync(x => x.Key == key, ct);
        return c is null ? null : MapToDetail(c);
    }

    internal static CategoryDetailDto MapToDetail(Domain.Categories.Category c)
        => new(
            c.Id, c.Key, c.NameAr, c.NameEn, c.Description,
            JsonDocument.Parse(string.IsNullOrWhiteSpace(c.ConditionsJson) ? "{}" : c.ConditionsJson).RootElement.Clone(),
            JsonDocument.Parse(string.IsNullOrWhiteSpace(c.RequiredTestsJson) ? "[]" : c.RequiredTestsJson).RootElement.Clone(),
            JsonDocument.Parse(string.IsNullOrWhiteSpace(c.ProceduresJson) ? "[]" : c.ProceduresJson).RootElement.Clone(),
            c.SortOrder, c.IsActive, c.IsSpec,
            c.CreatedAt, c.UpdatedAt, c.DemoOrigin);
}
