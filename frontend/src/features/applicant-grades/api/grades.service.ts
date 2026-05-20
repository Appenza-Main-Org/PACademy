/**
 * Applicant Grades — service layer.
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/grades                          → GradeRow[]
 *   DELETE /api/grades                          → { deleted: number }
 *     body:  { seats: number[] }
 *   POST   /api/grades/import/stage             → StagedImport
 *     body:  { kind, maxDegree, rows: ImportedGradeRow[] }
 *     409   { code: 'MISSING_REQUIRED_COLUMN', missing: string[] }
 *   POST   /api/grades/import/commit            → CommittedImport
 *     body:  { stageId, resolutions: Record<nid, 'ACCEPT' | 'REJECT'> }
 *   POST   /api/grades/:seat/adjustments        → GradeRow
 *     body:  { reason, note, amount, isActive }
 *   PATCH  /api/grades/:seat/adjustments/:id    → GradeRow
 *     body:  { isActive } | …
 *   DELETE /api/grades/:seat/adjustments/:id    → GradeRow
 *   PATCH  /api/grades/:seat/override-max       → GradeRow
 *     body:  { overrideMax: number | null }
 *   POST   /api/grades/v2/commit                → ImportCommitResult
 *     body:  { rows, graduationYear, selectedSchoolCategories,
 *              maxGradeByCategory, perGroupActions }
 *     `selectedSchoolCategories` are lookup codes from
 *     `school-categories` (e.g. `SCH-01`, `SCH-03`). The commit derives
 *     each row's `GradeKind` from its resolved schoolCategoryCode
 *     (azhar-coded categories → `azhar`, else → `general`) and seeds
 *     `importMax` from `maxGradeByCategory[code]`. Rows whose category
 *     is not in the selected set are skipped (counted as failed).
 */

import { simulateLatency } from '@/shared/lib/mock-helpers';
import { isValidNationalId } from '@/shared/lib/national-id';
import { normalizeArabic } from '@/shared/lib/arabic';
import { MOCK } from '@/shared/mock-data';
import { easternToAscii } from '../lib/normalise';
import { AZHAR_CATEGORY_CODES } from '../store/importWizard.store';
import type { ImportedGradeRow } from '../lib/parseAccessFile';
import type {
  AdjustmentReason,
  ApplicantGender,
  CommittedImport,
  GradeKind,
  GradeRow,
  ImportCommitResult,
  ImportDuplicateRow,
  ImportFailureRow,
  ImportGroupAction,
  ImportGroupCode,
  ImportReport,
  ImportReportGroup,
  ImportResolution,
  ImportSkipBucket,
  NormalisedRow,
  StagedImport,
} from '../types';

let STATE: GradeRow[] = [];

const REASON_LABEL: Record<AdjustmentReason, string> = {
  SPORTS_ACTIVITY: 'نشاط رياضي',
  GRIEVANCE: 'تظلم',
  LEGAL_CASE: 'قضية',
  OTHER: 'أخرى',
};

function clone(rows: GradeRow[]): GradeRow[] {
  return rows.map((r) => ({ ...r, log: r.log.map((e) => ({ ...e })) }));
}

/** Map a raw `النوع` cell to the typed gender enum. Matches the Arabic
 *  strings used by the existing seed + template (`ذكر` / `أنثى`) plus a
 *  few common synonyms / ASCII fallbacks. Defaults to `male` when the
 *  value is empty or unrecognised so downstream filters always have a
 *  bucket to land in. */
function resolveGender(raw: string | null): ApplicantGender {
  if (!raw) return 'male';
  const trimmed = raw.trim().toLowerCase();
  if (
    trimmed === 'أنثى' ||
    trimmed === 'انثى' ||
    trimmed === 'f' ||
    trimmed === 'female' ||
    trimmed === '2'
  ) {
    return 'female';
  }
  return 'male';
}

/** Resolve the import wizard's raw `فئة المدرسة` value (Arabic name or
 *  English code) against the active `school-categories` lookup. Returns
 *  the row `code` on match, `null` otherwise. */
function resolveSchoolCategoryCode(raw: string | null): string | null {
  if (!raw) return null;
  const needle = raw.trim();
  if (needle === '') return null;
  const lookup = MOCK.lookups['school-categories'];
  const direct = lookup.find((r) => r.code === needle);
  if (direct) return direct.code;
  const byName = lookup.find((r) => r.name === needle);
  if (byName) return byName.code;
  return null;
}

/** Resolve the import wizard's raw `الدور` value against the active
 * `exam-rounds` lookup. Returns the lookup code so stored rows remain
 * stable when display names change. */
