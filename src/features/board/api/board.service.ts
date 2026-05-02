/**
 * Board API — Sprint 6 (KARASA §4).
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/board/members                       → BoardMember[]
 *   POST   /api/board/members                       → BoardMember
 *   PATCH  /api/board/members/:id                   → BoardMember
 *   DELETE /api/board/members/:id                   → { ok }
 *   GET    /api/board/sessions?status=              → BoardSession[]
 *   GET    /api/board/sessions/:id                  → BoardSession
 *   POST   /api/board/sessions                      → BoardSession
 *   POST   /api/board/sessions/:id/start            → BoardSession (status: live)
 *   POST   /api/board/sessions/:id/close            → BoardSession (status: closed)
 *   POST   /api/board/sessions/:id/votes            → { applicantId, member, vote }
 *   GET    /api/board/decisions?applicantId=        → BoardDecision[]
 *   POST   /api/board/decisions                     → BoardDecision (auto-numbered)
 *   GET    /api/board/applicants/:id/case-file      → consolidated view
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import type {
  BoardDecision,
  BoardMember,
  BoardSession,
} from '@/shared/types/domain';

const MEMBERS_STATE: BoardMember[] = [...MOCK.boardMembers];
const SESSIONS_STATE: BoardSession[] = [...MOCK.boardSessions];
const DECISIONS_STATE: BoardDecision[] = [...MOCK.boardDecisions];
let dCounter = DECISIONS_STATE.length + 1;
let sCounter = SESSIONS_STATE.length + 1;

export const boardService = {
  async listMembers(): Promise<BoardMember[]> {
    await simulateLatency();
    return [...MEMBERS_STATE];
  },

  async addMember(payload: Omit<BoardMember, 'id'>): Promise<BoardMember> {
    await simulateLatency();
    const next: BoardMember = { ...payload, id: `BM-${String(MEMBERS_STATE.length + 1).padStart(2, '0')}` };
    MEMBERS_STATE.push(next);
    return next;
  },

  async removeMember(id: string): Promise<{ ok: true }> {
    await simulateLatency();
    const i = MEMBERS_STATE.findIndex((m) => m.id === id);
    if (i !== -1) MEMBERS_STATE.splice(i, 1);
    return { ok: true };
  },

  async listSessions(): Promise<BoardSession[]> {
    await simulateLatency();
    return [...SESSIONS_STATE].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  },

  async getSession(id: string): Promise<BoardSession | null> {
    await simulateLatency();
    return SESSIONS_STATE.find((s) => s.id === id) ?? null;
  },

  async createSession(payload: Omit<BoardSession, 'id' | 'status'>): Promise<BoardSession> {
    await simulateLatency();
    const next: BoardSession = { ...payload, id: `SES-${String(sCounter++).padStart(4, '0')}`, status: 'scheduled' };
    SESSIONS_STATE.unshift(next);
    return next;
  },

  async startSession(id: string): Promise<BoardSession | null> {
    await simulateLatency();
    const s = SESSIONS_STATE.find((x) => x.id === id);
    if (!s) return null;
    s.status = 'live';
    return s;
  },

  async closeSession(id: string): Promise<BoardSession | null> {
    await simulateLatency();
    const s = SESSIONS_STATE.find((x) => x.id === id);
    if (!s) return null;
    s.status = 'closed';
    return s;
  },

  async listDecisions(): Promise<BoardDecision[]> {
    await simulateLatency();
    return [...DECISIONS_STATE].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  },

  async createDecision(payload: Omit<BoardDecision, 'id' | 'number' | 'date' | 'hijriDate'>): Promise<BoardDecision> {
    await simulateLatency();
    const next: BoardDecision = {
      ...payload,
      id: `DEC-${String(dCounter).padStart(5, '0')}`,
      number: `د/2026/${String(dCounter).padStart(4, '0')}`,
      date: new Date().toISOString(),
      hijriDate: '15 شوال 1447',
    };
    dCounter += 1;
    DECISIONS_STATE.unshift(next);
    return next;
  },

  async getApplicantCaseFile(applicantId: string): Promise<{
    applicant: { id: string; name: string };
    decisions: BoardDecision[];
    sessions: BoardSession[];
  }> {
    await simulateLatency();
    const decisions = DECISIONS_STATE.filter((d) => d.applicantId === applicantId);
    const sessions = SESSIONS_STATE.filter((s) => s.applicantIds.includes(applicantId));
    return {
      applicant: { id: applicantId, name: 'متقدم #' + applicantId.slice(-4) },
      decisions,
      sessions,
    };
  },
};
