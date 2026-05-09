using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Dtos;
using PACademy.Modules.Admissions.Domain;
using PACademy.Modules.Identity.Public;
using PACademy.Shared.Contracts;

namespace PACademy.Modules.Admissions.Application.Admin.Categories;

public sealed class CreateCategoryUseCase(IAdmissionsDbContext db, IIdentityApi identityApi)
{
    public async Task<CategoryDetailDto> ExecuteAsync(
        CreateCategoryRequest request,
        CancellationToken ct = default)
    {
        var actor = (await identityApi.GetCurrentUserAsync(ct))!;

        var keyTaken = await db.Categories.AnyAsync(c => c.Key == request.Key, ct);
        if (keyTaken)
            throw new DomainConflictException(
                $"A category with key '{request.Key}' already exists.",
                "CATEGORY_KEY_TAKEN");

        var category = Category.Create(
            request.Key,
            request.NameAr,
            actor.Id,
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
