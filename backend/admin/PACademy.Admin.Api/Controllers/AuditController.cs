using System.Text;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Modules.Audit;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("")]
public sealed class AuditController(AdminRecordsService records, IAuditDbContext auditDb) : ControllerBase
{
    [HttpGet("api/audit")]
    [HttpGet("api/v1/audit")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> List(CancellationToken ct) => Ok(await AuditRowsAsync(ct));

    [HttpGet("api/audit/export")]
    public async Task<FileResult> Export(CancellationToken ct)
    {
        var rows = await AuditRowsAsync(ct);
        var csv = new StringBuilder("id,module,action,entity,createdAt\n");
        foreach (var row in rows)
        {
            csv.Append(AdminRecordJson.StringProp(row, "id")).Append(',')
                .Append(AdminRecordJson.StringProp(row, "module")).Append(',')
                .Append(AdminRecordJson.StringProp(row, "action")).Append(',')
                .Append(AdminRecordJson.StringProp(row, "entity")).Append(',')
                .Append(AdminRecordJson.StringProp(row, "createdAt") ?? AdminRecordJson.StringProp(row, "timestamp")).Append('\n');
        }
        var bytes = Encoding.UTF8.GetBytes(csv.ToString());
        return File(bytes, "text/csv; charset=utf-8", "audit.csv");
    }

    [HttpGet("api/audit/entity-types")]
    public async Task<ActionResult<IReadOnlyList<string>>> EntityTypes(CancellationToken ct) =>
        Ok((await AuditRowsAsync(ct)).Select(x => AdminRecordJson.StringProp(x, "entityType") ?? AdminRecordJson.StringProp(x, "entity")).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToList());

    [HttpGet("api/audit/modules")]
    public async Task<ActionResult<IReadOnlyList<string>>> Modules(CancellationToken ct) =>
        Ok((await AuditRowsAsync(ct)).Select(x => AdminRecordJson.StringProp(x, "module")).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToList());

    [HttpGet("api/audit/roles")]
    public async Task<ActionResult<IReadOnlyList<string>>> Roles(CancellationToken ct) =>
        Ok((await AuditRowsAsync(ct)).Select(x => AdminRecordJson.StringProp(x, "role")).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToList());

    [HttpGet("api/audit/users")]
    public async Task<ActionResult<IReadOnlyList<string>>> Users(CancellationToken ct) =>
        Ok((await AuditRowsAsync(ct)).Select(x => AdminRecordJson.StringProp(x, "userName")).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToList());

    [HttpGet("api/audit/{id}")]
    public async Task<ActionResult<JsonObject?>> Get(string id, CancellationToken ct)
    {
        var row = await records.GetAsync("audit", id, ct);
        if (row is not null) return Ok(row);
        var durable = await auditDb.AuditRows.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return durable is null ? NotFound() : Ok(ToJson(durable));
    }

    [HttpGet("api/audit/{id}/diff")]
    public async Task<ActionResult<object>> Diff(string id, CancellationToken ct)
    {
        var row = await Get(id, ct);
        return row.Result is NotFoundResult ? NotFound() : Ok(new { before = (object?)null, after = row.Value });
    }

    private async Task<IReadOnlyList<JsonObject>> AuditRowsAsync(CancellationToken ct)
    {
        var legacy = await records.ListAsync("audit", ct);
        var durable = await auditDb.AuditRows.AsNoTracking().OrderByDescending(x => x.CreatedAt).Take(500).ToListAsync(ct);
        return legacy.Concat(durable.Select(ToJson))
            .OrderByDescending(x => Timestamp(x))
            .ToList();
    }

    private static JsonObject ToJson(AuditRowEntity row) => new()
    {
        ["id"] = row.Id,
        ["userId"] = row.ActorUserId,
        ["userName"] = row.ActorName,
        ["role"] = "system",
        ["module"] = row.Module,
        ["action"] = row.Action,
        ["actionLabel"] = row.Action,
        ["actionColor"] = row.Action.Contains("delete", StringComparison.OrdinalIgnoreCase) ? "danger" : "info",
        ["entity"] = row.Entity,
        ["entityType"] = row.Entity,
        ["entityId"] = row.EntityId,
        ["details"] = row.Details,
        ["timestamp"] = row.CreatedAt.ToUnixTimeMilliseconds(),
        ["createdAt"] = row.CreatedAt.ToString("O"),
        ["ip"] = ""
    };

    private static long Timestamp(JsonObject row)
    {
        if (!row.TryGetPropertyValue("timestamp", out var node) || node is null) return 0;
        try
        {
            return node.GetValue<long>();
        }
        catch (InvalidOperationException)
        {
            return (long)node.GetValue<double>();
        }
    }
}
