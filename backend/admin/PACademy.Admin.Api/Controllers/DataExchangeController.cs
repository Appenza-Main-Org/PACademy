using System.Globalization;
using Microsoft.AspNetCore.Mvc;
using PACademy.Admin.Api.Infrastructure;
using PACademy.Admin.Api.Modules.DataExchangeAdmin;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Controllers;

/// <summary>
/// Centralized Data-Exchange hub. Export/import Excel across the 9 exchangeable
/// domains with row-level change-detection + a no-duplicate-key guarantee.
///
/// INTEGRATION CONTRACT (mirrored by frontend `dataExchange.service.ts`):
///   GET  /api/admin/data-exchange/export?type=&layout=&filter=&changedAfter=
///   POST /api/admin/data-exchange/import/preview
///   POST /api/admin/data-exchange/import/apply
///   GET  /api/admin/data-exchange/history
///   GET  /api/admin/data-exchange/templates/{type}
/// </summary>
[ApiController]
[Route("api/admin/data-exchange")]
[RequireBearerAuth]
public sealed class DataExchangeController(DataExchangeService service) : ControllerBase
{
    [HttpGet("export")]
    public async Task<ActionResult<ExportResultDto>> Export(
        [FromQuery] string? type,
        [FromQuery] string? layout,
        [FromQuery] string? filter,
        [FromQuery] string? changedAfter,
        CancellationToken ct)
    {
        if (!TryResolveDomains(type, out var domains, out var unknown))
            return Conflict(new { code = ErrorCodes.DataExchangeUnknownDomain, message = $"نطاق غير معروف: {unknown}" });

        var exportFilter = ResolveFilter(filter, changedAfter, ct);
        var resolvedLayout = string.Equals(layout, "file-per-type", StringComparison.OrdinalIgnoreCase)
            ? "file-per-type" : "single-workbook";

        var result = await service.ExportAsync(domains, resolvedLayout, exportFilter, ct);
        return Ok(result);
    }

    [HttpPost("import/preview")]
    public async Task<ActionResult<ImportPreviewResult>> Preview([FromBody] ImportPreviewRequest body, CancellationToken ct)
    {
        if (body?.Sheets is null || body.Sheets.Count == 0)
            return BadRequest(new { code = ErrorCodes.ValidationFailed, message = "لا توجد أوراق للمعاينة." });
        return Ok(await service.PreviewAsync(body, ct));
    }

    [HttpPost("import/apply")]
    public async Task<ActionResult<ImportApplyResult>> Apply([FromBody] ImportApplyRequest body, CancellationToken ct)
    {
        if (body?.Sheets is null || body.Sheets.Count == 0)
            return BadRequest(new { code = ErrorCodes.ValidationFailed, message = "لا توجد أوراق للتطبيق." });
        if (body.Mode is not ("new-only" or "new-and-changed"))
            return BadRequest(new { code = ErrorCodes.ValidationFailed, errors = new { mode = "وضع غير صالح" }, message = "وضع التطبيق غير صالح." });
        return Ok(await service.ApplyAsync(body, ct));
    }

    [HttpGet("history")]
    public async Task<ActionResult<IReadOnlyList<HistoryEntryDto>>> History(CancellationToken ct)
        => Ok(await service.HistoryAsync(ct));

    [HttpGet("templates/{type}")]
    public ActionResult<TemplateDto> Template(string type)
    {
        if (!DataExchangeRegistry.TryParseDomain(type, out var spec))
            return Conflict(new { code = ErrorCodes.DataExchangeUnknownDomain, message = $"نطاق غير معروف: {type}" });
        return Ok(service.Template(spec));
    }

    // ── helpers ──────────────────────────────────────────────────────────
    private static bool TryResolveDomains(string? type, out List<ExchangeDomain> domains, out string? unknown)
    {
        domains = [];
        unknown = null;
        if (string.IsNullOrWhiteSpace(type) || string.Equals(type, "all", StringComparison.OrdinalIgnoreCase))
        {
            domains = DataExchangeRegistry.All.Select(d => d.Domain).ToList();
            return true;
        }
        foreach (var token in type.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (!DataExchangeRegistry.TryParseDomain(token, out var spec)) { unknown = token; return false; }
            domains.Add(spec.Domain);
        }
        return domains.Count > 0;
    }

    private ExportFilter ResolveFilter(string? filter, string? changedAfter, CancellationToken ct) => filter switch
    {
        "changedAfter" when DateTimeOffset.TryParse(changedAfter, CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.RoundtripKind, out var d)
            => new ExportFilter(ExportFilterKind.ChangedAfter, d, null),
        "modifiedSinceCreation" => new ExportFilter(ExportFilterKind.ModifiedSinceCreation, null, null),
        "sinceLastExport" => new ExportFilter(ExportFilterKind.SinceLastExport, null, service.LastExportWatermark(ct)),
        _ => ExportFilter.Default,
    };
}
