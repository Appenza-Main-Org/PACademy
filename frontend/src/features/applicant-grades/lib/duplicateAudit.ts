/**
 * Pre-import duplicate audit + CSV report builder.
 *
 * The wizard's Step 5 panel and Step 7 commit gate both consume
 * `buildDuplicateAudit` to decide whether the upload is shaped
 * pathologically — a real case from the field was 23,073 rows with only
 * 3 unique national-ids, which is almost certainly a malformed export
 * rather than an intentional bulk import. When the duplicate-row ratio
 * crosses `DUPLICATE_RATIO_THRESHOLD` the wizard escalates the warning
 * to a hard guard and blocks advancement until the admin acknowledges
 * the override.
 *
 * `buildAuditCsv` snapshots every issue surfaced by the preflight
 * (duplicates, missing-required, invalid NIDs, out-of-range totals,
 * intra-file duplicates) into a single downloadable file so the
 * decision trail survives the import even before the backend grows a
 * server-side import-history table.
 */

import { serializeCsv } from '@/shared/lib/csv';
import { isValidNationalId, parseNationalId } from '@/shared/lib/national-id';
import type { ImportReport, NormalisedRow } from '../types';
import { buildUploadDuplicates } from './buildDiff';

/** Intra-file duplicate ratio above which the wizard blocks the admin
 *  from advancing without an explicit override. 1% is the field-tested
 *  level: a single re-export bug usually inflates well past this, while
 *  legitimate re-applicants in a same-cycle file land far below. */
export const DUPLICATE_RATIO_THRESHOLD = 0.01;

/** Distribution rows surfaced in the audit panel. Cap protects render
 *  perf when an export is structurally broken (e.g. one NID repeated
 *  10k times — we still want to surface the top offenders, not all). */
const DISTRIBUTION_CAP = 25;

export interface DuplicateAuditEntry {
  nationalId: string;
  nameAr: string | null;
  count: number;
}

export interface DuplicateAudit {
  totalRows: number;
  /** Distinct nationalId values across the upload, including rows whose
   *  NID is null / unparseable (those land in the catch-all bucket). */
  uniqueNidCount: number;
  /** Count of NIDs that occur 2+ times. */
  duplicateNidGroups: number;
  /** Rows that share their NID with another row in the same file —
   *  this is the number of rows the dedupe step will silently drop
   *  if the admin proceeds (first occurrence wins). */
  duplicateRowCount: number;
  /** `duplicateRowCount / totalRows` — drives the loud-guard gate. */
  duplicateRatio: number;
  /** Top duplicate NIDs by occurrence, sorted desc, capped at
   *  `DISTRIBUTION_CAP`. */
  distribution: DuplicateAuditEntry[];
  /** True iff `duplicateRatio > DUPLICATE_RATIO_THRESHOLD`. */
  exceedsThreshold: boolean;
}

export interface IntegrityAuditRow {
  code:
    | 'INVALID_NID'
    | 'GENDER_MISMATCH'
    | 'AGE_OUT_OF_RANGE'
    | 'MISSING_REQUIRED'
    | 'GRADE_OUT_OF_RANGE'
    | 'UNREADABLE_VALUE';
  labelAr: string;
  sourceRowIndex: number;
  nationalId: string | null;
  nameAr: string | null;
  totalGrade: number | null;
  detail: string;
}

export interface ImportValidationRule {
  schoolCategory: string | null;
  allowedGenders: readonly ('male' | 'female')[];
  ageMin: number | null;
  maxAge: number | null;
  ageReferenceDate: string | null;
}

interface ApplicationSettingsYearLike {
  graduationYears?: readonly number[];
  genderTypes?: readonly string[];
  ageMin?: number | null;
  maxAge?: number | null;
  ageReferenceDate?: string | null;
  schoolCategoryCodes?: readonly string[];
  isActive?: boolean;
}

interface ApplicationSettingsSummaryLike {
  groups?: readonly {
    years?: readonly ApplicationSettingsYearLike[];
  }[];
}

