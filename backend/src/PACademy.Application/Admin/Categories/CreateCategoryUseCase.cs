using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.Categories;
using System.Text.Json;

namespace PACademy.Application.Admin.Categories;

public sealed class CreateCategoryUseCase(IPaDbContext db, ICurrentUser currentUser)
{
    public async Task<CategoryDetailDto> ExecuteAsync(
        CreateCategoryRequest request,
        CancellationToken ct = default)
    {
        var keyTaken = await db.Categories.AnyAsync(c => c.Key == request.Key, ct);
        if (keyTaken)
            throw new DomainConflictException(
                $"A category with key '{request.Key}' already exists.",
                "CATEGORY_KEY_TAKEN");

        var category = Domain.Categories.Category.Create(
            request.Key,
            request.NameAr,
            currentUser.Id,
            request.NameEn,
            request.Description,
            request.Conditions?.GetRawText(),
            request.RequiredTests?.GetRawText(),
            request.Procedures?.GetRawText(),
            request.SortOrder ?? 0,
            isSpec: false);

        db.Categories.Add(category);
        await db.SaveChangesAsync(ct);

        return GetCategoryUseCase.MapToDetail(category);
    }
}
