/**
 * Application-settings (شروط التخصص) Excel export — pure flatteners +
 * workbook builder, decoupled from React.
 *
 * Turns the configured cycle application settings into one flat,
 * human-readable Excel sheet where every authored rule is one row and
 * every detail the admin entered is its own column. Lookup codes
 * (committees, grades, marital statuses, …) are resolved to Arabic names
 * via the `ApplicationSettingsLabelMaps` the caller passes in.
 *
 * Two sources, one column schema:
 *   • the per-cycle wizard draft (`headers` + `local` ⊕ `approved`) — the
 *     richest source, carries every detail (committee, degree, score
 *     operators, faculty/spec). This is the primary export path.
 *   • the committed app-settings tree (`CategorySettingsSummary[]`) — a
 *     reduced fallback used only when no cycle draft exists. Draft-only
 *     columns render blank.
 *
 * SheetJS (`xlsx`) is lazy-loaded so it never blocks prod boot, mirroring
 * the reports / applicant-grades export pattern.
 */

import type {
  CategorySettingsSummary,
} from '../api/applicationSettings.service';
import type {
  GeneralRulesHeader,
  LocalGeneralRuleRow,
  LocalThanawiRow,
  LocalUniversityRow,
  MaxScoreOperator,
  MinScoreOperator,
} from '../store/wizardSharedState';
import {
  DEFAULT_MAX_SCORE_OPERATOR,
  DEFAULT_MIN_SCORE_OPERATOR,
} from '../store/wizardSharedState';

/** Lookup code → Arabic name maps, sourced from the lookups feature. */
export interface ApplicationSettingsLabelMaps {
  marital: ReadonlyMap<string, string>;
  academicGrade: ReadonlyMap<string, string>;
  academicDegree: ReadonlyMap<string, string>;
  committee: ReadonlyMap<string, string>;
  examRound: ReadonlyMap<string, string>;
  schoolCategory: ReadonlyMap<string, string>;
}

/** Minimal category metadata (name + family) keyed by category code. */
export interface ApplicationSettingsCategoryMeta {
  nameAr: string;
  type: 'university' | 'pre_university';
}

/** Ordered Arabic column headers — the export contract (single sheet). */
export const APPLICATION_SETTINGS_EXPORT_HEADERS: readonly string[] = [
  'الدورة',
  'الفئة',
  'نوع الفئة',
  'الكلية',
  'التخصص',
  'النوع',
  'الحالة الاجتماعية',
  'الحد الأقصى للسن',
  'بداية التقديم',
  'نهاية التقديم',
  'تاريخ احتساب السن',
  'معيار التمييز',
  'الحد الأدنى للتقدير',
  'الحد الأقصى للتقدير',
  'الحد الأدنى للدرجة',
  'الحد الأقصى للدرجة',
  'الدرجة العلمية',
  'اللجنة',
  'الدور',
  'فئة المدرسة',
  'سنوات التخرج',
  'الحالة',
];

const GENDER_LABEL: Readonly<Record<string, string>> = {
  male: 'ذكر',
  female: 'أنثى',
  both: 'ذكور وإناث',
};

const EMPTY = '';

function genderLabel(code: string): string {
  return GENDER_LABEL[code] ?? code;
}

function joinList(values: readonly string[]): string {
  return values.length > 0 ? values.join('، ') : EMPTY;
}

function mapLabels(codes: readonly string[], labels: ReadonlyMap<string, string>): string[] {
  return codes.map((code) => labels.get(code) ?? code);
}

function maxAgeCell(value: number | null): string {
  return value !== null ? `${value} سنة` : EMPTY;
}

function operatorSymbol(operator: MinScoreOperator | MaxScoreOperator): string {
  switch (operator) {
    case 'GREATER_THAN':
      return '>';
    case 'GREATER_THAN_OR_EQUAL':
      return '≥';
    case 'LESS_THAN':
      return '<';
    case 'LESS_THAN_OR_EQUAL':
      return '≤';
  }
}

