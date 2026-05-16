/**
 * Applicant Grades — domain types.
 *
 * Mirrors the shape of the staged-import + reconciliation flow described in
 * docs/DB_CONSTRAINTS.md (Application-side import tables) and the legacy
 * import scripts under `frontend/_legacy/` for general / azhar secondary
 * grade sheets. The mock services and components below speak the same
 * structure the eventual backend will return.
 */

export type GradeKind = 'general' | 'azhar';

export type AdjustmentReason = 'SPORTS_ACTIVITY' | 'GRIEVANCE' | 'LEGAL_CASE' | 'OTHER';

export interface GradeAdjustment {
  id: string;
  reason: AdjustmentReason;
  reasonLabel: string;
  note: string;
  amount: number;
  by: string;
  when: string;
  isActive: boolean;
  fresh?: boolean;
}

/** A grade row as held in the admin table.  */
export interface GradeRow {
  /** Cycle-scoped internal primary key (numeric). */
  seat: number;
  /**
   * Ministry-issued seating number — `رقم الجلوس` as printed on the
   * student's exam card. Optional because legacy imports predate v2's
   * mapping step; rendered in Eastern-Arabic numerals where shown.
   */
  seatingNumber: string | null;
  /** Egyptian national-id (14 digits). */
  nid: string;
  name: string;
  kind: GradeKind;
  /** الشعبة. */
  branch: string;
  /** اسم المدرسة / المعهد. */
  school: string;
  /** المحافظة / المنطقة. */
  region: string;
  /** المجموع الأصلي عند الاستيراد. */
  total: number;
  /** الدرجة العظمى المطبقة على هذه الدفعة (من ملف الاستيراد). */
  importMax: number;
  /** القيمة المعدّلة لهذا الطالب — إن وُجدت تعلو importMax. */
  overrideMax: number | null;
  lastEditedAt: string | null;
  lastEditedBy: string | null;
  /** حالة الطالب — مستجد / باقٍ للإعادة / —. */
  status: string;
  log: GradeAdjustment[];
}

/** Aggregate counts used by the page header strip. */
export interface GradeStats {
  total: number;
  general: number;
  azhar: number;
  withAdjustments: number;
  ups: number;
  downs: number;
}

/* ── Import wizard ─────────────────────────────────────────────────────── */

export type ImportSkipCode = 'TOTAL_EXCEEDS_MAX' | 'PARSE_ERROR' | 'MISSING_REQUIRED_COLUMN';

export interface ImportDuplicateRow {
  nationalId: string;
  name: string;
  kind: GradeKind;
  seatExisting: number;
  seatIncoming: number;
  maxDegree: number;
  hasChanges: boolean;
  changedFields: ReadonlyArray<'total' | 'branch' | 'school' | 'region' | 'status' | 'seat'>;
  existing: {
    total: number;
    branch: string;
    school: string;
    region: string;
    status: string;
  };
  incoming: {
    total: number;
    branch: string;
    school: string;
    region: string;
    status: string;
  };
  adjustmentSum: number;
  adjustmentCount: number;
}

export interface ImportSkipBucket {
  reason: ImportSkipCode;
  label: string;
  count: number;
  tone: 'terra' | 'warning';
  rows: { row: number; detail: string }[];
}

export interface StagedImport {
  newRows: number;
  duplicates: ImportDuplicateRow[];
  skipped: ImportSkipBucket[];
}

export type ImportResolution = 'ACCEPT' | 'REJECT';

export interface CommittedImport {
  inserted: number;
  replaced: number;
  kept: number;
  deactivated: Array<{
    nationalId: string;
    name: string;
    adjustmentSum: number;
  }>;
  skipped: ImportSkipBucket[];
}

/* ── Import wizard v2 ──────────────────────────────────────────────── */

/**
 * A row from the source file, after Step 3's column mapping has been
 * applied. Every field is keyed by `TargetField` and may be `null`
 * either because the source cell was empty or because the field wasn't
 * mapped at all. Step 4's filters operate on the same shape.
 */
export interface NormalisedRow {
  nationalId: string | null;
  seatingNumber: string | null;
  nameAr: string | null;
  gender: string | null;
  track: string | null;
  graduationYear: number | null;
  totalGrade: number | null;
  maxGrade: number | null;
  /** 1-based row index in the source table (for "source row #N" labels). */
  sourceRowIndex: number;
}

export type ImportGroupCode =
  | 'DUPLICATE_NID'
  | 'INVALID_NID'
  | 'MISSING_REQUIRED'
  | 'NID_NOT_FOUND'
  | 'GRADE_OUT_OF_RANGE'
  | 'UNREADABLE_VALUE';

export type ImportGroupAction = 'skip' | 'override' | 'export' | 'create-applicant';

export interface ImportFailureRow {
  nationalId: string | null;
  seatingNumber: string | null;
  nameAr: string | null;
  totalGrade: number | null;
  sourceRowIndex: number;
  /** Free-form explanation rendered under the row in Step 6. */
  detail?: string;
}

export interface ImportReportGroup {
  code: ImportGroupCode;
  labelAr: string;
  rows: ImportFailureRow[];
  availableActions: readonly ImportGroupAction[];
}

export interface ImportReport {
  totals: {
    received: number;
    imported: number;
    skipped: number;
    failed: number;
  };
  groups: ImportReportGroup[];
}

export interface ImportCommitResult {
  insertedCount: number;
  failedCount: number;
}
