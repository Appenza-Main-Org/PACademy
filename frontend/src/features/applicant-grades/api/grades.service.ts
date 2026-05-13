/**
 * Applicant Grades — service layer.
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/grades                          → GradeRow[]
 *   POST   /api/grades/import/stage             → StagedImport
 *     body:  { kind, maxDegree, fileId }
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
import { SAMPLE_DUPLICATES, SEED_ROWS } from '../mock';
import type {
  AdjustmentReason,
  CommittedImport,
  GradeRow,
  ImportResolution,
  StagedImport,
} from '../types';

/* In-memory store — replicates how the polished mock layer keeps state
 * across query refetches within a single browser session. */
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

  /**
   * Stage an import file. Returns the staged duplicates + parse skip
   * buckets for review. Filenames containing "ناقص" / "missing" / "error"
   * route to the MISSING_REQUIRED_COLUMN error path (handled by callers).
   */
  async stageImport(input: {
    kind: 'general' | 'azhar';
    maxDegree: number;
    file: { name: string };
  }): Promise<{ ok: true; staged: StagedImport } | { ok: false; missing: string[] }> {
    await simulateLatency(280, 480);
    const nm = input.file.name.toLowerCase();
    if (nm.includes('ناقص') || nm.includes('missing') || nm.includes('error')) {
      return { ok: false, missing: ['arabic_name', 'branch_desc_new', 'student_case_desc'] };
    }
    return {
      ok: true,
      staged: {
        newRows: 3082 - SAMPLE_DUPLICATES.length,
        duplicates: SAMPLE_DUPLICATES.map((d) => ({
          ...d,
          changedFields: [...d.changedFields],
        })),
        skipped: [
          {
            reason: 'TOTAL_EXCEEDS_MAX',
            label: 'تجاوز الدرجة العظمى',
            count: 28,
            tone: 'terra',
            rows: [
              { row: 47, detail: 'رقم جلوس 142,118 · المجموع = 415' },
              { row: 213, detail: 'رقم جلوس 143,002 · المجموع = 412' },
            ],
          },
          {
            reason: 'PARSE_ERROR',
            label: 'تعذر قراءة الصف',
            count: 3,
            tone: 'warning',
            rows: [{ row: 1248, detail: 'قيمة غير رقمية في total_degree' }],
          },
        ],
      },
    };
  },

  /** Commit a staged import with per-duplicate resolutions. */
  async commitImport(
    staged: StagedImport,
    resolutions: Record<string, ImportResolution>,
  ): Promise<CommittedImport> {
    await simulateLatency(280, 520);
    const accepted = Object.values(resolutions).filter((r) => r === 'ACCEPT').length;
    const rejected = Object.values(resolutions).filter((r) => r === 'REJECT').length;
    const deactivated = staged.duplicates
      .filter((d) => {
        if (resolutions[d.nationalId] !== 'ACCEPT' || d.adjustmentCount === 0) return false;
        const projected = d.incoming.total + d.adjustmentSum;
        return projected > d.maxDegree || projected < 0;
      })
      .map((d) => ({ nationalId: d.nationalId, name: d.name, adjustmentSum: d.adjustmentSum }));
    return {
      inserted: staged.newRows + accepted,
      replaced: accepted,
      kept: rejected,
      deactivated,
      skipped: staged.skipped,
    };
  },
};