function scoreCell(
  value: number | null | undefined,
  operator: MinScoreOperator | MaxScoreOperator,
): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return EMPTY;
  return `${operatorSymbol(operator)} ${value}٪`;
}

function excellenceCell(mode: 'TAGDIR' | 'GRADES'): string {
  return mode === 'TAGDIR' ? 'تقدير' : 'درجة';
}

function gradeCell(code: string, labels: ReadonlyMap<string, string>): string {
  return code ? labels.get(code) ?? code : EMPTY;
}

/* ── Draft source (richest) ─────────────────────────────────────────── */

function universityRowCells(
  cycleName: string,
  row: LocalUniversityRow,
  header: GeneralRulesHeader,
  meta: ApplicationSettingsCategoryMeta | undefined,
  labels: ApplicationSettingsLabelMaps,
  status: string,
): string[] {
  return [
    cycleName,
    meta?.nameAr ?? row.categoryCode,
    'جامعي',
    row.facultyNameAr,
    row.specializationNameAr,
    joinList(row.type.map(genderLabel)),
    joinList(mapLabels(row.maritalStatus.length > 0 ? row.maritalStatus : header.maritalStatus, labels.marital)),
    maxAgeCell(header.maxAge),
    header.applicationStart || EMPTY,
    header.applicationEnd || EMPTY,
    header.ageReferenceDate || EMPTY,
    excellenceCell(row.excellenceMode),
    gradeCell(row.grade, labels.academicGrade),
    gradeCell(row.gradeMax, labels.academicGrade),
    scoreCell(row.scoreMin, row.minScoreOperator ?? DEFAULT_MIN_SCORE_OPERATOR),
    scoreCell(row.scoreMax, row.maxScoreOperator ?? DEFAULT_MAX_SCORE_OPERATOR),
    joinList(mapLabels(row.academicDegrees, labels.academicDegree)),
    joinList(mapLabels(row.committees, labels.committee)),
    EMPTY, // الدور — university n/a
    EMPTY, // فئة المدرسة — university n/a
    joinList(row.graduationYears.map((y) => String(y))),
    status,
  ];
}

function thanawiRowCells(
  cycleName: string,
  row: LocalThanawiRow,
  header: GeneralRulesHeader,
  meta: ApplicationSettingsCategoryMeta | undefined,
  labels: ApplicationSettingsLabelMaps,
  status: string,
): string[] {
  return [
    cycleName,
    meta?.nameAr ?? row.categoryCode,
    'ثانوي',
    EMPTY, // الكلية — thanawi n/a
    EMPTY, // التخصص — thanawi n/a
    EMPTY, // النوع — thanawi rows carry no gender axis
    joinList(mapLabels(header.maritalStatus, labels.marital)),
    maxAgeCell(header.maxAge),
    header.applicationStart || EMPTY,
    header.applicationEnd || EMPTY,
    header.ageReferenceDate || EMPTY,
    excellenceCell(row.excellenceMode),
    gradeCell(row.grade, labels.academicGrade),
    gradeCell(row.gradeMax, labels.academicGrade),
    scoreCell(row.scoreMin, row.minScoreOperator ?? DEFAULT_MIN_SCORE_OPERATOR),
    scoreCell(row.scoreMax, row.maxScoreOperator ?? DEFAULT_MAX_SCORE_OPERATOR),
    EMPTY, // الدرجة العلمية — thanawi n/a
    row.committee ? labels.committee.get(row.committee) ?? row.committee : EMPTY,
    row.examRound ? labels.examRound.get(row.examRound) ?? row.examRound : EMPTY,
    joinList(mapLabels(row.schoolCategories, labels.schoolCategory)),
    row.graduationYear !== null ? String(row.graduationYear) : EMPTY,
    status,
  ];
}

/**
 * Flatten the wizard draft (`local` ⊕ `approved`) into export rows.
 * Approved rows are emitted first (tagged «معتمد»), then in-progress local
 * rows (tagged «قيد التحرير») so a reviewer reads the committed set first.
 */
