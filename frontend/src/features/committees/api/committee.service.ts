/**
 * Committees API — Sprint 3 (RFP Scope Document §3).
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/committees                              → Committee[]
 *   GET    /api/committees/:id                          → Committee
 *   POST   /api/committees                              → Committee
 *   PATCH  /api/committees/:id                          → Committee
 *   GET    /api/committees/:id/applicants?date=         → Applicant[] (today's queue)
 *   POST   /api/committees/:id/results                  → CommitteeResult (preliminary)
 *   POST   /api/committees/:id/results/approve          → { approved, failed }
 *   POST   /api/committees/results/:resultId/reject     → CommitteeResult (reason logged)
 *   POST   /api/committees/:id/results/bulk-upload      → { imported, errors }
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import { emitAudit } from '@/shared/lib/audit';
import { ConflictError } from '@/shared/lib/errors';
import { filterDeleted } from '@/shared/lib/soft-delete';
import type {
  Applicant,
  Committee,
  CommitteeResult,
  CommitteeType,
} from '@/shared/types/domain';

/* In-memory daily attendance counter — keyed by `${committeeId}:${YYYY-MM-DD}`.
 * Gap H capacity check decrements remaining slots before scheduling. */
const DAILY_COUNT = new Map<string, number>();
const dayKey = (committeeId: string, dateIso: string): string =>
  `${committeeId}:${dateIso.slice(0, 10)}`;

const COMMITTEES_STATE: Committee[] = [...MOCK.committees];
const RESULTS_STATE: CommitteeResult[] = [...MOCK.committeeResults];

let cId = COMMITTEES_STATE.length + 1;
let rId = RESULTS_STATE.length + 1;

export interface CommitteePayload {
  name: string;
  head: string;
  type: CommitteeType;
  members: number;
  capacityPerSession: number;
  cycleId: string;
}

