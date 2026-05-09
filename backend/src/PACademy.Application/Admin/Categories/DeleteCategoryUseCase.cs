using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;

namespace PACademy.Application.Admin.Categories;

public sealed class DeleteCategoryUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteByIdAsync(Guid id, CancellationToken ct = default)
    {
        var c = await db.Categories.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (c is null) return false;

        if (c.IsSpec)
            throw new DomainConflictException(
                "Spec categories cannot be deleted.",
                "CATEGORY_IS_SPEC");

        // Hard-delete bypassing soft-delete hook (Category implements ISoftDeletable)
        var rowsDeleted = await db.Categories
            .Where(x => x.Id == id)
            .ExecuteDeleteAsync(ct);
        return rowsDeleted > 0;
    }

    public async Task<bool> ExecuteByKeyAsync(string key, CancellationToken ct = default)
    {
        var c = await db.Categories.AsNoTracking().FirstOrDefaultAsync(x => x.Key == key, ct);
        if (c is null) return false;

        if (c.IsSpec)
            throw new DomainConflictException(
                "Spec categories cannot be deleted.",
                "CATEGORY_IS_SPEC");

        var rowsDeleted = await db.Categories
            .Where(x => x.Key == key)
            .ExecuteDeleteAsync(ct);
        return rowsDeleted > 0;
    }
}
