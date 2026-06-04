/**
 * Data-Exchange domain types. Mirrors the backend
 * `Modules/DataExchangeAdmin/DataExchangeContracts.cs` DTOs (camelCased on the
 * wire). `SHEET_NAMES` is the LOCKED registry — the single contract both the
 * export workbook writer and the import validator key off.
 */

/** The 9 exchangeable domains → their locked, ASCII, ≤31-char Excel tab names. */
export const SHEET_NAMES = {
  Applicants: 'Applicants',
  Exams: 'Exams',
  Relatives: 'Relatives',
  AcquaintanceDocs: 'AcquaintanceDocs',
  Committees: 'Committees',
  AdmissionConditions: 'AdmissionConditions',
  SystemCodes: 'SystemCodes',
  ExamResults: 'ExamResults',
  ExamSchedules: 'ExamSchedules',
} as const;

export type ExchangeDomain = keyof typeof SHEET_NAMES;

/** Arabic titles for each domain (tab name stays ASCII; Arabic shown in UI). */
export const DOMAIN_TITLES_AR: Record<ExchangeDomain, string> = {
  Applicants: 'المتقدمون',
  Exams: 'الاختبارات',
  Relatives: 'الأقارب المبدئيون',
  AcquaintanceDocs: 'وثائق التعارف',
  Committees: 'اللجان',
  AdmissionConditions: 'شروط القبول',
  SystemCodes: 'أكواد النظام والقوائم',
  ExamResults: 'نتائج الاختبارات',
  ExamSchedules: 'مواعيد الاختبارات',
};

export const EXCHANGE_DOMAINS = Object.keys(SHEET_NAMES) as ExchangeDomain[];

export type ExportLayout = 'single-workbook' | 'file-per-type';

export type ExportFilter =
  | 'all'
  | { changedAfter: string }
  | 'modifiedSinceCreation'
  | 'sinceLastExport'
  | { cycleId: string }
  | { categoryKey: string };

export type ImportRowClass =
  | 'new'
  | 'changed'
  | 'skipped'
  | 'outdated'
  | 'conflict'
  | 'invalid';

export const IMPORT_ROW_CLASSES: ImportRowClass[] = [
  'new',
  'changed',
  'skipped',
  'outdated',
  'conflict',
  'invalid',
];

export const CLASS_LABELS_AR: Record<ImportRowClass, string> = {
  new: 'جديد',
  changed: 'مُعدَّل',
  skipped: 'دون تغيير',
  outdated: 'قديم',
  conflict: 'تعارض',
  invalid: 'غير صالح',
};

export type ExchangeCellMap = Record<string, string | null>;

export interface ExportSheet {
  domain: string;
  sheetName: string;
  titleAr: string;
  columns: string[];
  rows: ExchangeCellMap[];
}

export interface ExportResult {
  layout: string;
  watermark: string;
  totalRows: number;
  sheets: ExportSheet[];
}

export interface ImportSheetInput {
  sheetName: string;
  rows: ExchangeCellMap[];
}

export interface ImportPreviewRequest {
  sheets: ImportSheetInput[];
}

export interface ImportRowOutcome {
  domain: string;
  sheetName: string;
  rowIndex: number;
  businessKey: string;
  class: ImportRowClass;
  errors: string[];
}

export interface SheetIssue {
  sheetName: string;
  code: string;
  message: string;
}

export interface ImportPreview {
  counts: Record<string, number>;
  rows: ImportRowOutcome[];
  sheetIssues: SheetIssue[];
}

export type ImportApplyMode = 'new-only' | 'new-and-changed';

export interface ImportApplyRequest {
  sheets: ImportSheetInput[];
  mode: ImportApplyMode;
  skipConflicts: boolean;
  forceUpdate: boolean;
}

export interface ImportFailedRow {
  rowIndex: number;
  sheetName: string;
  errors: string[];
}

export interface ImportApplyResult {
  attemptedCount: number;
  successCount: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  failedRows: ImportFailedRow[];
}

export interface DataExchangeHistoryEntry {
  id: string;
  action: string; // 'export' | 'import'
  actorName: string;
  details: string;
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  timestamp: string;
}

export interface DataExchangeTemplate {
  domain: string;
  sheetName: string;
  titleAr: string;
  columns: string[];
}

/** Roster projection of a booked applicant — backs the admin's selectable list
 *  inside the Data Exchange export card. Mirrors backend `ApplicantRosterRow`.
 *  `nationalId` is the identity column / business key + the re-import match key. */
export interface ApplicantRosterRow {
  nationalId: string;
  applicantId: string;
  fullName: string | null;
  gender: string | null;
  status: string | null;
  examSlotDate: string | null;
  examSlotTime: string | null;
  examSlotLocation: string | null;
  updatedAt: string | null;
}

// ── Applicants reconciliation (field-level diff + result writeback) ─────
/** One field-level diff for an applicant row — `before` is the current DB
 *  value, `after` is the imported value. Only changed editable fields are
 *  emitted by the backend preview. */
export interface ApplicantFieldDiff {
  field: string;
  before: string | null;
  after: string | null;
}

/** Parsed result + next-exam columns for a single imported applicant row.
 *  `outcome` is the canonical FollowUpOutcomes value
 *  (passed | failed | in-progress | awaiting-approval | pending); null when
 *  the result column was blank or didn't resolve via the `test-results`
 *  lookup. Typed conflict codes flow through `errors`. */
export interface ApplicantWritebackResult {
  resultRaw: string | null;
  outcome: string | null;
  testCode: string | null;
  round: number | null;
  nextExamDate: string | null;
  errors: string[];
}

/** Per-applicant reconciliation row. `unmatched` flags imports whose
 *  national ID was not found in the booked roster. `fieldDiffs` is empty
 *  for result-only writebacks. */
export interface ApplicantReconciliationRow {
  nationalId: string;
  applicantId: string | null;
  fullName: string | null;
  unmatched: boolean;
  fieldDiffs: ApplicantFieldDiff[];
  writeback: ApplicantWritebackResult | null;
  errors: string[];
}

export interface ApplicantReconciliationPreview {
  counts: Record<string, number>;
  rows: ApplicantReconciliationRow[];
}
