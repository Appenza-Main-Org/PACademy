using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PACademy.Modules.Admissions.Application.Admin.TotalScore;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;

namespace PACademy.Api.Controllers.Admin.AdmissionSetup;

[ApiController]
[Route("admin/admission-setup/cycles/{cycleId:guid}/total-score")]
[Authorize(Policy = "admission-setup:read")]
public sealed class AdminTotalScoreConfigController(
    ListTotalScoreConfigsUseCase list,
    GetTotalScoreConfigUseCase get,
    UpsertTotalScoreConfigUseCase upsert)
    : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TotalScoreConfigDto>>> List(
        Guid cycleId, CancellationToken ct)
        => Ok(await list.ExecuteAsync(cycleId, ct));

    [HttpGet("{stream}")]
    public async Task<ActionResult<TotalScoreConfigDto>> Get(
        Guid cycleId, string stream, CancellationToken ct)
    {
        var dto = await get.ExecuteAsync(cycleId, stream, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPut("{stream}")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<ActionResult<TotalScoreConfigDto>> Upsert(
        Guid cycleId, string stream,
        [FromBody] UpsertTotalScoreConfigRequest request, CancellationToken ct)
        => Ok(await upsert.ExecuteAsync(cycleId, stream, request, ct));
}
