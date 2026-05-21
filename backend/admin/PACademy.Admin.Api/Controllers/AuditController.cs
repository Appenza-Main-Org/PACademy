using System.Text;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using PACademy.Admin.Api.Modules.AdminRecords;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("api/audit")]
public sealed class AuditController(AdminRecordsService records) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> List(CancellationToken ct) => Ok(await records.ListAsync("audit", ct));

    [HttpGet("export")]
    public FileResult Export()
    {
        var bytes = Encoding.UTF8.GetBytes("id,module,action,entity,createdAt\n");
        return File(bytes, "text/csv; charset=utf-8", "audit.csv");
    }

    [HttpGet("entity-types")]
    public async Task<ActionResult<IReadOnlyList<string>>> EntityTypes(CancellationToken ct) =>
        Ok((await records.ListAsync("audit", ct)).Select(x => AdminRecordJson.StringProp(x, "entityType") ?? AdminRecordJson.StringProp(x, "entity")).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToList());

    [HttpGet("modules")]
    public async Task<ActionResult<IReadOnlyList<string>>> Modules(CancellationToken ct) =>
        Ok((await records.ListAsync("audit", ct)).Select(x => AdminRecordJson.StringProp(x, "module")).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToList());

    [HttpGet("roles")]
    public ActionResult<IReadOnlyList<string>> Roles() => Ok(Array.Empty<string>());

    [HttpGet("users")]
    public async Task<ActionResult<IReadOnlyList<string>>> Users(CancellationToken ct) =>
        Ok((await records.ListAsync("audit", ct)).Select(x => AdminRecordJson.StringProp(x, "userName")).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToList());

    [HttpGet("{id}")]
    public async Task<ActionResult<JsonObject?>> Get(string id, CancellationToken ct)
    {
        var row = await records.GetAsync("audit", id, ct);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpGet("{id}/diff")]
    public ActionResult<object> Diff(string id) => Ok(new { before = (object?)null, after = (object?)null });
}
