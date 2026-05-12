using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PACademy.Modules.Admissions.Application.Admin.ElectronicDeclaration;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;

namespace PACademy.Api.Controllers.Admin.AdmissionSetup;

[ApiController]
[Authorize(Policy = "admission-setup:read")]
public sealed class AdminElectronicDeclarationController(
    GetPublishedDeclarationUseCase getPublished,
    ListDeclarationVersionsUseCase listVersions,
    CreateDeclarationDraftUseCase createDraft,
    UpdateDeclarationUseCase update,
    PublishDeclarationUseCase publish,
    ArchiveDeclarationUseCase archive)
    : ControllerBase
{
    [HttpGet("admin/admission-setup/cycles/{cycleId:guid}/declaration")]
    public async Task<ActionResult<ElectronicDeclarationDto?>> GetPublished(
        Guid cycleId, CancellationToken ct)
        => Ok(await getPublished.ExecuteAsync(cycleId, ct));

    [HttpGet("admin/admission-setup/cycles/{cycleId:guid}/declaration/versions")]
    public async Task<ActionResult<IReadOnlyList<ElectronicDeclarationDto>>> ListVersions(
        Guid cycleId, CancellationToken ct)
        => Ok(await listVersions.ExecuteAsync(cycleId, ct));

    [HttpPost("admin/admission-setup/cycles/{cycleId:guid}/declaration")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<ActionResult<ElectronicDeclarationDto>> CreateDraft(
        Guid cycleId, [FromBody] CreateDeclarationRequest request, CancellationToken ct)
    {
        var dto = await createDraft.ExecuteAsync(cycleId, request, ct);
        return StatusCode(201, dto);
    }

    [HttpPatch("admin/admission-setup/declaration/{id:guid}")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<ActionResult<ElectronicDeclarationDto>> Update(
        Guid id, [FromBody] UpdateDeclarationRequest request, CancellationToken ct)
    {
        var dto = await update.ExecuteAsync(id, request, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost("admin/admission-setup/declaration/{id:guid}/publish")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<ActionResult<ElectronicDeclarationDto>> Publish(
        Guid id, CancellationToken ct)
    {
        var dto = await publish.ExecuteAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost("admin/admission-setup/declaration/{id:guid}/archive")]
    [Authorize(Policy = "*")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken ct)
    {
        var ok = await archive.ExecuteAsync(id, ct);
        return ok ? NoContent() : NotFound();
    }
}
