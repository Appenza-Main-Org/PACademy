using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using PACademy.Admin.Api.Infrastructure;
using PACademy.Admin.Api.Modules.Biometric;

namespace PACademy.Admin.Api.Controllers;

/// <summary>
/// Biometric Registration &amp; Inquiry REST surface (BRD §5). Mirrors the
/// INTEGRATION CONTRACT in
/// <c>frontend/src/features/biometric/api/biometric.service.ts</c>.
/// </summary>
[ApiController]
[Route("")]
public sealed class BiometricController(BiometricService service) : ControllerBase
{
    [HttpGet("api/biometric/applicants/search")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> Search(
        [FromQuery] string field,
        [FromQuery] string? q,
        CancellationToken ct)
        => Ok(await service.SearchApplicantsAsync(field, q ?? "", ct));

    [HttpGet("api/biometric/applicants/lookup")]
    public async Task<ActionResult<JsonObject>> Lookup(
        [FromQuery] string? applicantId,
        [FromQuery] string? nationalId,
        [FromQuery] string? barcode,
        CancellationToken ct)
    {
        var row = await service.GetApplicantAsync(applicantId, nationalId, barcode, ct);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost("api/biometric/enroll")]
    [RequireBearerAuth]
    public async Task<ActionResult<JsonObject>> Enroll([FromBody] JsonObject input, CancellationToken ct)
        => Ok(await service.EnrollAsync(input, ct));

    [HttpPost("api/biometric/verify")]
    [RequireBearerAuth]
    public async Task<ActionResult<JsonObject>> Verify([FromBody] JsonObject input, CancellationToken ct)
        => Ok(await service.VerifyAsync(input, ct));

    [HttpPost("api/biometric/gate-log")]
    [RequireBearerAuth]
    public async Task<ActionResult<JsonObject>> GateLog([FromBody] JsonObject input, CancellationToken ct)
        => Ok(await service.RecordGateLogAsync(input, ct));

    [HttpGet("api/biometric/verifications")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> Verifications(
        [FromQuery] string? module,
        [FromQuery] bool failedOnly,
        CancellationToken ct)
        => Ok(await service.ListVerificationsAsync(module, failedOnly, ct));

    [HttpGet("api/biometric/gate-logs")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> GateLogs(CancellationToken ct)
        => Ok(await service.ListGateLogsAsync(ct));

    [HttpGet("api/biometric/audit")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> Audit(CancellationToken ct)
        => Ok(await service.ListAuditLogsAsync(ct));

    [HttpGet("api/biometric/reports")]
    public async Task<ActionResult<object>> Reports(CancellationToken ct)
        => Ok(await service.ReportsAsync(ct));

    [HttpGet("api/biometric/monitoring")]
    public async Task<ActionResult<object>> Monitoring(CancellationToken ct)
        => Ok(await service.MonitoringAsync(ct));
}
