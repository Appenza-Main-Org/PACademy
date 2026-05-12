using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PACademy.Modules.Admissions.Application.Admin.ScoreThresholds;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;

namespace PACademy.Api.Controllers.Admin.AdmissionSetup;

[ApiController]
[Route("admin/admission-setup/cycles/{cycleId:guid}")]
[Authorize(Policy = "admission-setup:read")]
public sealed class AdminCommitteeScoreThresholdsController(
    ListScoreThresholdsUseCase list,
    GetScoreThresholdUseCase get,
    UpsertScoreThresholdUseCase upsert)
    : ControllerBase
{
    [HttpGet("score-thresholds")]
    public async Task<ActionResult<IReadOnlyList<CommitteeScoreThresholdDto>>> List(
        Guid cycleId, CancellationToken ct)
        => Ok(await list.ExecuteAsync(cycleId, ct));

    [HttpGet("committees/{committeeId:guid}/score-threshold")]
    public async Task<ActionResult<CommitteeScoreThresholdDto>> Get(
        Guid cycleId, Guid committeeId, CancellationToken ct)
    {
        var dto = await get.ExecuteAsync(cycleId, committeeId, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPut("committees/{committeeId:guid}/score-threshold")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<ActionResult<CommitteeScoreThresholdDto>> Upsert(
        Guid cycleId, Guid committeeId,
        [FromBody] UpsertScoreThresholdRequest request, CancellationToken ct)
        => Ok(await upsert.ExecuteAsync(cycleId, committeeId, request, ct));
}
