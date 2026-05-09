using PACademy.Shared.Contracts;

namespace PACademy.Modules.Identity.Application.Admin.Users;

public sealed class ListSystemUsersUseCase(IIdentityProvider identity)
{
    public async Task<PagedResult<SystemUserListItemDto>> ExecuteAsync(
        SystemUserListFilters filters,
        CancellationToken ct = default)
    {
        var page = Math.Max(1, filters.Page);
        var pageSize = Math.Clamp(filters.PageSize, 1, 200);

        var (items, total) = await identity.ListUsersAsync(
            filters.Role, filters.Q, filters.IsActive,
            page, pageSize, filters.SortBy, filters.SortDir, ct);

        var dtos = items.Select(u => new SystemUserListItemDto(
            u.Id, u.NationalId, u.FullName, u.Role,
            u.Mobile, u.Email, u.Unit, u.IsActive, u.CreatedAt, u.DemoOrigin)).ToList();

        var totalPages = pageSize == 0 ? 0 : (int)Math.Ceiling(total / (double)pageSize);
        return new PagedResult<SystemUserListItemDto>(dtos, page, pageSize, total, totalPages);
    }
}
