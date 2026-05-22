using System.Text;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using PACademy.Admin.Api.Modules.AdminRecords;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("")]
public sealed class AuditController(AdminRecordsService records) : ControllerBase
{
    [HttpGet("api/audit")]
    [HttpGet("api/v1/audit")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> List(CancellationToken ct) => Ok(await records.ListAsync("audit", ct));

    [HttpGet("api/audit/export")]
    public FileResult Export()
    {
        var bytes = Encoding.UTF8.GetBytes("id,module,action,entity,createdAt\n");
        return File(bytes, "text/csv; charset=utf-8", "audit.csv");
    }

    [HttpGet("api/audit/entity-types")]
    public async Task<ActionResult<IReadOnlyList<string>>> EntityTypes(CancellationToken ct) =>
        Ok((await records.ListAsync("audit", ct)).Select(x => AdminRecordJson.StringProp(x, "entityType") ?? AdminRecordJson.StringProp(x, "entity")).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToList());

    [HttpGet("api/audit/modules")]
    public async Task<ActionResult<IReadOnlyList<string>>> Modules(CancellationToken ct) =>
        Ok((await records.ListAsync("audit", ct)).Select(x => AdminRecordJson.StringProp(x, "module")).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToList());

    [HttpGet("api/audit/roles")]
    public async Task<ActionResult<IReadOnlyList<string>>> Roles(CancellationToken ct) =>
        Ok((await records.ListAsync("audit", ct)).Select(x => AdminRecordJson.StringProp(x, "role")).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToList());

    [HttpGet("api/audit/users")]
    public async Task<ActionResult<IReadOnlyList<string>>> Users(CancellationToken ct) =>
        Ok((await records.ListAsync("audit", ct)).Select(x => AdminRecordJson.StringProp(x, "userName")).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToList());

    [HttpGet("api/audit/{id}")]
    public async Task<ActionResult<JsonObject?>> Get(string id, CancellationToken ct)
    {
        var row = await records.GetAsync("audit", id, ct);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpGet("api/audit/{id}/diff")]
    public ActionResult<object> Diff(string id) => Ok(new { before = (object?)null, after = (object?)null });
}