export interface IntegrityDecisionSummary {
  rejectedSourceRows: Set<number>;
  pendingOutOfRangeCount: number;
}

export function summarizeIntegrityDecisions(
  rows: readonly IntegrityAuditRow[],
  outOfRangeDecisions: Readonly<Record<number, 'accept' | 'reject'>>,
): IntegrityDecisionSummary {
  const rejectedSourceRows = new Set<number>();
  let pendingOutOfRangeCount = 0;
  const hardRejectedSourceRows = new Set(
    rows
      .filter((row) => row.code !== 'GRADE_OUT_OF_RANGE')
      .map((row) => row.sourceRowIndex),
  );

  for (const row of rows) {
    if (row.code === 'GRADE_OUT_OF_RANGE') {
      if (hardRejectedSourceRows.has(row.sourceRowIndex)) continue;
      const decision = outOfRangeDecisions[row.sourceRowIndex];
      if (decision === 'accept') continue;
      if (decision === 'reject') {
        rejectedSourceRows.add(row.sourceRowIndex);
        continue;
      }
      pendingOutOfRangeCount += 1;
      continue;
    }
    rejectedSourceRows.add(row.sourceRowIndex);
  }

  return { rejectedSourceRows, pendingOutOfRangeCount };
}

export function buildDuplicateAudit(
  rows: readonly NormalisedRow[],
): DuplicateAudit {
  const totalRows = rows.length;
  const counts = new Map<string, { count: number; nameAr: string | null }>();
  for (const r of rows) {
    if (!r.nationalId) continue;
    const cur = counts.get(r.nationalId);
    if (cur) {
      cur.count += 1;
      if (cur.nameAr == null && r.nameAr != null) cur.nameAr = r.nameAr;
    } else {
      counts.set(r.nationalId, { count: 1, nameAr: r.nameAr });
    }
  }

  let duplicateRowCount = 0;
  let duplicateNidGroups = 0;
  const distributionAll: DuplicateAuditEntry[] = [];
  for (const [nationalId, entry] of counts) {
    if (entry.count > 1) {
      duplicateRowCount += entry.count - 1;
      duplicateNidGroups += 1;
      distributionAll.push({ nationalId, nameAr: entry.nameAr, count: entry.count });
    }
  }
  distributionAll.sort((a, b) => b.count - a.count);

  const duplicateRatio = totalRows === 0 ? 0 : duplicateRowCount / totalRows;

  return {
    totalRows,
    uniqueNidCount: counts.size,
    duplicateNidGroups,
    duplicateRowCount,
    duplicateRatio,
    distribution: distributionAll.slice(0, DISTRIBUTION_CAP),
    exceedsThreshold: duplicateRatio > DUPLICATE_RATIO_THRESHOLD,
  };
}

export function dedupeRowsFirstOccurrence(rows: readonly NormalisedRow[]): {
  uniqueRows: NormalisedRow[];
  skippedRows: NormalisedRow[];
} {
  const seen = new Set<string>();
  const uniqueRows: NormalisedRow[] = [];
  const skippedRows: NormalisedRow[] = [];

  for (const row of rows) {
    if (!row.nationalId) {
      uniqueRows.push(row);
      continue;
    }
    if (seen.has(row.nationalId)) {
      skippedRows.push(row);
      continue;
    }
    seen.add(row.nationalId);
    uniqueRows.push(row);
  }

  return { uniqueRows, skippedRows };
}