export function buildApplicationSettingsDraftRows(input: {
  cycleName: string;
  headers: Readonly<Record<string, GeneralRulesHeader>>;
  approved: readonly LocalGeneralRuleRow[];
  local: readonly LocalGeneralRuleRow[];
  categoryMeta: ReadonlyMap<string, ApplicationSettingsCategoryMeta>;
  labels: ApplicationSettingsLabelMaps;
}): string[][] {
  const { cycleName, headers, approved, local, categoryMeta, labels } = input;

  const emit = (rows: readonly LocalGeneralRuleRow[], status: string): string[][] =>
    rows.map((row) => {
      const header = headers[row.categoryCode] ?? row.header;
      const meta = categoryMeta.get(row.categoryCode);
      return row.kind === 'thanawi'
        ? thanawiRowCells(cycleName, row, header, meta, labels, status)
        : universityRowCells(cycleName, row, header, meta, labels, status);
    });

  return [...emit(approved, 'معتمد'), ...emit(local, 'قيد التحرير')];
}

/* ── Committed-summary source (fallback) ────────────────────────────── */

/**
 * Flatten the committed app-settings tree into the same column schema.
 * Only used when no cycle draft exists; draft-only columns (committee,
 * degree, score operators, faculty) render blank.
 */
export function buildApplicationSettingsSummaryRows(input: {
  cycleName: string;
  summary: readonly CategorySettingsSummary[];
  labels: ApplicationSettingsLabelMaps;
}): string[][] {
  const { cycleName, summary, labels } = input;
  const rows: string[][] = [];

  for (const cat of summary) {
    const isUniversity = cat.config.categoryType === 'university';
    for (const group of cat.groups) {
      for (const year of group.years) {
        const isTagdir = year.gradeKind === 'TAGDIR';
        rows.push([
          cycleName,
          cat.config.categoryNameAr,
          isUniversity ? 'جامعي' : 'ثانوي',
          EMPTY, // الكلية — not carried on the year row
          group.nameAr ?? EMPTY,
          joinList(year.genderTypes.map(genderLabel)),
          joinList(mapLabels(year.maritalStatusCodes, labels.marital)),
          maxAgeCell(year.maxAge),
          year.applicationStartDate || EMPTY,
          year.applicationEndDate || EMPTY,
          year.ageReferenceDate || EMPTY,
          isTagdir ? 'تقدير' : 'درجة',
          isTagdir ? gradeCell(year.academicGradeId, labels.academicGrade) : EMPTY,
          EMPTY, // الحد الأقصى للتقدير — single grade on committed rows
          !isTagdir ? scoreCell(year.minPercentage, DEFAULT_MIN_SCORE_OPERATOR) : EMPTY,
          EMPTY, // الحد الأقصى للدرجة — single floor on committed rows
          EMPTY, // الدرجة العلمية — not carried on the year row
          EMPTY, // اللجنة — not carried on the year row
          EMPTY, // الدور — not carried on the year row
          joinList(mapLabels(year.schoolCategoryCodes, labels.schoolCategory)),
          joinList(year.graduationYears.map((y) => String(y))),
          year.isActive ? 'نشط' : 'موقوف',
        ]);
      }
    }
  }

  return rows;
}

/* ── Workbook builder ───────────────────────────────────────────────── */

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Build a single-sheet .xlsx Blob (RTL view) from flattened export rows. */
export async function buildApplicationSettingsWorkbookBlob(
  dataRows: readonly string[][],
): Promise<Blob> {
  const XLSX = await import('xlsx');
  const aoa: unknown[][] = [
    [...APPLICATION_SETTINGS_EXPORT_HEADERS],
    ...dataRows.map((r) => [...r]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = APPLICATION_SETTINGS_EXPORT_HEADERS.map(() => ({ wch: 18 }));
  // Right-to-left worksheet view so the Arabic sheet opens reading correctly.
  (ws as { '!views'?: Array<{ RTL: boolean }> })['!views'] = [{ RTL: true }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ApplicationSettings');
  const bin = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Blob([bin], { type: XLSX_MIME });
}