function resolveExamRoundCode(raw: string | null): string | null {
  if (!raw) return null;
  const needle = raw.trim();
  if (needle === '') return null;
  const lookup = MOCK.lookups['exam-rounds'];
  const direct = lookup.find((r) => r.code === needle);
  if (direct) return direct.code;
  const byName = lookup.find((r) => r.name === needle);
  if (byName) return byName.code;
  return needle;
}

export const gradesService = {
  async list(): Promise<GradeRow[]> {
    await simulateLatency(120, 240);
    return clone(STATE);
  },

  /**
   * Look up a single grade row by national ID within a cycle.
   *
   * INTEGRATION CONTRACT:
   *   GET /api/admin/applicant-grades/by-nid/:nid?cycleId=…
   *   200 → GradeRow
   *   404 → null
   *
   * Mock: the in-memory STATE is implicitly scoped to the active cycle
   * (no per-row cycleId today — the dataset is wiped on cycle rollover).
   * The `cycleId` parameter is accepted for contract parity and used as
   * part of the query key so cache invalidation flows naturally on
   * cycle change.
   */
  async findByNationalId(nid: string, _cycleId: string): Promise<GradeRow | null> {
    await simulateLatency(120, 240);
    const match = STATE.find((r) => r.nid === nid);
    return match ? clone([match])[0]! : null;
  },

  async clearAll(): Promise<void> {
    await simulateLatency(80, 160);
    STATE = [];
  },

  async deleteRows(seats: readonly number[]): Promise<{ deleted: number }> {
    await simulateLatency(80, 180);
    const selected = new Set(seats);
    const before = STATE.length;
    STATE = STATE.filter((row) => !selected.has(row.seat));
    return { deleted: before - STATE.length };
  },

  async addAdjustment(
    seat: number,
    payload: { reason: AdjustmentReason; note: string | null; amount: number; isActive: boolean; by: string },
  ): Promise<GradeRow> {
    await simulateLatency(120, 240);
    const now = new Date().toISOString();
    STATE = STATE.map((r) =>
      r.seat === seat
        ? {
            ...r,
            gradeChangedAt: now,
            lastEditedBy: payload.by,
            lastEditedAt: 'الآن',
            log: [
              {
                id: `adj-${Date.now()}`,
                reason: payload.reason,
                reasonLabel: REASON_LABEL[payload.reason],
                note: payload.note ?? '',
                amount: payload.amount,
                by: payload.by,
                when: 'الآن',
                isActive: payload.isActive,
                fresh: true,
              },
              ...r.log,
            ],
          }
        : r,
    );
    const row = STATE.find((r) => r.seat === seat);
    if (!row) throw new Error(`Row ${seat} not found`);
    return clone([row])[0]!;
  },

  async toggleAdjustment(seat: number, entryId: string): Promise<GradeRow> {
    await simulateLatency(80, 160);
    const now = new Date().toISOString();
    STATE = STATE.map((r) =>
      r.seat === seat
        ? {
            ...r,
            gradeChangedAt: now,
            lastEditedAt: 'الآن',
            log: r.log.map((e) => (e.id === entryId ? { ...e, isActive: !e.isActive } : e)),
          }
        : r,
    );
    const row = STATE.find((r) => r.seat === seat);
    if (!row) throw new Error(`Row ${seat} not found`);
    return clone([row])[0]!;
  },

  async deleteAdjustment(seat: number, entryId: string): Promise<GradeRow> {
    await simulateLatency(80, 160);
    const now = new Date().toISOString();
    STATE = STATE.map((r) =>
      r.seat === seat
        ? {
            ...r,
            gradeChangedAt: now,
            lastEditedAt: 'الآن',
            log: r.log.filter((e) => e.id !== entryId),
          }
        : r,
    );
    const row = STATE.find((r) => r.seat === seat);
    if (!row) throw new Error(`Row ${seat} not found`);
    return clone([row])[0]!;
  },

  async updateOverrideMax(
    seat: number,
    overrideMax: number | null,
    by: string,
  ): Promise<GradeRow> {
    await simulateLatency(120, 240);
    const now = new Date().toISOString();
    STATE = STATE.map((r) =>
      r.seat === seat
        ? {
            ...r,
            overrideMax,
            lastEditedAt: overrideMax == null ? null : 'الآن',
            lastEditedBy: overrideMax == null ? null : by,
            gradeChangedAt: now,
          }
        : r,
    );
    const row = STATE.find((r) => r.seat === seat);
    if (!row) throw new Error(`Row ${seat} not found`);
    return clone([row])[0]!;
  },

  /* ── Import wizard ────────────────────────────────────────────── */

  async stageImport(input: {
    kind: 'general' | 'azhar';
    maxDegree: number;
    rows: ImportedGradeRow[];
  }): Promise<{ ok: true; staged: StagedImport } | { ok: false; missing: string[] }> {
    await simulateLatency(120, 240);
    const { kind, maxDegree, rows } = input;
    const existingByNid = new Map(STATE.map((r) => [r.nid, r]));

    const newRows: ImportedGradeRow[] = [];
    const dupRows: ImportDuplicateRow[] = [];
    const overflow: Array<{ row: number; detail: string }> = [];

    rows.forEach((row, i) => {
      if (row.total > maxDegree) {
        overflow.push({
          row: i + 2,
          detail: `رقم جلوس ${row.seat.toLocaleString('en')} · المجموع = ${row.total}`,
        });
        return;
      }
      const existing = existingByNid.get(row.nid);
      if (!existing) {
        newRows.push(row);
        return;
      }
      const changedFields: Array<'total' | 'branch' | 'school' | 'region' | 'status' | 'seat'> = [];
      if (existing.total !== row.total) changedFields.push('total');
      if (existing.branch !== row.branch) changedFields.push('branch');
      if (existing.school !== row.school) changedFields.push('school');
      if (existing.region !== row.region) changedFields.push('region');
      if (existing.status !== row.status) changedFields.push('status');
      if (existing.seat !== row.seat) changedFields.push('seat');
      const adjustmentSum = existing.log
        .filter((x) => x.isActive)
        .reduce((s, x) => s + x.amount, 0);
      dupRows.push({
        nationalId: row.nid,
        name: row.name,
        kind,
        seatExisting: existing.seat,
        seatIncoming: row.seat,
        maxDegree,
        hasChanges: changedFields.length > 0,
        changedFields,
        existing: {
          total: existing.total,
          branch: existing.branch,
          school: existing.school,
          region: existing.region,
          status: existing.status,
        },
        incoming: {
          total: row.total,
          branch: row.branch,
          school: row.school,
          region: row.region,
          status: row.status,
        },
        adjustmentSum,
        adjustmentCount: existing.log.filter((x) => x.isActive).length,
      });
    });

    const skipped: ImportSkipBucket[] = [];
    if (overflow.length > 0) {
      skipped.push({
        reason: 'TOTAL_EXCEEDS_MAX',
        label: 'تجاوز الدرجة العظمى',
        count: overflow.length,
        tone: 'terra',
        rows: overflow.slice(0, 50),
      });
    }

    pendingImport = { kind, maxDegree, newRows, duplicates: dupRows };

    return {
      ok: true,
      staged: { newRows: newRows.length, duplicates: dupRows, skipped },
    };
  },

  async commitImport(
    staged: StagedImport,
    resolutions: Record<string, ImportResolution>,
  ): Promise<CommittedImport> {
    await simulateLatency(180, 320);
    const pending = pendingImport;
    if (!pending) {
      throw new Error('No staged import to commit. Call stageImport first.');
    }

    const acceptedNids = new Set(
      Object.entries(resolutions)
        .filter(([, r]) => r === 'ACCEPT')
        .map(([nid]) => nid),
    );
    const rejectedCount = Object.values(resolutions).filter((r) => r === 'REJECT').length;

    const existingByNid = new Map(STATE.map((r) => [r.nid, r]));
    const deactivated: CommittedImport['deactivated'] = [];

    for (const dup of pending.duplicates) {
      if (!acceptedNids.has(dup.nationalId)) continue;
      const existing = existingByNid.get(dup.nationalId);
      if (!existing) continue;

      const incomingTotal = dup.incoming.total;
      const adjSum = existing.log.filter((x) => x.isActive).reduce((s, x) => s + x.amount, 0);
      const projected = incomingTotal + adjSum;
      const overMax = projected > pending.maxDegree;
      const belowZero = projected < 0;

      const shouldDeactivate = (overMax || belowZero) && existing.log.some((x) => x.isActive);
      const nextLog = shouldDeactivate
        ? existing.log.map((x) => ({ ...x, isActive: false }))
        : existing.log;

      if (shouldDeactivate) {
        deactivated.push({
          nationalId: dup.nationalId,
          name: dup.name,
          adjustmentSum: adjSum,
        });
      }

      const totalChanged = existing.total !== incomingTotal;
      existingByNid.set(dup.nationalId, {
        ...existing,
        seat: dup.seatIncoming,
        name: dup.name,
        kind: pending.kind,
        branch: dup.incoming.branch,
        school: dup.incoming.school,
        region: dup.incoming.region,
        status: dup.incoming.status,
        total: incomingTotal,
        importMax: pending.maxDegree,
        log: nextLog,
        previousGrade: totalChanged ? existing.total : existing.previousGrade,
        gradeChangedAt: totalChanged ? new Date().toISOString() : existing.gradeChangedAt,
        lastEditedAt: totalChanged ? 'الآن' : existing.lastEditedAt,
        lastEditedBy: totalChanged ? 'استيراد ملف' : existing.lastEditedBy,
      });
    }

    const newGradeRows: GradeRow[] = pending.newRows.map((r) => ({
      seat: r.seat,
      seatingNumber: String(r.seat),
      nid: r.nid,
      name: r.name,
      kind: r.kind,
      gender: 'male',
      branch: r.branch,
      graduationYear: null,
      schoolCategoryCode: null,
      school: r.school,
      region: r.region,
      examRound: null,
      total: r.total,
      importMax: pending.maxDegree,
      overrideMax: null,
      lastEditedAt: null,
      lastEditedBy: null,
      gradeChangedAt: null,
      previousGrade: null,
      status: r.status,
      log: [],
    }));
    STATE = [...existingByNid.values(), ...newGradeRows];
    pendingImport = null;

    return {
      inserted: pending.newRows.length + acceptedNids.size,
      replaced: acceptedNids.size,
      kept: rejectedCount,
      deactivated,
      skipped: staged.skipped,
    };
  },

  /* ── Import wizard v2 ───────────────────────────────────────── */

  /**
   * Bucket every normalised row into success / failure groups according
   * to the v2 wizard's semantics. Mock-side bookkeeping: rows that
   * make it through every check end up countable as `imported`; rows
   * that hit any group are reflected in `failed`. The grouping is
   * exclusive — each row contributes to *one* group max, in the
   * declared order below (DUPLICATE_NID before INVALID_NID, etc.) so
   * the totals stay coherent.
   */
  async runImportPreflight(input: {
    rows: NormalisedRow[];
    graduationYear: number;
  }): Promise<ImportReport> {
    await simulateLatency(120, 240);
    const { rows } = input;
    const existingNids = new Set(STATE.map((r) => r.nid));

    const buckets: Record<ImportGroupCode, ImportFailureRow[]> = {
      DUPLICATE_NID: [],
      INVALID_NID: [],
      MISSING_REQUIRED: [],
      NID_NOT_FOUND: [],
      GRADE_OUT_OF_RANGE: [],
      UNREADABLE_VALUE: [],
    };

    let imported = 0;
    for (const row of rows) {
      const failure: ImportFailureRow = {
        nationalId: row.nationalId,
        seatingNumber: row.seatingNumber,
        nameAr: row.nameAr,
        totalGrade: row.totalGrade,
        sourceRowIndex: row.sourceRowIndex,
      };

      if (!row.nationalId || !row.nameAr) {
        const missing = [
          !row.nationalId ? 'الرقم القومي' : null,
          !row.nameAr ? 'الاسم' : null,
        ]
          .filter((x): x is string => x !== null)
          .join(' · ');
        buckets.MISSING_REQUIRED.push({ ...failure, detail: missing });
        continue;
      }

      if (!/^\d{14}$/.test(row.nationalId) || !isValidNationalId(row.nationalId)) {
        buckets.INVALID_NID.push({ ...failure, detail: 'رقم قومي غير صالح' });
        continue;
      }

      if (row.totalGrade == null || !Number.isFinite(row.totalGrade)) {
        buckets.UNREADABLE_VALUE.push({ ...failure, detail: 'تعذّر قراءة المجموع' });
        continue;
      }

      const max = row.maxGrade ?? Infinity;
      if (row.totalGrade < 0 || row.totalGrade > max) {
        buckets.GRADE_OUT_OF_RANGE.push({
          ...failure,
          detail:
            row.maxGrade != null
              ? `المجموع ${row.totalGrade} خارج النطاق (0–${row.maxGrade})`
              : `المجموع ${row.totalGrade} سالب`,
        });
        continue;
      }

      if (existingNids.has(row.nationalId)) {
        buckets.DUPLICATE_NID.push({ ...failure, detail: 'الرقم القومي موجود مسبقًا' });
        continue;
      }

      /* For the mock layer we don't have a true cycle-applicant
       * registry; flag rows whose national-ID isn't in any seeded
       * Ministry list as `NID_NOT_FOUND` only when the wizard is run
       * against a non-empty applicant pool. Until that integration
       * lands, every passing row counts as imported. */
      imported += 1;
    }

    const groups: ImportReportGroup[] = [];
    const pushGroup = (
      code: ImportGroupCode,
      labelAr: string,
      actions: readonly ImportGroupAction[],
    ): void => {
      const list = buckets[code];
      if (list.length === 0) return;
      groups.push({ code, labelAr, rows: list, availableActions: actions });
    };
    pushGroup('DUPLICATE_NID', 'أرقام قومية مكررة', ['skip', 'override', 'export']);
    pushGroup('INVALID_NID', 'أرقام قومية غير صالحة', ['skip', 'export']);
    pushGroup('MISSING_REQUIRED', 'حقول مطلوبة فارغة', ['skip', 'export']);
    pushGroup('NID_NOT_FOUND', 'متقدمون غير مسجلين بالدورة', ['skip', 'create-applicant', 'export']);
    pushGroup('GRADE_OUT_OF_RANGE', 'مجاميع خارج النطاق', ['skip', 'override', 'export']);
    pushGroup('UNREADABLE_VALUE', 'قيم غير قابلة للقراءة', ['skip', 'export']);

    const failed = groups.reduce((s, g) => s + g.rows.length, 0);
    return {
      totals: {
        received: rows.length,
        imported,
        skipped: 0,
        failed,
      },
      groups,
    };
  },

  /**
   * Commit the wizard's surviving rows, applying the per-group action
   * decisions (skip / override / create-applicant). Mock-side: only
   * rows that passed every preflight check are written; override/skip
   * decisions adjust how many of the failure rows get re-counted as
   * inserted or dropped.
   *
   * `kind` is derived per-row from each row's resolved
   * `schoolCategoryCode`: codes in `AZHAR_CATEGORY_CODES` (`SCH-03`) →
   * `azhar`; everything else → `general`. Rows that don't resolve to a
   * code in `selectedSchoolCategories` are skipped — the admin picked
   * the categories the file is supposed to land into, so anything
   * outside that set is treated as an authoring error.
   */
  async runImportCommit(input: {
    rows: NormalisedRow[];
    graduationYear: number;
    selectedSchoolCategories: string[];
    maxGradeByCategory: Record<string, number>;
    perGroupActions: Record<ImportGroupCode, ImportGroupAction | undefined>;
    /** Optional per-row accept/reject decisions from the wizard's
     *  diff-review step. When provided, decisions here override the
     *  per-group `DUPLICATE_NID` action for the matching national-ids
     *  — `accept` writes the incoming row, `reject` leaves the
     *  existing record untouched. */
    existingDiffDecisions?: Record<string, 'accept' | 'reject' | 'pending'>;
    /** Resolution for intra-upload duplicate-NID cases (same NID with
     *  two or more rows in the same file). Defaults to `pick-higher`
     *  per-NID when no entry is provided. `pick-row` picks the row
     *  whose `sourceRowIndex` equals `pickedSourceRowIndex`. */
    uploadDuplicateDecisions?: Record<
      string,
      | { action: 'pick-higher' }
      | { action: 'pick-lower' }
      | { action: 'pick-specific'; pickedTotal: number }
      | { action: 'pick-row'; pickedSourceRowIndex: number }
      | { action: 'reject' }
    >;
  }): Promise<ImportCommitResult> {
    await simulateLatency(180, 340);
    const {
      rows: incomingRows,
      selectedSchoolCategories,
      maxGradeByCategory,
      perGroupActions,
      existingDiffDecisions,
      uploadDuplicateDecisions,
    } = input;

    /* ── Pre-pass: collapse intra-upload duplicate totals ─────────
     * Group rows by NID. When the same NID shows up with two distinct
     * non-null `totalGrade` values, apply the admin's decision before
     * the per-row processing below. Rejected NIDs are removed entirely
     * (counted as failed in the result); picked NIDs keep exactly one
     * row at the chosen total. */
    const rowsByNid = new Map<string, NormalisedRow[]>();
    for (const r of incomingRows) {
      if (!r.nationalId) {
        rowsByNid.set(`__no-nid-${r.sourceRowIndex}`, [r]);
        continue;
      }
      const bucket = rowsByNid.get(r.nationalId);
      if (bucket) bucket.push(r);
      else rowsByNid.set(r.nationalId, [r]);
    }

    const rows: NormalisedRow[] = [];
    let preFailed = 0;
    for (const [, bucket] of rowsByNid) {
      if (bucket.length === 1) {
        rows.push(bucket[0]!);
        continue;
      }
      const nid = bucket[0]!.nationalId;
      if (!nid) {
        /* No-NID synthetic key — bucket is always one row long, but
         * guard defensively in case the bucketing logic changes. */
        rows.push(bucket[0]!);
        continue;
      }
      const decision = uploadDuplicateDecisions?.[nid] ?? { action: 'pick-higher' };
      if (decision.action === 'reject') {
        preFailed += bucket.length;
        continue;
      }
      if (decision.action === 'pick-row') {
        const picked = bucket.find(
          (r) => r.sourceRowIndex === decision.pickedSourceRowIndex,
        );
        if (picked) {
          rows.push(picked);
        } else {
          /* Stale source-row index — fall back to highest total so a
           * record is never silently lost. */
          rows.push(pickByHighestTotal(bucket));
        }
        continue;
      }
      const totals = bucket
        .map((r) => r.totalGrade)
        .filter((t): t is number => t != null && Number.isFinite(t));
      const distinct = Array.from(new Set(totals));
      if (distinct.length <= 1) {
        /* No total conflict — same total appears twice. Keep the first
         * row and drop the rest. */
        rows.push(bucket[0]!);
        continue;
      }
      let pickedTotal: number;
      if (decision.action === 'pick-higher') {
        pickedTotal = Math.max(...distinct);
      } else if (decision.action === 'pick-lower') {
        pickedTotal = Math.min(...distinct);
      } else {
        pickedTotal = decision.pickedTotal;
      }
      const picked = bucket.find((r) => r.totalGrade === pickedTotal);
      if (picked) {
        rows.push(picked);
        /* The rest are silently dropped — they're not failures, just
         * deduplicated against the resolved row. */
      } else {
        /* `pick-specific` with a stale total the file no longer has —
         * fall back to pick-higher so we never silently lose a record. */
        rows.push(pickByHighestTotal(bucket));
      }
    }
    const allowedCategories = new Set(selectedSchoolCategories);
    const existingByNid = new Map(STATE.map((r) => [r.nid, r]));
    let inserted = 0;
    let failed = preFailed;
    let alreadyImported = 0;

    for (const row of rows) {
      if (!row.nationalId || !row.nameAr || !row.track) {
        failed += 1;
        continue;
      }
      if (!/^\d{14}$/.test(row.nationalId) || !isValidNationalId(row.nationalId)) {
        failed += 1;
        continue;
      }
      if (row.totalGrade == null || !Number.isFinite(row.totalGrade)) {
        failed += 1;
        continue;
      }
      const gender = resolveGender(row.gender);
      const graduationYear = row.graduationYear ?? input.graduationYear;
      const resolvedFromRow = resolveSchoolCategoryCode(row.schoolCategory);
      const examRoundCode = resolveExamRoundCode(row.examRound);
      /* Single-select fallback: when the admin picked exactly one
       * category in Step 1 and the row's own `schoolCategory` cell is
       * empty or doesn't match the lookup, assume the picked category
       * — admins typically import a homogenous file per category and
       * shouldn't have to add a column just to repeat that fact. With
       * a multi-select selection we keep the strict per-row resolve
       * so each row lands in the right bucket. */
      const schoolCategoryCode: string | null =
        resolvedFromRow ??
        (selectedSchoolCategories.length === 1 ? selectedSchoolCategories[0]! : null);

      /* When the admin restricts the import to a category subset and
       * the row's resolved code is not in it (or is unresolved), the
       * row is rejected. When no categories are picked we fall back
       * to legacy behaviour (accept everything) so existing flows keep
       * working until the admin opts into the new per-category UI. */
      if (allowedCategories.size > 0) {
        if (schoolCategoryCode === null || !allowedCategories.has(schoolCategoryCode)) {
          failed += 1;
          continue;
        }
      }

      const kind: GradeKind =
        schoolCategoryCode !== null && AZHAR_CATEGORY_CODES.includes(schoolCategoryCode)
          ? 'azhar'
          : 'general';
      const categoryMax =
        schoolCategoryCode !== null && maxGradeByCategory[schoolCategoryCode] != null
          ? maxGradeByCategory[schoolCategoryCode]
          : kind === 'azhar'
            ? 510
            : 410;

      const isDup = existingByNid.has(row.nationalId);
      if (isDup) {
        /* (NID, graduationYear) exact match against the existing row →
         * silently skip. Per the import contract, these rows are the
         * same student from the same cohort that's already in the
         * database, so they must not be re-counted as inserts or
         * failures. The admin was informed in Step 5 / Step 6 banners
         * that this count would be auto-skipped. Same NID with a
         * different graduation year is a real re-applicant case and
         * falls through to the per-row decision flow below. */
        const existingRow = existingByNid.get(row.nationalId)!;
        if (
          existingRow.graduationYear != null &&
          existingRow.graduationYear === row.graduationYear
        ) {
          alreadyImported += 1;
          continue;
        }
        /* Per-row decisions trump the global per-group action. Only
         * when the admin hasn't flipped a switch for this nid do we
         * fall back to perGroupActions.DUPLICATE_NID — which preserves
         * the legacy bulk-skip/bulk-override path for admins who never
         * opened the Step 6 diff view. */
        const perRow = existingDiffDecisions?.[row.nationalId];
        let writeOverride: boolean;
        if (perRow === 'accept') {
          writeOverride = true;
        } else if (perRow === 'reject' || perRow === 'pending') {
          continue;
        } else if (existingDiffDecisions != null) {
          continue;
        } else {
          const action = perGroupActions.DUPLICATE_NID;
          if (action === 'skip') {
            continue;
          }
          if (action !== 'override') {
            failed += 1;
            continue;
          }
          writeOverride = true;
        }
        if (!writeOverride) {
          failed += 1;
          continue;
        }
        /* override → replace existing total + max in place. Capture
         * the prior raw total as `previousGrade` whenever the incoming
         * row actually shifts the value, so /admin/applicant-grades/changes
         * can render a meaningful diff. The change timestamp is bumped
         * regardless — overriding to the same total still represents a
         * deliberate admin decision. Optional examRound / schoolName /
         * regionName fall back to the existing value when unmapped so
         * an incomplete override doesn't blank out prior data. */
        const existing = existingByNid.get(row.nationalId)!;
        const totalChanged = existing.total !== row.totalGrade;
        existingByNid.set(row.nationalId, {
          ...existing,
          kind,
          gender,
          total: row.totalGrade,
          importMax: row.maxGrade ?? categoryMax,
          seatingNumber: row.seatingNumber ?? existing.seatingNumber,
          name: row.nameAr,
          branch: row.track,
          graduationYear,
          schoolCategoryCode: schoolCategoryCode ?? existing.schoolCategoryCode,
          school: row.schoolName ?? existing.school,
          region: row.regionName ?? existing.region,
          examRound: examRoundCode ?? existing.examRound,
          status: existing.status,
          previousGrade: totalChanged ? existing.total : existing.previousGrade,
          gradeChangedAt: new Date().toISOString(),
          lastEditedAt: 'الآن',
          lastEditedBy: 'استيراد ملف',
        });
        inserted += 1;
        continue;
      }

      const newRow: GradeRow = {
        seat: existingByNid.size + inserted + 1,
        seatingNumber: row.seatingNumber,
        nid: row.nationalId,
        name: row.nameAr,
        kind,
        gender,
        branch: row.track,
        graduationYear,
        schoolCategoryCode,
        school: row.schoolName ?? '',
        region: row.regionName ?? '',
        examRound: examRoundCode,
        total: row.totalGrade,
        importMax: row.maxGrade ?? categoryMax,
        overrideMax: null,
        lastEditedAt: null,
        lastEditedBy: null,
        gradeChangedAt: null,
        previousGrade: null,
        status: '—',
        log: [],
      };
      existingByNid.set(row.nationalId, newRow);
      inserted += 1;
    }

    STATE = Array.from(existingByNid.values());
    return {
      insertedCount: inserted,
      failedCount: failed,
      alreadyImportedCount: alreadyImported,
    };
  },

  /* ── Paginated list (v2) ────────────────────────────────────── */

  /**
   * Server-side paginated + searchable list. The mock filters + sorts
   * in-memory; once the backend lands, this becomes a single query
   * against the cycle-scoped grades view.
   *
   * Search matches:
   *  - `nid` exact / prefix on the digit string
   *  - `seatingNumber` exact / prefix (digit-form-insensitive)
   *  - `nameAr` substring (Arabic-normalised, diacritic-insensitive)
   *
   * INTEGRATION CONTRACT:
   *   GET /api/grades?page=&size=&q=&gender=&branch=&year=&schoolCategoryCode=
   *   The four filter fields each default to `'all'` (no filter); the
   *   query string just omits them in that case. Server returns the
   *   same `{ rows, total }` envelope.
   */
  async listPaginated(input: {
    page: number;
    pageSize: number;
    search: string;
    sort?: { key: keyof GradeRow; direction: 'asc' | 'desc' } | null;
    gender?: ApplicantGender | 'all';
    branch?: string | 'all';
    graduationYear?: number | 'all';
    schoolCategoryCode?: string | 'all';
    /** When true, restrict the result set to rows with `gradeChangedAt`
     *  set (or any active adjustment). Mirrors the toggle the list page
     *  exposes for the grade-change audit view. */
    changedOnly?: boolean;
  }): Promise<{ rows: GradeRow[]; total: number }> {
    await simulateLatency(80, 200);
    const rows = applyFilters(STATE, input);
    sortInPlace(rows, input.sort);
    const total = rows.length;
    const start = Math.max(0, (input.page - 1) * input.pageSize);
    const page = rows.slice(start, start + input.pageSize);
    return { rows: clone(page), total };
  },

  /**
   * Export-side hook — returns the **entire filtered dataset** as a
   * flat array. Pagination is intentionally skipped because the
   * caller writes the result straight to disk (CSV/XLSX).
   *
   * INTEGRATION CONTRACT:
   *   GET /api/grades/export?q=&gender=&branch=&year=&schoolCategoryCode=
   *   Same filter set as `listPaginated`; server streams the full
   *   filtered set in a single response.
   */
  async exportAll(input: {
    search: string;
    sort?: { key: keyof GradeRow; direction: 'asc' | 'desc' } | null;
    gender?: ApplicantGender | 'all';
    branch?: string | 'all';
    graduationYear?: number | 'all';
    schoolCategoryCode?: string | 'all';
    changedOnly?: boolean;
  }): Promise<GradeRow[]> {
    await simulateLatency(120, 260);
    const rows = applyFilters(STATE, input);
    sortInPlace(rows, input.sort);
    return clone(rows);
  },
};

