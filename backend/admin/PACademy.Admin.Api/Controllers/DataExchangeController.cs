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
///   GET  /api/admin/data-exchange/export?type=&layout=&filter=&changedAfter=&nationalIds=
///   GET  /api/admin/data-exchange/applicants/roster
///   POST /api/admin/data-exchange/applicants/reconcile/preview
///   POST /api/admin/data-exchange/applicants/reconcile/commit
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
        [FromQuery] string? nationalIds,
        CancellationToken ct)
    {
        if (!TryResolveDomains(type, out var domains, out var unknown))
            return Conflict(new { code = ErrorCodes.DataExchangeUnknownDomain, message = $"نطاق غير معروف: {unknown}" });

        var exportFilter = ResolveFilter(filter, changedAfter, ct) with { NationalIds = ParseNationalIds(nationalIds) };
        var resolvedLayout = string.Equals(layout, "file-per-type", StringComparison.OrdinalIgnoreCase)
            ? "file-per-type" : "single-workbook";

        var result = await service.ExportAsync(domains, resolvedLayout, exportFilter, ct);
        return Ok(result);
    }

    [HttpGet("applicants/roster")]
    public async Task<ActionResult<IReadOnlyList<ApplicantRosterRow>>> Roster(CancellationToken ct)
        => Ok(await service.ListBookedApplicantsAsync(ct));

    [HttpPost("applicants/reconcile/preview")]
    public async Task<ActionResult<ApplicantReconciliationPreview>> ReconcilePreview(
        [FromBody] ImportSheetInput body, CancellationToken ct)
    {
        if (body?.Rows is null || body.Rows.Count == 0)
            return BadRequest(new { code = ErrorCodes.ValidationFailed, message = "لا توجد صفوف للمعاينة." });
        if (!string.Equals(body.SheetName, "Applicants", StringComparison.Ordinal))
            return BadRequest(new { code = ErrorCodes.ValidationFailed, message = "ورقة المعاينة يجب أن تكون «Applicants»." });
        return Ok(await service.PreviewApplicantsReconciliationAsync(body, ct));
    }

    [HttpPost("applicants/reconcile/commit")]
    public async Task<ActionResult<ApplicantReconciliationCommitResult>> ReconcileCommit(
        [FromBody] ApplicantReconciliationCommitRequest body, CancellationToken ct)
    {
        if (body?.Sheet is null || body.Sheet.Rows is null || body.Sheet.Rows.Count == 0)
            return BadRequest(new { code = ErrorCodes.ValidationFailed, message = "لا توجد صفوف للاعتماد." });
        if (!string.Equals(body.Sheet.SheetName, "Applicants", StringComparison.Ordinal))
            return BadRequest(new { code = ErrorCodes.ValidationFailed, message = "ورقة الاعتماد يجب أن تكون «Applicants»." });
        if (body.Decisions is null || body.Decisions.Count == 0)
            return BadRequest(new { code = ErrorCodes.ValidationFailed, message = "لا توجد قرارات للاعتماد." });
        return Ok(await service.CommitApplicantsReconciliationAsync(body, ct));
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
    public async Task<ActionResult<TemplateDto>> Template(string type, CancellationToken ct)
    {
        if (!DataExchangeRegistry.TryParseDomain(type, out var spec))
            return Conflict(new { code = ErrorCodes.DataExchangeUnknownDomain, message = $"نطاق غير معروف: {type}" });
        return Ok(await service.TemplateAsync(spec, ct));
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

    /// <summary>Parses a comma-separated nationalIds query parameter; returns null
    /// when absent so the export honors the unfiltered roster.</summary>
    private static IReadOnlySet<string>? ParseNationalIds(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var set = new HashSet<string>(StringComparer.Ordinal);
        foreach (var token in raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            set.Add(token);
        return set.Count == 0 ? null : set;
    }
}
