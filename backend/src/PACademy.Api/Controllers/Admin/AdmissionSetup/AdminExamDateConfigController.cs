using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PACademy.Modules.Admissions.Application.Admin.ExamDateConfigs;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;

namespace PACademy.Api.Controllers.Admin.AdmissionSetup;

[ApiController]
[Route("admin/admission-setup/cycles/{cycleId:guid}/exam-dates")]
[Authorize(Policy = "admission-setup:read")]
public sealed class AdminExamDateConfigController(
    GetExamDateConfigUseCase get,
    UpsertExamDateConfigUseCase upsert)
    : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ExamDateConfigDto?>> Get(Guid cycleId, CancellationToken ct)
        => Ok(await get.ExecuteAsync(cycleId, ct));

    [HttpPut]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<ActionResult<ExamDateConfigDto>> Upsert(
        Guid cycleId, [FromBody] UpsertExamDateConfigRequest request, CancellationToken ct)
        => Ok(await upsert.ExecuteAsync(cycleId, request, ct));
}
