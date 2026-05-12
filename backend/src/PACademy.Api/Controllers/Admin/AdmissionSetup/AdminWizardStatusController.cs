using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PACademy.Modules.Admissions.Application.Admin.WizardStatus;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;

namespace PACademy.Api.Controllers.Admin.AdmissionSetup;

[ApiController]
[Route("admin/admission-setup/cycles/{cycleId:guid}")]
[Authorize(Policy = "admission-setup:read")]
public sealed class AdminWizardStatusController(
    GetWizardStepStatusesUseCase getStatuses,
    CompleteWizardStepUseCase complete,
    ReopenWizardStepUseCase reopen,
    AutoPromoteWizardStepUseCase autoPromote)
    : ControllerBase
{
    [HttpGet("step-statuses")]
    public async Task<ActionResult<IReadOnlyList<WizardStepStatusDto>>> GetStatuses(
        Guid cycleId, CancellationToken ct)
        => Ok(await getStatuses.ExecuteAsync(cycleId, ct));

    [HttpPost("steps/{stepKey}/complete")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<ActionResult<WizardStepStatusDto>> Complete(
        Guid cycleId, string stepKey, CancellationToken ct)
        => Ok(await complete.ExecuteAsync(cycleId, stepKey, ct));

    [HttpPost("steps/{stepKey}/reopen")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<ActionResult<WizardStepStatusDto>> Reopen(
        Guid cycleId, string stepKey, CancellationToken ct)
    {
        var dto = await reopen.ExecuteAsync(cycleId, stepKey, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    /// <summary>
    /// Cross-spec auto-promote (spec 009 T047a). Idempotently flips a step's
    /// pill from <c>not_started</c> to <c>in_progress</c>. Called by spec 011's
    /// frontend service on first save per cycle because spec 011's tables live
    /// in a different DbContext than the wizard interceptor watches.
    /// </summary>
    [HttpPost("steps/{stepKey}/auto-promote")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<ActionResult<WizardStepStatusDto>> AutoPromote(
        Guid cycleId, string stepKey, CancellationToken ct)
        => Ok(await autoPromote.ExecuteAsync(cycleId, stepKey, ct));
}
