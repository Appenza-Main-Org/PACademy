/**
 * Investigations API — Sprint 5 (RFP Scope Document §5).
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/investigations?status=&priority=             → InvestigationCase[]
 *   GET    /api/investigations/:id                           → InvestigationCase
 *   POST   /api/investigations                               → InvestigationCase (assignment)
 *   PATCH  /api/investigations/:id                           → InvestigationCase
 *   GET    /api/investigations/letters?status=               → OutgoingLetter[]
 *   POST   /api/investigations/letters                       → OutgoingLetter (drafted)
 *   POST   /api/investigations/letters/:id/send              → OutgoingLetter (sent)
 *   POST   /api/investigations/distribution/auto-balance     → { assignments: { caseId, investigatorId }[] }
 *   GET    /api/investigations/stats                         → counts by status
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import type {
  CasePriority,
  CaseStatus,
  InvestigationCase,
  InvestigationStatus,
  OutgoingLetter,
} from '@/shared/types/domain';

const CASES_STATE: InvestigationCase[] = [...MOCK.investigationCases];
const LETTERS_STATE: OutgoingLetter[] = [...MOCK.outgoingLetters];
let cId = CASES_STATE.length + 1;
let lId = LETTERS_STATE.length + 1;

export const investigationsService = {
  async list(filters: { status?: CaseStatus | 'all'; priority?: CasePriority | 'all' } = {}): Promise<InvestigationCase[]> {
    await simulateLatency();
    let out = CASES_STATE;
    if (filters.status && filters.status !== 'all') out = out.filter((c) => c.status === filters.status);
    if (filters.priority && filters.priority !== 'all') out = out.filter((c) => c.priority === filters.priority);
    return [...out];
  },

  async getById(id: string): Promise<InvestigationCase | null> {
    await simulateLatency();
    return CASES_STATE.find((c) => c.id === id) ?? null;
  },

  async create(payload: Omit<InvestigationCase, 'id' | 'openedAt' | 'status'>): Promise<InvestigationCase> {
    await simulateLatency();
    const next: InvestigationCase = {
      ...payload,
      id: `CASE-${String(cId++).padStart(5, '0')}`,
      openedAt: Date.now(),
      status: 'open',
    };
    CASES_STATE.unshift(next);
    return next;
  },

  async update(id: string, patch: Partial<InvestigationCase>): Promise<InvestigationCase | null> {
    await simulateLatency();
    const i = CASES_STATE.findIndex((c) => c.id === id);
    if (i === -1) return null;
    CASES_STATE[i] = { ...CASES_STATE[i], ...patch } as InvestigationCase;
    return CASES_STATE[i];
  },

  async stats(): Promise<{ total: number; open: number; inReview: number; pass: number; fail: number; defer: number }> {
    await simulateLatency(80, 160);
    return {
      total: CASES_STATE.length,
      open: CASES_STATE.filter((c) => c.status === 'open').length,
      inReview: CASES_STATE.filter((c) => c.status === 'in-review').length,
      pass: CASES_STATE.filter((c) => c.status === 'pass').length,
      fail: CASES_STATE.filter((c) => c.status === 'fail').length,
      defer: CASES_STATE.filter((c) => c.status === 'defer-conditional').length,
    };
  },

  async listLetters(): Promise<OutgoingLetter[]> {
    await simulateLatency();
    return [...LETTERS_STATE];
  },

  async createLetter(payload: Omit<OutgoingLetter, 'id' | 'status' | 'sentAt'> & { send?: boolean }): Promise<OutgoingLetter> {
    await simulateLatency();
    const next: OutgoingLetter = {
      id: `LET-${String(lId++).padStart(5, '0')}`,
      caseId: payload.caseId,
      to: payload.to,
      subject: payload.subject,
      template: payload.template,
      status: payload.send ? 'sent' : 'drafted',
      sentAt: payload.send ? Date.now() : undefined,
    };
    LETTERS_STATE.unshift(next);
    return next;
  },

  async sendLetter(id: string): Promise<OutgoingLetter | null> {
    await simulateLatency();
    const l = LETTERS_STATE.find((x) => x.id === id);
    if (!l) return null;
    l.status = 'sent';
    l.sentAt = Date.now();
    return l;
  },

  async autoBalance(): Promise<{ assignments: { caseId: string; investigatorId: string }[] }> {
    await simulateLatency(400, 800);
    const investigators = ['U-004', 'U-009'];
    const open = CASES_STATE.filter((c) => c.status === 'open');
    const assignments = open.map((c, i) => ({ caseId: c.id, investigatorId: investigators[i % investigators.length] }));
    return { assignments };
  },

  /* Backwards-compat shim (kept so the pre-Sprint-5 page renders during transition) */
  async getCases(filters: { status?: InvestigationStatus | 'all' } = {}) {
    await simulateLatency();
    const status = filters.status ?? 'all';
    let items = MOCK.applicants;
    if (status !== 'all') items = items.filter((a) => a.investigation === status);
    return items.slice(0, 50).map((a, i) => ({
      applicantId: a.id,
      applicantName: a.name,
      nationalId: a.nationalId,
      governorate: a.governorate,
      status: a.investigation,
      sentAt: Date.now() - (i + 1) * 86_400_000,
      receivedAt: a.investigation === 'pending' ? null : Date.now() - i * 43_200_000,
      officer: MOCK.users.find((u) => u.role === 'investigator')?.name ?? 'محقق',
    }));
  },

  async getStats() {
    await simulateLatency();
    const all = MOCK.applicants;
    return {
      total: all.length,
      pending: all.filter((a) => a.investigation === 'pending').length,
      cleared: all.filter((a) => a.investigation === 'cleared').length,
      flagged: all.filter((a) => a.investigation === 'flagged').length,
    };
  },
};
