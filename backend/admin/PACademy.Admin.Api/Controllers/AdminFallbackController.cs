using System.Text;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;

namespace PACademy.Admin.Api.Controllers;

/// <summary>
/// Temporary backend-first fallback for admin modules whose vertical slices are
/// not yet fully ported. It keeps the admin frontend on real HTTP calls while
/// dedicated modules replace each route in Priority B/C.
/// </summary>
[ApiController]
[Route("")]
public sealed class AdminFallbackController : ControllerBase
{
    [HttpGet("api/auth/me")]
    public ActionResult<object> Me() => Ok(new { authenticated = true });

    [HttpGet("api/auth/lock-policy")]
    public ActionResult<object> LockPolicy() => Ok(new { maxAttempts = 5, lockMinutes = 30, otpRequired = false });

    [HttpGet("api/auth/lock-policy/locked-users")]
    public ActionResult<IReadOnlyList<object>> LockedUsers() => Ok(Array.Empty<object>());

    [HttpPost("api/auth/{**path}")]
    public ActionResult<object> AuthPost(string path, [FromBody] JsonObject? body) => Ok(body ?? new JsonObject { ["ok"] = true });

    [HttpPatch("api/auth/{**path}")]
    public ActionResult<object> AuthPatch(string path, [FromBody] JsonObject? body) => Ok(body ?? new JsonObject { ["ok"] = true });

    [HttpGet("api/admin/reports/{kind}")]
    public ActionResult<object> Reports(string kind) => Ok(kind switch
    {
        "cycle-snapshot" => new { kpis = Array.Empty<object>(), categories = Array.Empty<object>(), range = "today" },
        "funnel" => new { stages = Array.Empty<object>() },
        "by-department" => new { departments = Array.Empty<object>() },
        "test-results" => new { rows = Array.Empty<object>(), heatmap = Array.Empty<object>() },
        "operational-status" => new { cards = Array.Empty<object>() },
        "governance" => new { anomalies = Array.Empty<object>(), audit = Array.Empty<object>() },
        "integrations" => new { systems = Array.Empty<object>() },
        _ => new { items = Array.Empty<object>() }
    });

    [HttpGet("api/audit")]
    public ActionResult<object> AuditList() => Ok(new { items = Array.Empty<object>(), page = 1, pageSize = 25, total = 0 });

    [HttpGet("api/audit/export")]
    public FileResult AuditExport()
    {
        var bytes = Encoding.UTF8.GetBytes("id,module,action,entity,createdAt\n");
        return File(bytes, "text/csv; charset=utf-8", "audit.csv");
    }

    [HttpGet("api/audit/{**path}")]
    public ActionResult<object> AuditGet(string path) => Ok(path switch
    {
        "entity-types" => Array.Empty<string>(),
        "modules" => Array.Empty<string>(),
        "roles" => Array.Empty<string>(),
        "users" => Array.Empty<string>(),
        _ when path.EndsWith("/diff", StringComparison.Ordinal) => new { before = (object?)null, after = (object?)null },
        _ => new { id = path }
    });

    [HttpGet("api/{**path}")]
    public ActionResult<object> Get(string path)
    {
        if (path.EndsWith("/stats", StringComparison.Ordinal)) return Ok(new { });
        if (path.EndsWith("/distribution", StringComparison.Ordinal)) return Ok(Array.Empty<object>());
        if (path.Contains("check-nid", StringComparison.Ordinal)) return Ok(new { exists = false });
        if (path.Contains("settings", StringComparison.Ordinal)) return Ok(new { });
        if (path.Contains("payments", StringComparison.Ordinal)) return Ok(Array.Empty<object>());
        if (path.Contains("notifications", StringComparison.Ordinal)) return Ok(Array.Empty<object>());
        if (path.Contains("roles", StringComparison.Ordinal)) return Ok(Array.Empty<object>());
        if (path.Contains("users", StringComparison.Ordinal)) return Ok(Array.Empty<object>());
        if (path.Contains("workflows", StringComparison.Ordinal)) return Ok(Array.Empty<object>());
        if (path.Contains("applicants", StringComparison.Ordinal)) return Ok(new { items = Array.Empty<object>(), page = 1, pageSize = 25, total = 0 });
        if (path.Contains("grades", StringComparison.Ordinal)) return Ok(Array.Empty<object>());
        if (path.Contains("committee", StringComparison.Ordinal)) return Ok(Array.Empty<object>());
        return Ok(new { items = Array.Empty<object>(), path });
    }

    [HttpPost("api/{**path}")]
    public ActionResult<object> Post(string path, [FromBody] JsonObject? body) => Ok(body ?? new JsonObject { ["ok"] = true });

    [HttpPut("api/{**path}")]
    public ActionResult<object> Put(string path, [FromBody] JsonObject? body) => Ok(body ?? new JsonObject { ["ok"] = true });

    [HttpPatch("api/{**path}")]
    public ActionResult<object> Patch(string path, [FromBody] JsonObject? body) => Ok(body ?? new JsonObject { ["ok"] = true });

    [HttpDelete("api/{**path}")]
    public ActionResult<object> Delete(string path) => Ok(new { deleted = true });

    [HttpGet("v1/{**path}")]
    public ActionResult<object> V1Get(string path) =>
        path.Contains("check-nid", StringComparison.Ordinal)
            ? Ok(new { exists = false })
            : Ok(new { items = Array.Empty<object>(), path });

    [HttpPost("v1/{**path}")]
    public ActionResult<object> V1Post(string path, [FromBody] JsonObject? body) => Ok(body ?? new JsonObject { ["ok"] = true });

    [HttpPut("v1/{**path}")]
    public ActionResult<object> V1Put(string path, [FromBody] JsonObject? body) => Ok(body ?? new JsonObject { ["ok"] = true });
}
