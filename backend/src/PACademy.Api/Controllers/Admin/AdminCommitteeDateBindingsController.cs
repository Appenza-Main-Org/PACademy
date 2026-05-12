using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PACademy.Modules.Committees.Application.DateBindings;
using PACademy.Modules.Committees.Application.Dtos;

namespace PACademy.Api.Controllers.Admin;

[ApiController]
[Authorize(Policy = "admission-setup:read")]
public sealed class AdminCommitteeDateBindingsController(
    ListDateBindingsUseCase list,
    UpsertDateBindingUseCase upsert,
    RemoveDateBindingUseCase remove)
    : ControllerBase
{
    [HttpGet("admin/committees/{committeeId:guid}/date-bindings")]
    public async Task<ActionResult<IReadOnlyList<CommitteeDateBindingDto>>> List(
        Guid committeeId, CancellationToken ct)
        => Ok(await list.ExecuteAsync(committeeId, ct));

    [HttpPut("admin/committees/{committeeId:guid}/date-bindings/{boundDate}")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<ActionResult<CommitteeDateBindingDto>> Upsert(
        Guid committeeId, string boundDate,
        [FromBody] UpsertDateBindingRequest request, CancellationToken ct)
    {
        if (!DateOnly.TryParse(boundDate, out var date))
            return BadRequest("تنسيق التاريخ غير صالح");
        var dto = await upsert.ExecuteAsync(committeeId, date, request, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpDelete("admin/committees/{committeeId:guid}/date-bindings/{boundDate}")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<IActionResult> Remove(
        Guid committeeId, string boundDate, CancellationToken ct)
    {
        if (!DateOnly.TryParse(boundDate, out var date))
            return BadRequest("تنسيق التاريخ غير صالح");
        var ok = await remove.ExecuteAsync(committeeId, date, ct);
        return ok ? NoContent() : NotFound();
    }
}
