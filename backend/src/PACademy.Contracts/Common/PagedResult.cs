// Phase 5: Canonical type is PACademy.Shared.Contracts.PagedResult<T>.
// This legacy alias is kept for backward compat; migrate consumers in Phase 6+.
namespace PACademy.Contracts.Common;

public sealed record PagedResult<T>(
    IReadOnlyList<T> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages);
