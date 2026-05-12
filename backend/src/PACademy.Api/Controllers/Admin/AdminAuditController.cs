using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PACademy.Shared.Audit.Domain;
using PACademy.Shared.Audit.Infrastructure.Persistence;

namespace PACademy.Api.Controllers.Admin;

/// <summary>
/// Read-only audit trail API consumed by /admin/audit on the frontend.
/// Audit is append-only — no PUT/DELETE; the IAuditApi.RecordAsync interface
/// is the only write surface (called from use cases and middleware).
///
/// Maps the backend AuditEntry shape to the frontend AuditEntry shape
/// (camelCase, snake_case action names, ISO-string timestamps).
/// </summary>
[ApiController]
[Route("admin/audit")]
[Authorize(Policy = "*")] // audit visibility is super-admin-only by design
public sealed class AdminAuditController(AuditDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AuditEntryDto>>> List(
        [FromQuery] string? action = null,
        [FromQuery] string? entityType = null,
        [FromQuery] Guid? userId = null,
        [FromQuery] long? since = null,
        [FromQuery] long? until = null,
        [FromQuery] int limit = 100,
        CancellationToken ct = default)
    {
        IQueryable<AuditEntry> query = db.AuditEntries.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(action) && action != "all" &&
            Enum.TryParse<AuditAction>(action, ignoreCase: true, out var actionEnum))
            query = query.Where(e => e.Action == actionEnum);

        if (!string.IsNullOrWhiteSpace(entityType))
            query = query.Where(e => e.TargetType == entityType);

        if (userId.HasValue)
            query = query.Where(e => e.ActorId == userId.Value);

        if (since.HasValue)
        {
            var sinceUtc = DateTimeOffset.FromUnixTimeMilliseconds(since.Value).UtcDateTime;
            query = query.Where(e => e.OccurredAt >= sinceUtc);
        }

        if (until.HasValue)
        {
            var untilUtc = DateTimeOffset.FromUnixTimeMilliseconds(until.Value).UtcDateTime;
            query = query.Where(e => e.OccurredAt <= untilUtc);
        }

        var rows = await query
            .OrderByDescending(e => e.OccurredAt)
            .Take(Math.Clamp(limit, 1, 1000))
            .ToListAsync(ct);

        return Ok(rows.Select(ToDto).ToList());
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AuditEntryDto>> GetById(Guid id, CancellationToken ct)
    {
        var entry = await db.AuditEntries.AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == id, ct);
        return entry is null ? NotFound() : Ok(ToDto(entry));
    }

    [HttpGet("entity-types")]
    public async Task<ActionResult<IReadOnlyList<string>>> EntityTypes(CancellationToken ct)
    {
        var types = await db.AuditEntries.AsNoTracking()
            .Select(e => e.TargetType)
            .Distinct()
            .OrderBy(t => t)
            .ToListAsync(ct);
        return Ok(types);
    }

    [HttpGet("modules")]
    public ActionResult<IReadOnlyList<string>> Modules()
    {
        /* Backend's AuditEntry doesn't carry a module column — the module
         * taxonomy is a frontend-side classification. Return the union of
         * known module strings so the filter dropdown is populated. */
        return Ok(new[]
        {
            "admin", "auth", "cycles", "categories", "committees",
            "lookups", "exams", "payments", "notifications", "roles",
            "users", "workflows", "applicants",
        });
    }

    private static AuditEntryDto ToDto(AuditEntry e) => new()
    {
        Id = e.Id.ToString(),
        UserId = e.ActorId.ToString(),
        UserName = e.ActorName,
        Action = e.Action.ToString().ToLowerInvariant(),
        ActionLabel = ArabicActionLabel(e.Action),
        ActionColor = ActionColor(e.Action),
        Entity = e.TargetLabel,
        EntityType = e.TargetType,
        EntityId = e.TargetId.ToString(),
        Details = e.TargetLabel,
        Before = string.IsNullOrEmpty(e.BeforeJson) ? null : e.BeforeJson,
        After = string.IsNullOrEmpty(e.AfterJson) ? null : e.AfterJson,
        Timestamp = new DateTimeOffset(DateTime.SpecifyKind(e.OccurredAt, DateTimeKind.Utc)).ToUnixTimeMilliseconds(),
        At = e.OccurredAt.ToString("o"),
        Ip = string.IsNullOrEmpty(e.ActorIp) ? "0.0.0.0" : e.ActorIp,
    };

    private static string ArabicActionLabel(AuditAction action) => action switch
    {
        AuditAction.Create => "إنشاء",
        AuditAction.Update => "تعديل",
        AuditAction.Delete => "حذف",
        AuditAction.Activate => "تفعيل",
        AuditAction.Deactivate => "إيقاف",
        AuditAction.Login => "تسجيل دخول",
        AuditAction.Logout => "تسجيل خروج",
        AuditAction.BulkImport => "استيراد جماعي",
        AuditAction.StatusChange => "تغيير الحالة",
        AuditAction.PermissionDenied => "صلاحية مرفوضة",
        AuditAction.Archive => "أرشفة",
        AuditAction.View => "اطلاع",
        AuditAction.Export => "تصدير",
        AuditAction.RequestOtp => "طلب رمز تحقق",
        AuditAction.VerifyOtpSuccess => "تحقق ناجح",
        AuditAction.VerifyOtpFailed => "تحقق فاشل",
        AuditAction.AccountLocked => "إيقاف الحساب",
        AuditAction.LockoutAutoCleared => "إعادة تفعيل تلقائي",
        AuditAction.ManualUnlock => "إعادة تفعيل يدوي",
        AuditAction.LockPolicyUpdated => "تعديل سياسة الإيقاف",
        AuditAction.OfficerLookedUp => "استعلام عن ضابط",
        _ => action.ToString(),
    };

    private static string ActionColor(AuditAction action) => action switch
    {
        AuditAction.Create or AuditAction.Activate or AuditAction.VerifyOtpSuccess or AuditAction.ManualUnlock => "success",
        AuditAction.Update or AuditAction.StatusChange or AuditAction.LockPolicyUpdated => "info",
        AuditAction.Delete or AuditAction.PermissionDenied or AuditAction.VerifyOtpFailed or AuditAction.AccountLocked => "danger",
        AuditAction.Deactivate or AuditAction.Archive or AuditAction.BulkImport or AuditAction.Export => "warning",
        _ => "neutral",
    };
}

public sealed class AuditEntryDto
{
    public string Id { get; init; } = string.Empty;
    public string UserId { get; init; } = string.Empty;
    public string UserName { get; init; } = string.Empty;
    public string Action { get; init; } = string.Empty;
    public string ActionLabel { get; init; } = string.Empty;
    public string ActionColor { get; init; } = string.Empty;
    public string Entity { get; init; } = string.Empty;
    public string EntityType { get; init; } = string.Empty;
    public string EntityId { get; init; } = string.Empty;
    public string Details { get; init; } = string.Empty;
    public string? Before { get; init; }
    public string? After { get; init; }
    public long Timestamp { get; init; }
    public string At { get; init; } = string.Empty;
    public string Ip { get; init; } = string.Empty;
}
