using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.Categories;

namespace PACademy.Application.Admin.Categories;

public sealed class UpdateCategoryUseCase(IPaDbContext db)
{
    public async Task<CategoryDetailDto?> ExecuteByIdAsync(
        Guid id,
        UpdateCategoryRequest request,
        CancellationToken ct = default)
    {
        var c = await db.Categories.FirstOrDefaultAsync(x => x.Id == id, ct);
        return c is null ? null : await ApplyAsync(c, request, ct);
    }

    public async Task<CategoryDetailDto?> ExecuteByKeyAsync(
        string key,
        UpdateCategoryRequest request,
        CancellationToken ct = default)
    {
        var c = await db.Categories.FirstOrDefaultAsync(x => x.Key == key, ct);
        return c is null ? null : await ApplyAsync(c, request, ct);
    }

    private async Task<CategoryDetailDto> ApplyAsync(
        Domain.Categories.Category category,
        UpdateCategoryRequest request,
        CancellationToken ct)
    {
        // FR-012: prime EF's OriginalValue from the client's known RowVersion
        // so SaveChanges raises DbUpdateConcurrencyException (→ 409 via
        // DbUpdateConcurrencyExceptionMiddleware) when the row was changed
        // concurrently. Omitting RowVersion preserves legacy last-write-wins
        // behavior for callers that haven't migrated yet.
        if (!string.IsNullOrEmpty(request.RowVersion))
        {
            var clientRv = Convert.FromBase64String(request.RowVersion);
            db.Entry(category).Property(c => c.RowVersion).OriginalValue = clientRv;
        }

        category.Update(
            request.NameAr,
            request.NameEn,
            request.Description,
            request.Conditions?.GetRawText(),
            request.RequiredTests?.GetRawText(),
            request.Procedures?.GetRawText(),
            request.SortOrder,
            request.IsActive);

        await db.SaveChangesAsync(ct);
        return GetCategoryUseCase.MapToDetail(category);
    }
}
