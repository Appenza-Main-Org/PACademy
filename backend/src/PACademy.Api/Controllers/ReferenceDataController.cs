using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PACademy.Application.Admin.ReferenceData;
using PACademy.Contracts.Admin.ReferenceData;
using PACademy.Contracts.Common;

namespace PACademy.Api.Controllers;

/// <summary>
/// Public Reference Data — any authenticated user can read (FR-L08).
/// </summary>
[ApiController]
[Route("reference-data")]
[Authorize]
public sealed class ReferenceDataController(ListReferenceDataUseCase list) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<ReferenceDataListItemDto>>> List(
        [FromQuery] string? category = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? sortBy = null,
        [FromQuery] string? sortDir = null,
        CancellationToken ct = default)
    {
        // Public read: never include archived rows
        var filters = new ReferenceDataListFilters(
            Category: category,
            IsActive: true,
            IncludeArchived: false,
            Page: page,
            PageSize: pageSize,
            SortBy: sortBy,
            SortDir: sortDir);

        var result = await list.ExecuteAsync(filters, ct);

        Response.Headers["X-Total-Count"] = result.TotalCount.ToString();
        Response.Headers["X-Page-Count"] = result.TotalPages.ToString();
        return Ok(result);
    }
}