export function buildIntegrityAuditRows(input: {
  rows: readonly NormalisedRow[];
  selectedSchoolCategories: readonly string[];
  maxGradeByCategory: Readonly<Record<string, number>>;
  validationRules?: readonly ImportValidationRule[];
}): IntegrityAuditRow[] {
  const fallbackMax =
    input.selectedSchoolCategories
      .map((code) => input.maxGradeByCategory[code])
      .find((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0) ?? null;

  const out: IntegrityAuditRow[] = [];
  for (const row of input.rows) {
    const missing: string[] = [];
    if (!row.nationalId) missing.push('الرقم القومي');
    if (!row.nameAr) missing.push('الاسم باللغة العربية');
    if (row.totalGrade == null) missing.push('المجموع الكلي');
    if (missing.length > 0) {
      out.push({
        code: 'MISSING_REQUIRED',
        labelAr: 'حقول مطلوبة فارغة',
        sourceRowIndex: row.sourceRowIndex,
        nationalId: row.nationalId,
        nameAr: row.nameAr,
        totalGrade: row.totalGrade,
        detail: `حقول مفقودة: ${missing.join('، ')}`,
      });
    }
    const nidInfo = row.nationalId ? parseNationalId(row.nationalId) : null;
    if (row.nationalId && !isValidNationalId(row.nationalId)) {
      out.push({
        code: 'INVALID_NID',
        labelAr: 'رقم قومي غير صالح',
        sourceRowIndex: row.sourceRowIndex,
        nationalId: row.nationalId,
        nameAr: row.nameAr,
        totalGrade: row.totalGrade,
        detail: `الرقم القومي يجب أن يتكون من 14 رقمًا صالحًا. القيمة الحالية: ${row.nationalId}`,
      });
    }

    if (row.nationalId && nidInfo?.valid && nidInfo.gender) {
      const importedGender = normaliseGender(row.gender);
      const rule = findValidationRule(row, input.validationRules ?? []);
      if (importedGender && importedGender !== nidInfo.gender) {
        out.push({
          code: 'GENDER_MISMATCH',
          labelAr: 'نوع لا يطابق الرقم القومي',
          sourceRowIndex: row.sourceRowIndex,
          nationalId: row.nationalId,
          nameAr: row.nameAr,
          totalGrade: row.totalGrade,
          detail: `الرقم القومي يشير إلى ${genderLabel(nidInfo.gender)} بينما عمود النوع يشير إلى ${genderLabel(importedGender)}`,
        });
      } else if (
        rule &&
        rule.allowedGenders.length > 0 &&
        !rule.allowedGenders.includes(nidInfo.gender)
      ) {
        out.push({
          code: 'GENDER_MISMATCH',
          labelAr: 'نوع خارج الإعدادات',
          sourceRowIndex: row.sourceRowIndex,
          nationalId: row.nationalId,
          nameAr: row.nameAr,
          totalGrade: row.totalGrade,
          detail: `الإعدادات تسمح بـ ${rule.allowedGenders.map(genderLabel).join(' / ')}، والرقم القومي يشير إلى ${genderLabel(nidInfo.gender)}`,
        });
      }

      if (rule && nidInfo.birthDate && rule.ageReferenceDate) {
        const referenceDate = parseIsoDate(rule.ageReferenceDate);
        if (referenceDate) {
          const age = calculateAge(nidInfo.birthDate, referenceDate);
          if (
            (rule.ageMin != null && age < rule.ageMin) ||
            (rule.maxAge != null && age > rule.maxAge)
          ) {
            out.push({
              code: 'AGE_OUT_OF_RANGE',
              labelAr: 'سن خارج الإعدادات',
              sourceRowIndex: row.sourceRowIndex,
              nationalId: row.nationalId,
              nameAr: row.nameAr,
              totalGrade: row.totalGrade,
              detail: `سن الطالب ${age} سنة، والنطاق المسموح ${rule.ageMin ?? '—'} إلى ${rule.maxAge ?? '—'} سنة`,
            });
          }
        }
      }
    }

    if (row.totalGrade == null) continue;
    if (!Number.isFinite(row.totalGrade)) {
      out.push({
        code: 'UNREADABLE_VALUE',
        labelAr: 'قيمة غير قابلة للقراءة',
        sourceRowIndex: row.sourceRowIndex,
        nationalId: row.nationalId,
        nameAr: row.nameAr,
        totalGrade: row.totalGrade,
        detail: 'المجموع الكلي ليس رقمًا صالحًا',
      });
      continue;
    }

    const max =
      row.maxGrade ??
      (row.schoolCategory ? input.maxGradeByCategory[row.schoolCategory] : undefined) ??
      fallbackMax;
    if (row.totalGrade < 0 || (typeof max === 'number' && row.totalGrade > max)) {
      out.push({
        code: 'GRADE_OUT_OF_RANGE',
        labelAr: 'درجة تتجاوز الدرجة العظمى',
        sourceRowIndex: row.sourceRowIndex,
        nationalId: row.nationalId,
        nameAr: row.nameAr,
        totalGrade: row.totalGrade,
        detail:
          row.totalGrade < 0
            ? 'المجموع الكلي أقل من صفر'
            : `المجموع الكلي (${row.totalGrade}) يتجاوز الدرجة العظمى (${max})`,
      });
    }
  }
  return out;
}

export function buildImportValidationRules(input: {
  settings: readonly ApplicationSettingsSummaryLike[] | null | undefined;
  selectedSchoolCategories: readonly string[];
  graduationYear: number | null;
}): ImportValidationRule[] {
  if (!input.settings || input.graduationYear == null) return [];
  const selected = new Set(input.selectedSchoolCategories);
  const rules: ImportValidationRule[] = [];

  for (const category of input.settings) {
    for (const group of category.groups ?? []) {
      for (const year of group.years ?? []) {
        if (year.isActive === false) continue;
        if (!year.graduationYears?.includes(input.graduationYear)) continue;
        const categories =
          year.schoolCategoryCodes?.filter((code) => selected.size === 0 || selected.has(code)) ?? [];
        const scopedCategories = categories.length > 0 ? categories : [null];
        const allowedGenders = [...new Set((year.genderTypes ?? []).map(normaliseGender).filter(isGender))];
        for (const schoolCategory of scopedCategories) {
          rules.push({
            schoolCategory,
            allowedGenders,
            ageMin: typeof year.ageMin === 'number' ? year.ageMin : null,
            maxAge: typeof year.maxAge === 'number' ? year.maxAge : null,
            ageReferenceDate: year.ageReferenceDate ?? null,
          });
        }
      }
    }
  }

  return rules;
}

function findValidationRule(
  row: NormalisedRow,
  rules: readonly ImportValidationRule[],
): ImportValidationRule | null {
  if (rules.length === 0) return null;
  const category = row.schoolCategory;
  return (
    rules.find((rule) => rule.schoolCategory != null && rule.schoolCategory === category) ??
    rules.find((rule) => rule.schoolCategory == null) ??
    null
  );
}

function normaliseGender(raw: string | null | undefined): 'male' | 'female' | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  if (['male', 'm', 'ذكر', 'ذكور', 'طالب', 'بنين'].includes(value)) return 'male';
  if (['female', 'f', 'أنثى', 'انثى', 'إناث', 'اناث', 'طالبة', 'بنات'].includes(value)) {
    return 'female';
  }
  return null;
}

