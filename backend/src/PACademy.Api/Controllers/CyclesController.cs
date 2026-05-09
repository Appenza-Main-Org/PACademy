using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PACademy.Application.Admin.Cycles;
using PACademy.Contracts.Admin.Cycles;
using PACademy.Contracts.Common;

namespace PACademy.Api.Controllers;

/// <summary>
/// Public Cycles — authenticated users may read Active + Closed cycles.
/// Draft and Archived are suppressed for non-super-admins (FR-Y07).
/// </summary>
[ApiController]
[Route("cycles")]
[Authorize]
public sealed class CyclesController(ListCyclesUseCase list) : ControllerBase
{
    /// <summary>
    /// GET /cycles — returns Active and Closed cycles.
    /// Accepts optional ?status=active|closed to narrow further.
    /// Draft and Archived are always excluded.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<CycleListItemDto>>> List(
        [FromQuery] string? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        // Only allow active or closed to be requested; anything else is ignored
        var effectiveStatus = status?.ToLowerInvariant() switch
        {
            "active" => "active",
            "closed" => "closed",
            _ => null,
        };

        var filters = new CycleListFilters(
            Status: effectiveStatus,
            IncludeArchived: false,
            Page: page,
            PageSize: pageSize);

        var result = await list.ExecuteAsync(filters, ct);

        // Belt-and-suspenders: strip Draft rows
        var publicItems = result.Items
            .Where(c => c.Status is "active" or "closed")
            .ToList();

        Response.Headers["X-Total-Count"] = publicItems.Count.ToString();
        Response.Headers["X-Page-Count"] = "1";

        return Ok(new PagedResult<CycleListItemDto>(
            publicItems, result.Page, result.PageSize,
            publicItems.Count, 1));
    }
}
