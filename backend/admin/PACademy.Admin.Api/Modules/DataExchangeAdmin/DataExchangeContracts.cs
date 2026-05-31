namespace PACademy.Admin.Api.Modules.DataExchangeAdmin;

/// <summary>
/// The 9 exchangeable sheets. <see cref="SheetName"/> is the LOCKED, ASCII,
/// ≤31-char Excel tab name — the single contract both the export writer and the
/// import validator key off (mirrored verbatim by the frontend `SHEET_NAMES`).
/// Arabic lives in the title/header row and column labels, never the tab name.
/// </summary>
public enum ExchangeDomain
{
    Applicants,
    Exams,
    Relatives,
    AcquaintanceDocs,
    Committees,
    AdmissionConditions,
    SystemCodes,
    ExamResults,
    ExamSchedules,
}

/// <summary>How a domain's rows are physically stored in the admin DB.</summary>
public enum ExchangeStorage
{
    /// <summary>Generic JSON document store (admin_record_documents) filtered by module.</summary>
    DocStore,
    /// <summary>lookup_rows table (composite key lookup_key + code).</summary>
    Lookups,
    /// <summary>admission_rules table.</summary>
    AdmissionRules,
    /// <summary>exams table.</summary>
    Exams,
    /// <summary>exam_slots table.</summary>
    ExamSlots,
}

/// <summary>Per-domain binding: sheet name, Arabic title, storage, and business key.</summary>
public sealed record DomainSpec(
    ExchangeDomain Domain,
    string SheetName,
    string TitleAr,
    ExchangeStorage Storage,
    string? DocModule,
    /// <summary>Payload fields (in order) composing the business key for a doc-store
    /// domain. Empty ⇒ the record id is the business key.</summary>
    IReadOnlyList<string> BusinessKeyFields);

/// <summary>
/// Single source of truth for the sheet-name registry and domain bindings.
/// The importer rejects any workbook whose sheet names aren't in <see cref="BySheetName"/>.
/// </summary>
public static class DataExchangeRegistry
{
    public static readonly IReadOnlyList<DomainSpec> All =
    [
        new(ExchangeDomain.Applicants,          "Applicants",          "المتقدمون",            ExchangeStorage.DocStore,       "applicants",  ["nationalId"]),
        new(ExchangeDomain.Exams,               "Exams",               "الاختبارات",           ExchangeStorage.Exams,          null,          []),
        new(ExchangeDomain.Relatives,           "Relatives",           "الأقارب المبدئيون",     ExchangeStorage.DocStore,       "relatives",   []),
        new(ExchangeDomain.AcquaintanceDocs,    "AcquaintanceDocs",    "وثائق التعارف",         ExchangeStorage.DocStore,       "acquaintance",[]),
        new(ExchangeDomain.Committees,          "Committees",          "اللجان",               ExchangeStorage.DocStore,       "committees",  []),
        new(ExchangeDomain.AdmissionConditions, "AdmissionConditions", "شروط القبول",           ExchangeStorage.AdmissionRules, null,          []),
        new(ExchangeDomain.SystemCodes,         "SystemCodes",         "أكواد النظام والقوائم", ExchangeStorage.Lookups,        null,          []),
        new(ExchangeDomain.ExamResults,         "ExamResults",         "نتائج الاختبارات",      ExchangeStorage.DocStore,       "examResults", []),
        new(ExchangeDomain.ExamSchedules,       "ExamSchedules",       "مواعيد الاختبارات",     ExchangeStorage.ExamSlots,      null,          []),
    ];

    public static readonly IReadOnlyDictionary<string, DomainSpec> BySheetName =
        All.ToDictionary(d => d.SheetName, d => d, StringComparer.Ordinal);

    public static readonly IReadOnlyDictionary<ExchangeDomain, DomainSpec> ByDomain =
        All.ToDictionary(d => d.Domain, d => d);

    public static bool TryParseDomain(string token, out DomainSpec spec)
    {
        spec = All.FirstOrDefault(d =>
            string.Equals(d.SheetName, token, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(d.Domain.ToString(), token, StringComparison.OrdinalIgnoreCase))!;
        return spec is not null;
    }
}

// ── Row classification ──────────────────────────────────────────────────
public enum ImportRowClass { New, Changed, Skipped, Outdated, Conflict, Invalid }

// ── Export ──────────────────────────────────────────────────────────────
public sealed record ExportSheetDto(
    string Domain,
    string SheetName,
    string TitleAr,
    IReadOnlyList<string> Columns,
    IReadOnlyList<IReadOnlyDictionary<string, string?>> Rows);

public sealed record ExportResultDto(
    string Layout,
    string Watermark,
    int TotalRows,
    IReadOnlyList<ExportSheetDto> Sheets);

// ── Import preview / apply ──────────────────────────────────────────────
public sealed record ImportSheetInput(
    string SheetName,
    IReadOnlyList<Dictionary<string, string?>> Rows);

public sealed record ImportPreviewRequest(IReadOnlyList<ImportSheetInput> Sheets);

public sealed record ImportRowOutcome(
    string Domain,
    string SheetName,
    int RowIndex,
    string BusinessKey,
    /// <summary>Lowercase class name (new|changed|skipped|outdated|conflict|invalid).</summary>
    string Class,
    IReadOnlyList<string> Errors);

public sealed record SheetIssue(string SheetName, string Code, string Message);

public sealed record ImportPreviewResult(
    IReadOnlyDictionary<string, int> Counts,
    IReadOnlyList<ImportRowOutcome> Rows,
    IReadOnlyList<SheetIssue> SheetIssues);

public sealed record ImportApplyRequest(
    IReadOnlyList<ImportSheetInput> Sheets,
    string Mode,            // "new-only" | "new-and-changed"
    bool SkipConflicts,
    bool ForceUpdate);

/// <summary>Aligned with the frontend list-actions `ImportResult` shape (+ class counts).</summary>
public sealed record ImportApplyResult(
    int AttemptedCount,
    int SuccessCount,
    int InsertedCount,
    int UpdatedCount,
    int SkippedCount,
    int FailedCount,
    IReadOnlyList<ImportFailedRow> FailedRows);

public sealed record ImportFailedRow(int RowIndex, string SheetName, IReadOnlyList<string> Errors);

// ── History / templates ─────────────────────────────────────────────────
public sealed record HistoryEntryDto(
    string Id,
    string Action,        // "export" | "import"
    string ActorName,
    string Details,
    int Total,
    int Inserted,
    int Updated,
    int Skipped,
    int Failed,
    DateTimeOffset Timestamp);

public sealed record TemplateDto(string Domain, string SheetName, string TitleAr, IReadOnlyList<string> Columns);
