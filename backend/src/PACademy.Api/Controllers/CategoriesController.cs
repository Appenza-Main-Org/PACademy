using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PACademy.Application.Admin.Categories;
using PACademy.Contracts.Admin.Categories;

namespace PACademy.Api.Controllers;

/// <summary>
/// Public Categories — any authenticated user can read.
/// </summary>
[ApiController]
[Route("categories")]
[Authorize]
public sealed class CategoriesController(ListCategoriesUseCase list) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<CategoryListItemDto>>> List(CancellationToken ct)
    {
        var items = await list.ExecuteAsync(includeArchived: false, ct);
        Response.Headers["X-Total-Count"] = items.Count.ToString();
        return Ok(items);
    }
}
