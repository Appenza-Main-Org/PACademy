namespace PACademy.Admin.Api.Modules.DataExchangeAdmin;

/// <summary>
/// The exchangeable sheets. <see cref="SheetName"/> is the LOCKED, ASCII,
/// ≤31-char Excel tab name — the single contract both the export writer and the
/// import validator key off (mirrored verbatim by the frontend `SHEET_NAMES`).
/// Arabic lives in the title/header row and column labels, never the tab name.
///
/// The first nine values are the historical round-trip (export+import) domains.
/// The trailing block (ApplicantCategories … AuditEntries) was added for the
/// curated full-database snapshot export — they are EXPORT-ONLY (their import
/// upsert is read-only; see <see cref="DataExchangeService"/>). The curated
/// snapshot export is driven by <see cref="CuratedSheetSpec"/>, not by this
/// enum's storage binding.
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
    // ── curated-snapshot export-only domains (2026-06-10) ──
    ApplicantCategories,
    Faculties,
    LookupRows,
    GeneralSettings,
    Payments,
    Notifications,
    WorkflowRecords,
    AuditEntries,
    /// <summary>Booked exam appointments (applicant ↔ slot link). Exported from
    /// the applicant scheduling records; importable since 2026-06-11 — imported
    /// rows write back through the same operational records (portal draft
    /// examSlot/firstExamDate/testSchedules) so appointments surface in the
    /// admin applicant screens and the applicant portal.</summary>
    ExamReservations,
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
    /// <summary>Export-only operational/typed tables — import is read-only.</summary>
    ReadOnlyExport,
    /// <summary>Applicant exam reservations — import writes through the
    /// applicant scheduling records (portal draft + management document) via
    /// <c>OperationalRecordsService.ApplyApplicantExamReservationAsync</c>.</summary>
    ExamReservations,
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
        new(ExchangeDomain.Applicants,          "Applicants",          "بيانات المتقدمين",            ExchangeStorage.DocStore,       "applicants",  ["nationalId"]),
        new(ExchangeDomain.Exams,               "Exams",               "اختبارات دورة القبول",           ExchangeStorage.Exams,          null,          []),
        new(ExchangeDomain.Relatives,           "Relatives",           "أقارب المتقدمين",     ExchangeStorage.DocStore,       "relatives",   []),
        new(ExchangeDomain.AcquaintanceDocs,    "AcquaintanceDocs",    "وثائق التعارف",         ExchangeStorage.DocStore,       "acquaintance",[]),
        new(ExchangeDomain.Committees,          "Committees",          "لجان القبول",               ExchangeStorage.DocStore,       "committeeInstances", []),
        new(ExchangeDomain.AdmissionConditions, "AdmissionConditions", "شروط القبول",           ExchangeStorage.AdmissionRules, null,          []),
        new(ExchangeDomain.SystemCodes,         "SystemCodes",         "أكواد النظام والقوائم", ExchangeStorage.Lookups,        null,          []),
        new(ExchangeDomain.ExamResults,         "ExamResults",         "نتائج اختبارات المتقدمين",      ExchangeStorage.DocStore,       "examResults", []),
        new(ExchangeDomain.ExamSchedules,       "ExamSchedules",       "جدول مواعيد الاختبارات",     ExchangeStorage.ExamSlots,      null,          []),
        // ── curated-snapshot export-only domains (read-only on import) ──
        new(ExchangeDomain.ApplicantCategories, "ApplicantCategories", "فئات المتقدمين",        ExchangeStorage.ReadOnlyExport, null,          []),
        new(ExchangeDomain.Faculties,           "Faculties",           "الكليات",               ExchangeStorage.ReadOnlyExport, null,          []),
        new(ExchangeDomain.LookupRows,          "LookupRows",          "القوائم المرجعية",         ExchangeStorage.ReadOnlyExport, null,          []),
        new(ExchangeDomain.GeneralSettings,     "GeneralSettings",     "الإعدادات العامة",      ExchangeStorage.ReadOnlyExport, null,          []),
        new(ExchangeDomain.Payments,            "Payments",            "مدفوعات المتقدمين",             ExchangeStorage.ReadOnlyExport, null,          []),
        new(ExchangeDomain.Notifications,       "Notifications",       "الإشعارات",             ExchangeStorage.ReadOnlyExport, null,          []),
        new(ExchangeDomain.WorkflowRecords,     "WorkflowRecords",     "سجل سير العمل",         ExchangeStorage.ReadOnlyExport, null,          []),
        new(ExchangeDomain.AuditEntries,        "AuditEntries",        "سجل التدقيق",           ExchangeStorage.ReadOnlyExport, null,          []),
        new(ExchangeDomain.ExamReservations,    "ExamReservations",    "حجوزات المتقدمين للاختبارات",     ExchangeStorage.ExamReservations, null,        ["applicant_national_id", "exam_id"]),
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

/// <summary>
/// Backend-known export metadata. <see cref="CycleName"/> plus the export
/// watermark drive the unique
/// <c>data-exchange-{cycle-name}-{yyyyMMdd-HHmmss}.xlsx</c> file name on the
/// frontend (the workbook itself carries data sheets only — the former
/// <c>ExportInfo</c> metadata sheet was dropped 2026-06-10).
/// </summary>
public sealed record ExportInfoDto(
    string? CycleId,
    string? CycleName,
    string ExportDate,
    string ExportedBy,
    string Environment);

public sealed record ExportResultDto(
    string Layout,
    string Watermark,
    int TotalRows,
    IReadOnlyList<ExportSheetDto> Sheets,
    /// <summary>Populated by the curated snapshot export; null for the legacy
    /// round-trip export.</summary>
    ExportInfoDto? Info = null);

/// <summary>
/// Curated full-database-snapshot sheet binding. Unlike <see cref="DomainSpec"/>
/// (whose columns are the data-driven union of flattened keys), a curated sheet
/// has a FIXED, ordered, human-readable column list. The matching loader emits
/// rows whose cells are keyed exactly by <see cref="Columns"/> — no flattened
/// dotted keys, no tracking/checksum noise. Empty domains still emit the header
/// row. <see cref="CycleScoped"/> rows are filtered to the selected cycle;
/// <see cref="PersonScoped"/> rows honor the applicant national-id allow-list.
/// </summary>
public sealed record CuratedSheetSpec(
    ExchangeDomain Domain,
    string SheetName,
    string TitleAr,
    IReadOnlyList<string> Columns,
    bool CycleScoped,
    bool PersonScoped);

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
