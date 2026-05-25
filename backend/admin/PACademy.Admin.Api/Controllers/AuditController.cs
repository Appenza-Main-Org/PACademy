using System.Text;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Modules.Audit;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("")]
public sealed class AuditController(IAuditDbContext auditDb) : ControllerBase
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

    [HttpGet("api/audit/actions")]
    public async Task<ActionResult<IReadOnlyList<AuditActionOption>>> Actions(CancellationToken ct) =>
        Ok((await AuditRowsAsync(ct))
            .Select(x => new AuditActionOption(
                AdminRecordJson.StringProp(x, "action") ?? "",
                AdminRecordJson.StringProp(x, "actionLabel") ?? AdminRecordJson.StringProp(x, "action") ?? "",
                AdminRecordJson.StringProp(x, "actionColor") ?? "neutral"))
            .Where(x => !string.IsNullOrWhiteSpace(x.Action))
            .GroupBy(x => x.Action)
            .Select(g => g.First())
            .OrderBy(x => x.Label)
            .ToList());

    [HttpGet("api/audit/modules")]
    public async Task<ActionResult<IReadOnlyList<string>>> Modules(CancellationToken ct) =>
        Ok((await AuditRowsAsync(ct)).Select(x => AdminRecordJson.StringProp(x, "module")).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToList());

    [HttpGet("api/audit/roles")]
    public async Task<ActionResult<IReadOnlyList<string>>> Roles(CancellationToken ct) =>
        Ok((await AuditRowsAsync(ct)).Select(x => AdminRecordJson.StringProp(x, "role")).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToList());

    [HttpGet("api/audit/users")]
    public async Task<ActionResult<IReadOnlyList<AuditUserOption>>> Users(CancellationToken ct) =>
        Ok((await AuditRowsAsync(ct))
            .Select(x => new AuditUserOption(
                AdminRecordJson.StringProp(x, "userId") ?? AdminRecordJson.StringProp(x, "userName") ?? "",
                AdminRecordJson.StringProp(x, "userName") ?? AdminRecordJson.StringProp(x, "userId") ?? ""))
            .Where(x => !string.IsNullOrWhiteSpace(x.Id) && !string.IsNullOrWhiteSpace(x.Name))
            .GroupBy(x => x.Id)
            .Select(g => g.First())
            .OrderBy(x => x.Name)
            .ToList());

    [HttpGet("api/audit/{id}")]
    public async Task<ActionResult<JsonObject?>> Get(string id, CancellationToken ct)
    {
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
        var durable = await auditDb.AuditRows
            .AsNoTracking()
            .OrderByDescending(x => x.CreatedAt)
            .Take(500)
            .ToListAsync(ct);

        return durable.Select(ToJson)
            .OrderByDescending(x => Timestamp(x))
            .ToList();
    }

    private static JsonObject ToJson(AuditRowEntity row) => new()
    {
        ["id"] = row.Id,
        ["userId"] = row.ActorUserId,
        ["userName"] = row.ActorName,
        ["role"] = row.ActorUserId == "system" ? "system" : "super_admin",
        ["module"] = row.Module,
        ["action"] = row.Action,
        ["actionLabel"] = ActionLabel(row.Action),
        ["actionColor"] = ActionColor(row.Action),
        ["entity"] = row.Entity,
        ["entityType"] = row.Entity,
        ["entityId"] = row.EntityId,
        ["details"] = row.Details,
        ["timestamp"] = row.CreatedAt.ToUnixTimeMilliseconds(),
        ["createdAt"] = row.CreatedAt.ToString("O"),
        ["ip"] = ""
    };

    private static string ActionLabel(string action)
    {
        var normalized = action.Split('.').LastOrDefault() ?? action;
        return normalized switch
        {
            "login" => "تسجيل دخول",
            "create" => "إنشاء سجل",
            "update" => "تحديث سجل",
            "delete" => "حذف سجل",
            "activate" => "تفعيل",
            "transition" => "تغيير حالة",
            "toggle" => "تبديل حالة",
            "bulk_assign" => "تعيين جماعي",
            "bulk_import" => "استيراد جماعي",
            "bulk_save" => "حفظ جماعي",
            "reset_2fa" => "إعادة ضبط التحقق",
            "account_unlocked" => "فتح قفل حساب",
            _ => normalized
        };
    }

    private static string ActionColor(string action)
    {
        var normalized = action.Split('.').LastOrDefault() ?? action;
        if (normalized.Contains("delete", StringComparison.OrdinalIgnoreCase)) return "danger";
        if (normalized.Contains("create", StringComparison.OrdinalIgnoreCase) ||
            normalized.Contains("login", StringComparison.OrdinalIgnoreCase) ||
            normalized.Contains("activate", StringComparison.OrdinalIgnoreCase))
        {
            return "success";
        }
        if (normalized.Contains("reset", StringComparison.OrdinalIgnoreCase) ||
            normalized.Contains("unlock", StringComparison.OrdinalIgnoreCase))
        {
            return "warning";
        }
        return "info";
    }

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

public sealed record AuditActionOption(string Action, string Label, string Color);

public sealed record AuditUserOption(string Id, string Name);
