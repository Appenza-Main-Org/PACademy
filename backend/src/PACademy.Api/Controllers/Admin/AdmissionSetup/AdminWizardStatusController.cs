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
    ReopenWizardStepUseCase reopen)
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
}
