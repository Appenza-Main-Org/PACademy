/**
 * Applicant Grades — service layer.
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/grades                          → GradeRow[]
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
 */

import { simulateLatency } from '@/shared/lib/mock-helpers';
import { isValidNationalId } from '@/shared/lib/national-id';
import { normalizeArabic } from '@/shared/lib/arabic';
import { easternToAscii } from '../lib/normalise';
import { SEED_ROWS } from '../mock';
import type { ImportedGradeRow } from '../lib/parseAccessFile';
import type {
  AdjustmentReason,
  CommittedImport,
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

let STATE: GradeRow[] = SEED_ROWS.map((r) => ({ ...r, log: r.log.map((e) => ({ ...e })) }));

const REASON_LABEL: Record<AdjustmentReason, string> = {
  SPORTS_ACTIVITY: 'نشاط رياضي',
  GRIEVANCE: 'تظلم',
  LEGAL_CASE: 'قضية',
  OTHER: 'أخرى',
};

function clone(rows: GradeRow[]): GradeRow[] {
  return rows.map((r) => ({ ...r, log: r.log.map((e) => ({ ...e })) }));
}

export const gradesService = {
  async list(): Promise<GradeRow[]> {
    await simulateLatency(120, 240);
    return clone(STATE);
  },

  async clearAll(): Promise<void> {
    await simulateLatency(80, 160);
    STATE = [];
  },

  async addAdjustment(
    seat: number,
    payload: { reason: AdjustmentReason; note: string | null; amount: number; isActive: boolean; by: string },
  ): Promise<GradeRow> {
    await simulateLatency(120, 240);
    STATE = STATE.map((r) =>
      r.seat === seat
        ? {
            ...r,
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
    STATE = STATE.map((r) =>
      r.seat === seat
        ? { ...r, log: r.log.map((e) => (e.id === entryId ? { ...e, isActive: !e.isActive } : e)) }
        : r,
    );
    const row = STATE.find((r) => r.seat === seat);
    if (!row) throw new Error(`Row ${seat} not found`);
    return clone([row])[0]!;
  },

  async deleteAdjustment(seat: number, entryId: string): Promise<GradeRow> {
    await simulateLatency(80, 160);
    STATE = STATE.map((r) =>
      r.seat === seat ? { ...r, log: r.log.filter((e) => e.id !== entryId) } : r,
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
    STATE = STATE.map((r) =>
      r.seat === seat
        ? {
            ...r,
            overrideMax,
            lastEditedAt: overrideMax == null ? null : 'الآن',
            lastEditedBy: overrideMax == null ? null : by,
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
      });
    }

    const newGradeRows: GradeRow[] = pending.newRows.map((r) => ({
      seat: r.seat,
      seatingNumber: String(r.seat),
      nid: r.nid,
      name: r.name,
      kind: r.kind,
      branch: r.branch,
      school: r.school,
      region: r.region,
      total: r.total,
      importMax: pending.maxDegree,
      overrideMax: null,
      lastEditedAt: null,
      lastEditedBy: null,
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
   */
  async runImportCommit(input: {
    rows: NormalisedRow[];
    graduationYear: number;
    perGroupActions: Record<ImportGroupCode, ImportGroupAction | undefined>;
  }): Promise<ImportCommitResult> {
    await simulateLatency(180, 340);
    const { rows, perGroupActions } = input;
    const existingByNid = new Map(STATE.map((r) => [r.nid, r]));
    let inserted = 0;
    let failed = 0;

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
      const isDup = existingByNid.has(row.nationalId);
      if (isDup) {
        const action = perGroupActions.DUPLICATE_NID;
        if (action === 'skip') {
          continue;
        }
        if (action !== 'override') {
          failed += 1;
          continue;
        }
        /* override → replace existing total + max in place. */
        const existing = existingByNid.get(row.nationalId)!;
        existingByNid.set(row.nationalId, {
          ...existing,
          total: row.totalGrade,
          importMax: row.maxGrade ?? existing.importMax,
          seatingNumber: row.seatingNumber ?? existing.seatingNumber,
          name: row.nameAr,
          branch: row.track,
          status: existing.status,
        });
        inserted += 1;
        continue;
      }

      const newRow: GradeRow = {
        seat: existingByNid.size + inserted + 1,
        seatingNumber: row.seatingNumber,
        nid: row.nationalId,
        name: row.nameAr,
        kind: row.maxGrade === 510 ? 'azhar' : 'general',
        branch: row.track,
        school: '',
        region: '',
        total: row.totalGrade,
        importMax: row.maxGrade ?? 410,
        overrideMax: null,
        lastEditedAt: null,
        lastEditedBy: null,
        status: '—',
        log: [],
      };
      existingByNid.set(row.nationalId, newRow);
      inserted += 1;
    }

    STATE = Array.from(existingByNid.values());
    return { insertedCount: inserted, failedCount: failed };
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
   */
  async listPaginated(input: {
    page: number;
    pageSize: number;
    search: string;
    sort?: { key: keyof GradeRow; direction: 'asc' | 'desc' } | null;
  }): Promise<{ rows: GradeRow[]; total: number }> {
    await simulateLatency(80, 200);
    const q = input.search.trim();
    let rows = STATE.slice();
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
    if (input.sort) {
      const { key, direction } = input.sort;
      const dir = direction === 'asc' ? 1 : -1;
      rows.sort((a, b) => {
        const av = a[key];
        const bv = b[key];
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
        return String(av ?? '').localeCompare(String(bv ?? ''), 'ar', { sensitivity: 'base' }) * dir;
      });
    }
    const total = rows.length;
    const start = Math.max(0, (input.page - 1) * input.pageSize);
    const page = rows.slice(start, start + input.pageSize);
    return { rows: clone(page), total };
  },

  /**
   * Export-side hook — returns the **entire filtered dataset** as a
   * flat array. Pagination is intentionally skipped because the
   * caller writes the result straight to disk (CSV/XLSX).
   */
  async exportAll(input: {
    search: string;
    sort?: { key: keyof GradeRow; direction: 'asc' | 'desc' } | null;
  }): Promise<GradeRow[]> {
    await simulateLatency(120, 260);
    const q = input.search.trim();
    let rows = STATE.slice();
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
    if (input.sort) {
      const { key, direction } = input.sort;
      const dir = direction === 'asc' ? 1 : -1;
      rows.sort((a, b) => {
        const av = a[key];
        const bv = b[key];
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
        return String(av ?? '').localeCompare(String(bv ?? ''), 'ar', { sensitivity: 'base' }) * dir;
      });
    }
    return clone(rows);
  },
};

let pendingImport: {
  kind: 'general' | 'azhar';
  maxDegree: number;
  newRows: ImportedGradeRow[];
  duplicates: ImportDuplicateRow[];
} | null = null;
