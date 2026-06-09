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
    /// <summary>Normalized operational JSON tables filtered by module.</summary>
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
        new(ExchangeDomain.Committees,          "Committees",          "اللجان",               ExchangeStorage.DocStore,       "committeeInstances", []),
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

// ── Applicants roster (selectable list driving export) ──────────────────
/// <summary>
/// Roster projection of a booked applicant — the row shape backing the
/// admin's selectable list inside the Data Exchange export card. Columns
/// match the right-edge of the eventual Excel export (`nationalId` is the
/// identity column / business key + the re-import match key).
/// </summary>
public sealed record ApplicantRosterRow(
    string NationalId,
    string ApplicantId,
    string? FullName,
    string? Gender,
    string? Status,
    string? ExamSlotDate,
    string? ExamSlotTime,
    string? CommitteeName,
    string? ExamSlotLocation,
    DateTimeOffset? UpdatedAt);

// ── Applicants reconciliation (field-level diff + result/next-exam writeback) ──
/// <summary>One field-level diff for an applicant row — before is the current
/// DB value, after is the imported value. Only changed fields are emitted.</summary>
public sealed record ApplicantFieldDiff(string Field, string? Before, string? After);

/// <summary>Parsed result + next-exam columns for a single applicant import row.
/// Result codes resolve via the existing `test-results` lookup; the resolved
/// `Outcome` is one of the canonical FollowUpOutcomes (passed|failed|defer|
/// withdrawn|pending|in-progress|awaiting-approval). When the column was blank,
/// every field is null and the writeback is treated as not-present.</summary>
public sealed record ApplicantWritebackResult(
    string? ResultRaw,
    string? Outcome,
    string? TestCode,
    int? Round,
    string? NextExamDate,
    IReadOnlyList<string> Errors);

/// <summary>Per-applicant reconciliation row. `Unmatched` is true when the
/// national ID was not found in the booked applicants store. `FieldDiffs`
/// is empty when no editable field changed (a result-only writeback).</summary>
public sealed record ApplicantReconciliationRow(
    string NationalId,
    string? ApplicantId,
    string? FullName,
    bool Unmatched,
    IReadOnlyList<ApplicantFieldDiff> FieldDiffs,
    ApplicantWritebackResult? Writeback,
    IReadOnlyList<string> Errors);

public sealed record ApplicantReconciliationPreview(
    IReadOnlyDictionary<string, int> Counts,
    IReadOnlyList<ApplicantReconciliationRow> Rows);

/// <summary>Admin's per-applicant accept/reject decision sent to the commit
/// endpoint. `AcceptedFields` names the diff fields the admin opted to write;
/// `ApplyWriteback` opts in to result + next-exam writeback.</summary>
public sealed record ApplicantReconciliationDecision(
    string NationalId,
    IReadOnlyList<string> AcceptedFields,
    bool ApplyWriteback);

public sealed record ApplicantReconciliationCommitRequest(
    IReadOnlyList<ApplicantReconciliationDecision> Decisions,
    ImportSheetInput Sheet);

public sealed record ApplicantReconciliationCommitResult(
    int AttemptedCount,
    int SuccessCount,
    int FieldsWrittenCount,
    int WritebacksAppliedCount,
    int FailedCount,
    IReadOnlyList<ImportFailedRow> FailedRows);
