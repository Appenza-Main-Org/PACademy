using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Dtos;
using PACademy.Modules.Admissions.Domain;

namespace PACademy.Modules.Admissions.Application.Admin.Categories;

public sealed class UpdateCategoryUseCase(IAdmissionsDbContext db)
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
        Category category,
        UpdateCategoryRequest request,
        CancellationToken ct)
    {
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