function isGender(value: 'male' | 'female' | null): value is 'male' | 'female' {
  return value != null;
}

function genderLabel(gender: 'male' | 'female'): string {
  return gender === 'male' ? 'ذكر' : 'أنثى';
}

function parseIsoDate(value: string): Date | null {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function calculateAge(birthDate: Date, referenceDate: Date): number {
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const beforeBirthday =
    referenceDate.getMonth() < birthDate.getMonth() ||
    (referenceDate.getMonth() === birthDate.getMonth() &&
      referenceDate.getDate() < birthDate.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** Compose the full pre-import audit CSV — a single file containing
 *  the summary header rows, the duplicate distribution, and every
 *  failure-group row the preflight surfaced. Excel-friendly via the
 *  shared `serializeCsv` BOM. */
export function buildAuditCsv(input: {
  audit: DuplicateAudit;
  report: ImportReport | null;
  rows: readonly NormalisedRow[];
  integrityRows?: readonly IntegrityAuditRow[];
  graduationYear: number | null;
  fileName: string | null;
}): string {
  const { audit, report, rows, integrityRows = [], graduationYear, fileName } = input;
  const sections: Array<{ headers: readonly string[]; rows: ReadonlyArray<readonly unknown[]> }> = [];

  sections.push({
    headers: ['البند', 'القيمة'],
    rows: [
      ['اسم الملف', fileName ?? '—'],
      ['سنة التخرج', graduationYear ?? '—'],
      ['إجمالي الصفوف', audit.totalRows],
      ['عدد الأرقام القومية الفريدة', audit.uniqueNidCount],
      ['الأرقام القومية المكررة', audit.duplicateNidGroups],
      ['الصفوف المكررة', audit.duplicateRowCount],
      [
        'نسبة التكرار',
        audit.totalRows === 0
          ? '0٪'
          : `${(audit.duplicateRatio * 100).toFixed(2)}٪`,
      ],
      ['الصفوف المستوردة المتوقعة', report?.totals.imported ?? '—'],
      ['الصفوف المرفوضة', report?.totals.failed ?? '—'],
      ['الصفوف الملغاة', report?.totals.skipped ?? '—'],
    ],
  });

  if (audit.distribution.length > 0) {
    sections.push({
      headers: ['#', 'الرقم القومي', 'الاسم', 'عدد مرات التكرار'],
      rows: audit.distribution.map((d, i) => [
        i + 1,
        d.nationalId,
        d.nameAr ?? '—',
        d.count,
      ]),
    });
  }

  if (integrityRows.length > 0) {
    sections.push({
      headers: ['فحص السلامة الكامل'],
      rows: [['الكود', 'الفئة', 'الصف', 'الرقم القومي', 'الاسم', 'المجموع', 'الملاحظة']],
    });
    sections.push({
      headers: ['', '', '', '', '', '', ''],
      rows: integrityRows.map((r) => [
        r.code,
        r.labelAr,
        r.sourceRowIndex,
        r.nationalId ?? '',
        r.nameAr ?? '',
        r.totalGrade ?? '',
        r.detail,
      ]),
    });
  }

  /* Per-group failure rows: surface every group the preflight returned
   * so admins can audit which rows would have been rejected. The
   * preflight already caps each group at a sample limit upstream
   * (IMPORT_PREFLIGHT_GROUP_SAMPLE_LIMIT), so this is safe to inline. */
  if (report) {
    for (const group of report.groups) {
      if (group.rows.length === 0) continue;
      sections.push({
        headers: [`فئة المشكلة: ${group.labelAr} (${group.code})`],
        rows: [['الصف', 'الرقم القومي', 'الاسم', 'المجموع', 'الملاحظة']],
      });
      sections.push({
        headers: ['', '', '', '', ''],
        rows: group.rows.map((r) => [
          r.sourceRowIndex,
          r.nationalId ?? '',
          r.nameAr ?? '',
          r.totalGrade ?? '',
          r.detail ?? '',
        ]),
      });
    }
  }

  /* Intra-file duplicate rows in full — the preflight's DUPLICATE_NID
   * group is keyed on existing-record matches; intra-file dupes need
   * their own audit section so a reviewer can see exactly which rows
   * collide. Caps at 5000 rows to keep the CSV tractable for the
   * pathological-export case. */
  const intraDupes = buildUploadDuplicates(rows).slice(0, 200);
  if (intraDupes.length > 0) {
    sections.push({
      headers: ['التكرارات داخل الملف'],
      rows: [['الرقم القومي', 'الاسم', 'صف المصدر', 'المجموع', 'الشعبة', 'المدرسة']],
    });
    const flat: unknown[][] = [];
    for (const dup of intraDupes) {
      for (const row of dup.rows.slice(0, 50)) {
        flat.push([
          dup.nationalId,
          dup.nameAr ?? '—',
          row.sourceRowIndex,
          row.totalGrade ?? '',
          row.track ?? '',
          row.schoolName ?? '',
        ]);
        if (flat.length >= 5000) break;
      }
      if (flat.length >= 5000) break;
    }
    sections.push({ headers: ['', '', '', '', '', ''], rows: flat });
  }

  return sections
    .map((s) => serializeCsv(s.headers, s.rows))
    .join('\r\n\r\n');
}
