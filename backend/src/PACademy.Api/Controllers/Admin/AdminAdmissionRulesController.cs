using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PACademy.Application.Admin.AdmissionRules;
using PACademy.Contracts.Admin.AdmissionRules;

namespace PACademy.Api.Controllers.Admin;

/// <summary>
/// Admin Admission Rules — versioned, immutable per cycle. Existing versions
/// cannot be patched or deleted (FR-R01) — POST creates a new version instead.
/// </summary>
[ApiController]
[Route("admin/admission-rules")]
[Authorize(Policy = "*")]
public sealed class AdminAdmissionRulesController(
    ListAdmissionRulesUseCase list,
    GetAdmissionRuleUseCase get,
    CreateAdmissionRuleUseCase create)
    : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<AdmissionRuleListItemDto>>> List(
        [FromQuery] Guid? cycleId = null,
        [FromQuery] bool includeArchived = false,
        CancellationToken ct = default)
    {
        var items = await list.ExecuteAsync(cycleId, includeArchived, ct);
        Response.Headers["X-Total-Count"] = items.Count.ToString();
        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AdmissionRuleDetailDto>> Get(Guid id, CancellationToken ct)
    {
        var dto = await get.ExecuteAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpGet("current")]
    public async Task<ActionResult<AdmissionRuleDetailDto>> GetCurrent(
        [FromQuery] Guid cycleId,
        CancellationToken ct)
    {
        var dto = await get.ExecuteCurrentAsync(cycleId, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost]
    public async Task<ActionResult<AdmissionRuleDetailDto>> Create(
        [FromBody] CreateAdmissionRuleRequest request,
        CancellationToken ct)
    {
        var dto = await create.ExecuteAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = dto.Id }, dto);
    }

    /// <summary>
    /// PATCH on existing versions is forbidden per FR-R01.
    /// </summary>
    [HttpPatch("{id:guid}")]
    public IActionResult PatchRejected(Guid id) =>
        StatusCode(405, new { code = "ADMISSION_RULES_IMMUTABLE", detail = "Existing admission-rule versions are immutable. POST a new version instead." });

    [HttpDelete("{id:guid}")]
    public IActionResult DeleteRejected(Guid id) =>
        StatusCode(405, new { code = "ADMISSION_RULES_IMMUTABLE", detail = "Existing admission-rule versions are immutable." });
}
