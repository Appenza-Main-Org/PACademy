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
  /** Cycle-scoped seating number. */
  seat: number;
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
