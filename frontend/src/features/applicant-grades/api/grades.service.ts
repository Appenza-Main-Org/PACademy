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
import { SEED_ROWS } from '../mock';
import type { ImportedGradeRow } from '../lib/parseAccessFile';
import type {
  AdjustmentReason,
  CommittedImport,
  GradeRow,
  ImportDuplicateRow,
  ImportResolution,
  ImportSkipBucket,
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
};

let pendingImport: {
  kind: 'general' | 'azhar';
  maxDegree: number;
  newRows: ImportedGradeRow[];
  duplicates: ImportDuplicateRow[];
} | null = null;
