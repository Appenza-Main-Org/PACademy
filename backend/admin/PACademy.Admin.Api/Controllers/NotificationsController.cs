using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using PACademy.Admin.Api.Modules.AdminRecords;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("")]
public sealed class NotificationsController(AdminRecordsService records) : ControllerBase
{
    [HttpGet("api/admin/notifications")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> List(CancellationToken ct) => Ok(await records.ListAsync("notifications", ct));

    [HttpGet("api/admin/notifications/{id}")]
    public async Task<ActionResult<JsonObject?>> Get(string id, CancellationToken ct)
    {
        var row = await records.GetAsync("notifications", id, ct);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost("api/admin/notifications")]
    public async Task<ActionResult<JsonObject>> Create([FromBody] JsonObject body, CancellationToken ct)
    {
        var id = $"AN-{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";
        body["id"] = id;
        return Ok(await records.UpsertAsync("notifications", id, body, ct));
    }

    [HttpPatch("api/admin/notifications/{id}")]
    public async Task<ActionResult<JsonObject>> Update(string id, [FromBody] JsonObject body, CancellationToken ct) =>
        Ok(await records.UpsertAsync("notifications", id, body, ct));

    [HttpPost("api/admin/notifications/{id}/publish")]
    [HttpPost("api/admin/notifications/{id}/unpublish")]
    [HttpPost("api/admin/notifications/{id}/soft-delete")]
    [HttpPost("api/admin/notifications/{id}/restore")]
    public async Task<ActionResult<JsonObject>> Action(string id, CancellationToken ct) => Ok(await records.UpsertAsync("notifications", id, [], ct));

    [HttpGet("api/applicants/{applicantId}/notifications")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> ForApplicant(string applicantId, CancellationToken ct) => Ok(await records.ListAsync("notifications", ct));
}
