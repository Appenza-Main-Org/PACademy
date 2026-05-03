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
import type {
  Applicant,
  Committee,
  CommitteeResult,
  CommitteeType,
} from '@/shared/types/domain';

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
  async list(): Promise<Committee[]> {
    await simulateLatency();
    return [...COMMITTEES_STATE];
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
};
