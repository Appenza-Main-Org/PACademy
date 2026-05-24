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

/** Compose the full pre-import audit CSV — a single file containing
 *  the summary header rows, the duplicate distribution, and every
 *  failure-group row the preflight surfaced. Excel-friendly via the
 *  shared `serializeCsv` BOM. */
export function buildAuditCsv(input: {
  audit: DuplicateAudit;
  report: ImportReport | null;
  rows: readonly NormalisedRow[];
  graduationYear: number | null;
  fileName: string | null;
}): string {
  const { audit, report, rows, graduationYear, fileName } = input;
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