interface FilterInput {
  search: string;
  gender?: ApplicantGender | 'all';
  branch?: string | 'all';
  graduationYear?: number | 'all';
  schoolCategoryCode?: string | 'all';
  changedOnly?: boolean;
}

/** True when the row has been touched after its initial import — either
 *  a recorded `gradeChangedAt` timestamp or any adjustment in the log. */
export function hasGradeChange(r: GradeRow): boolean {
  return r.gradeChangedAt != null || r.log.length > 0;
}

function applyFilters(source: readonly GradeRow[], input: FilterInput): GradeRow[] {
  const q = input.search.trim();
  let rows = source.slice();
  if (q.length > 0) {
    const qDigits = easternToAscii(q).replace(/\D/g, '');
    const qNorm = normalizeArabic(q);
    rows = rows.filter((r) => {
      if (qDigits && (r.nid.startsWith(qDigits) || (r.seatingNumber ?? '').startsWith(qDigits))) {
        return true;
      }
      if (qNorm && normalizeArabic(r.name).includes(qNorm)) return true;
      return false;
    });
  }
  if (input.gender && input.gender !== 'all') {
    rows = rows.filter((r) => r.gender === input.gender);
  }
  if (input.branch && input.branch !== 'all') {
    rows = rows.filter((r) => r.branch === input.branch);
  }
  if (input.graduationYear && input.graduationYear !== 'all') {
    rows = rows.filter((r) => r.graduationYear === input.graduationYear);
  }
  if (input.changedOnly) {
    rows = rows.filter(hasGradeChange);
  }
  if (input.schoolCategoryCode && input.schoolCategoryCode !== 'all') {
    rows = rows.filter((r) => r.schoolCategoryCode === input.schoolCategoryCode);
  }
  return rows;
}

function sortInPlace(
  rows: GradeRow[],
  sort: { key: keyof GradeRow; direction: 'asc' | 'desc' } | null | undefined,
): void {
  if (!sort) return;
  const { key, direction } = sort;
  const dir = direction === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return String(av ?? '').localeCompare(String(bv ?? ''), 'ar', { sensitivity: 'base' }) * dir;
  });
}

let pendingImport: {
  kind: 'general' | 'azhar';
  maxDegree: number;
  newRows: ImportedGradeRow[];
  duplicates: ImportDuplicateRow[];
} | null = null;

/** Pick the row with the highest non-null `totalGrade`. Falls back to
 *  the first row when no totals are usable. */
function pickByHighestTotal(bucket: NormalisedRow[]): NormalisedRow {
  let best = bucket[0]!;
  let bestTotal = Number.NEGATIVE_INFINITY;
  for (const r of bucket) {
    const t = r.totalGrade;
    if (t != null && Number.isFinite(t) && t > bestTotal) {
      best = r;
      bestTotal = t;
    }
  }
  return best;
}