export const committeeService = {
  async list(opts: { includeDeleted?: boolean } = {}): Promise<Committee[]> {
    await simulateLatency();
    return [...filterDeleted(COMMITTEES_STATE, opts.includeDeleted)];
  },

  async getById(id: string): Promise<Committee | null> {
    await simulateLatency();
    return COMMITTEES_STATE.find((c) => c.id === id) ?? null;
  },

  async create(payload: CommitteePayload): Promise<Committee> {
    await simulateLatency();
    const next: Committee = {
      id: `C-${String(cId++).padStart(2, '0')}`,
      name: payload.name,
      head: payload.head,
      members: payload.members,
      applicants: 0,
      completed: 0,
    };
    COMMITTEES_STATE.unshift(next);
    return next;
  },

  async getApplicants(committeeName: string): Promise<Applicant[]> {
    await simulateLatency();
    return MOCK.applicants.filter((a) => a.committee === committeeName).slice(0, 50);
  },

  async getDailyQueue(committeeId: string): Promise<Applicant[]> {
    await simulateLatency();
    const c = COMMITTEES_STATE.find((x) => x.id === committeeId);
    if (!c) return [];
    return MOCK.applicants.filter((a) => a.committee === c.name).slice(0, 18);
  },

  async listResults(committeeId: string): Promise<CommitteeResult[]> {
    await simulateLatency();
    return RESULTS_STATE.filter((r) => r.committeeId === committeeId);
  },

  async enterResult(committeeId: string, payload: {
    applicantId: string;
    applicantName: string;
    enteredBy: string;
    scores: Record<string, number>;
    passFail: 'pass' | 'fail';
    notes?: string;
  }): Promise<CommitteeResult> {
    await simulateLatency();
    const result: CommitteeResult = {
      id: `RES-C-${String(rId++).padStart(5, '0')}`,
      committeeId,
      applicantId: payload.applicantId,
      applicantName: payload.applicantName,
      enteredBy: payload.enteredBy,
      enteredAt: Date.now(),
      phase: 'preliminary',
      scores: payload.scores,
      passFail: payload.passFail,
      notes: payload.notes,
    };
    RESULTS_STATE.unshift(result);
    return result;
  },

  async approveResults(_committeeId: string, resultIds: ReadonlyArray<string>): Promise<{ approved: number; failed: number }> {
    await simulateLatency(400, 800);
    let approved = 0;
    for (const id of resultIds) {
      const r = RESULTS_STATE.find((x) => x.id === id);
      if (r && r.phase === 'preliminary') {
        r.phase = 'final';
        r.approvedBy = 'العقيد محمد إبراهيم حسن';
        r.approvedAt = Date.now();
        approved += 1;
      }
    }
    return { approved, failed: resultIds.length - approved };
  },

  async rejectResult(resultId: string, reason: string): Promise<CommitteeResult | null> {
    await simulateLatency();
    const r = RESULTS_STATE.find((x) => x.id === resultId);
    if (!r) return null;
    r.phase = 'rejected';
    r.rejectionReason = reason;
    return r;
  },

  async bulkUploadResults(_committeeId: string, rows: ReadonlyArray<Record<string, unknown>>): Promise<{ imported: number; errors: { row: number; message: string }[] }> {
    await simulateLatency(600, 1200);
    const errors: { row: number; message: string }[] = [];
    let imported = 0;
    rows.forEach((row, i) => {
      if (!row.applicantId || !row.passFail) {
        errors.push({ row: i + 1, message: 'بيانات ناقصة (الرقم القومي أو النتيجة)' });
        return;
      }
      imported += 1;
    });
    return { imported, errors };
  },

  /**
   * Update committee config (Gap H). Patches the in-memory snapshot,
   * emits a typed audit row with before/after, returns the merged row.
   */
  async update(id: string, patch: Partial<Committee>): Promise<Committee> {
    await simulateLatency();
    const idx = COMMITTEES_STATE.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('اللجنة غير موجودة');
    const before = { ...COMMITTEES_STATE[idx] };
    const next: Committee = { ...before, ...patch, id: before.id };
    COMMITTEES_STATE[idx] = next;
    emitAudit({
      action: 'update',
      module: 'committees',
      entityType: 'Committee',
      entityLabel: 'لجنة قبول',
      entityId: id,
      details: `تعديل بيانات "${next.name}"`,
      before,
      after: next,
    });
    return next;
  },

  /**
   * Schedule an applicant slot on a given day for a committee. Gap H
   * capacity check rejects with `ConflictError('COMMITTEE_AT_CAPACITY')`
   * when the day's count would exceed `capacityPerDay`.
   *
   * INTEGRATION CONTRACT:
   *   POST /api/committees/:id/schedule { applicantId, dateIso }
   */
  async scheduleSlot(
    committeeId: string,
    input: { applicantId: string; dateIso: string },
  ): Promise<{ ok: true; remainingForDay: number }> {
    await simulateLatency();
    const c = COMMITTEES_STATE.find((x) => x.id === committeeId);
    if (!c) throw new Error('اللجنة غير موجودة');
    const k = dayKey(committeeId, input.dateIso);
    const current = DAILY_COUNT.get(k) ?? 0;
    const cap = c.capacityPerDay;
    if (cap !== undefined && current >= cap) {
      throw new ConflictError(
        'COMMITTEE_AT_CAPACITY',
        { committeeId, dateIso: input.dateIso, capacityPerDay: cap, current },
        `لا يمكن جدولة هذا الموعد — الطاقة اليومية للجنة "${c.name}" مكتملة (${cap}/${cap}).`,
      );
    }
    DAILY_COUNT.set(k, current + 1);
    emitAudit({
      action: 'create',
      module: 'committees',
      entityType: 'CommitteeSlot',
      entityLabel: 'موعد لجنة',
      entityId: `${committeeId}:${input.dateIso}:${input.applicantId}`,
      details: `جدولة موعد للجنة "${c.name}" بتاريخ ${input.dateIso.slice(0, 10)}`,
      after: { committeeId, applicantId: input.applicantId, dateIso: input.dateIso },
    });
    return { ok: true, remainingForDay: (cap ?? Infinity) - (current + 1) };
  },

  /** Reset a day counter (testing / demo helper). */
  resetDailyCounters(): void {
    DAILY_COUNT.clear();
  },

  /**
   * List system users eligible for committee assignment — `committee_admin`
   * or `committee_user` role only. Surfaced by the admin officer-multi-select.
   */
  async getEligibleOfficers(): Promise<{ id: string; name: string; role: string; unit: string }[]> {
    await simulateLatency(80, 160);
    return MOCK.users
      .filter((u) => u.role === 'committee_admin' || u.role === 'committee_user')
      .map((u) => ({ id: u.id, name: u.name, role: u.role, unit: u.unit }));
  },
};
