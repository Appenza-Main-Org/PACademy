/**
 * Exams / Question Bank API — Sprint 7 (KARASA §9).
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/questions?status=&category=                  → BankQuestion[]
 *   GET    /api/questions/:id                                → BankQuestion
 *   POST   /api/questions                                    → BankQuestion (draft)
 *   PATCH  /api/questions/:id                                → BankQuestion (++version)
 *   POST   /api/questions/:id/publish                        → BankQuestion (status: live)
 *   GET    /api/exams                                        → ExamConfig[]
 *   GET    /api/exams/:id                                    → ExamConfig
 *   POST   /api/exams                                        → ExamConfig
 *   POST   /api/exams/:id/publish                            → ExamConfig (published)
 *   POST   /api/exams/:id/take/start                         → ExamAttempt
 *   POST   /api/exams/:id/take/submit                        → ExamAttempt (auto-graded)
 *   GET    /api/exams/:id/attempts                           → ExamAttempt[]
 *   GET    /api/exams/:id/proctor                            → live attempts feed
 *   GET    /api/exams/categories                             → category counts
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import type {
  BankQuestion,
  ExamAttempt,
  ExamConfig,
  Question,
  QuestionStatus,
} from '@/shared/types/domain';

const QS_STATE: BankQuestion[] = [...MOCK.bankQuestions];
const EX_STATE: ExamConfig[] = [...MOCK.examConfigs];
const ATT_STATE: ExamAttempt[] = [...MOCK.examAttempts];
let qId = QS_STATE.length + 1;
let eId = EX_STATE.length + 1;
let aId = ATT_STATE.length + 1;

export const examsService = {
  async listQuestions(filters: { status?: QuestionStatus | 'all'; category?: string | 'all' } = {}): Promise<BankQuestion[]> {
    await simulateLatency();
    let out = QS_STATE;
    if (filters.status && filters.status !== 'all') out = out.filter((q) => q.status === filters.status);
    if (filters.category && filters.category !== 'all') out = out.filter((q) => q.category === filters.category);
    return [...out];
  },

  async getQuestion(id: string): Promise<BankQuestion | null> {
    await simulateLatency();
    return QS_STATE.find((q) => q.id === id) ?? null;
  },

  async createQuestion(payload: Omit<BankQuestion, 'id' | 'status' | 'version'>): Promise<BankQuestion> {
    await simulateLatency();
    const next: BankQuestion = {
      ...payload,
      id: `Q-${String(qId++).padStart(5, '0')}`,
      status: 'draft',
      version: 1,
    };
    QS_STATE.unshift(next);
    return next;
  },

  async updateQuestion(id: string, patch: Partial<BankQuestion>): Promise<BankQuestion | null> {
    await simulateLatency();
    const i = QS_STATE.findIndex((q) => q.id === id);
    if (i === -1) return null;
    QS_STATE[i] = { ...QS_STATE[i], ...patch, version: (QS_STATE[i]!.version ?? 1) + 1 } as BankQuestion;
    return QS_STATE[i]!;
  },

  async publishQuestion(id: string): Promise<BankQuestion | null> {
    return examsService.updateQuestion(id, { status: 'live' });
  },

  async getCategories(): Promise<Array<{ name: string; count: number }>> {
    await simulateLatency();
    const counts = new Map<string, number>();
    for (const q of QS_STATE) counts.set(q.category, (counts.get(q.category) ?? 0) + 1);
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
  },

  async listExams(): Promise<ExamConfig[]> {
    await simulateLatency();
    return [...EX_STATE];
  },

  async getExam(id: string): Promise<ExamConfig | null> {
    await simulateLatency();
    return EX_STATE.find((e) => e.id === id) ?? null;
  },

  async createExam(payload: Omit<ExamConfig, 'id' | 'status'>): Promise<ExamConfig> {
    await simulateLatency();
    const next: ExamConfig = { ...payload, id: `EXAM-${String(eId++).padStart(4, '0')}`, status: 'draft' };
    EX_STATE.unshift(next);
    return next;
  },

  async publishExam(id: string): Promise<ExamConfig | null> {
    await simulateLatency();
    const e = EX_STATE.find((x) => x.id === id);
    if (!e) return null;
    e.status = 'published';
    return e;
  },

  async startAttempt(examId: string, applicantId: string): Promise<ExamAttempt> {
    await simulateLatency();
    const next: ExamAttempt = {
      id: `ATT-${String(aId++).padStart(5, '0')}`,
      examId,
      applicantId,
      startedAt: Date.now(),
      answers: {},
      flagged: [],
    };
    ATT_STATE.unshift(next);
    return next;
  },

  async submitAttempt(attemptId: string, answers: Record<string, number>): Promise<ExamAttempt> {
    await simulateLatency();
    const a = ATT_STATE.find((x) => x.id === attemptId);
    if (!a) throw new Error('Attempt not found');
    a.answers = answers;
    a.submittedAt = Date.now();
    const exam = EX_STATE.find((e) => e.id === a.examId);
    if (exam) {
      const total = exam.questionIds.length;
      let correct = 0;
      for (const qid of exam.questionIds) {
        const q = QS_STATE.find((x) => x.id === qid);
        if (q && answers[qid] === q.correctIndex) correct += 1;
      }
      const pct = Math.round((correct / Math.max(1, total)) * 100);
      a.score = pct;
      a.passFail = pct >= 60 ? 'pass' : 'fail';
    }
    return a;
  },

  async getAttempts(examId: string): Promise<ExamAttempt[]> {
    await simulateLatency();
    return ATT_STATE.filter((a) => a.examId === examId);
  },

  /** Pre-exam check: prevents re-take within 6 months for the same exam (per K§3.5). */
  async checkConflict(applicantId: string, examId: string): Promise<{ ok: boolean; reason?: string }> {
    await simulateLatency(80, 160);
    const sixMonthsAgo = Date.now() - 180 * 86_400_000;
    const recent = ATT_STATE.find((a) => a.applicantId === applicantId && a.examId === examId && a.startedAt > sixMonthsAgo);
    if (recent) return { ok: false, reason: 'لا يمكن إعادة الاختبار قبل مرور 6 شهور.' };
    return { ok: true };
  },

  /* Backwards-compat for the legacy ExamsPages.tsx (uses old `Question` type) */
  async listLegacyQuestions(): Promise<Question[]> {
    await simulateLatency();
    return MOCK.questions;
  },

  async buildExam(opts: { count: number; durationMin: number }): Promise<{ id: string; questions: Question[]; duration: number; createdAt: number }> {
    await simulateLatency();
    const shuffled = [...MOCK.questions].sort(() => Math.random() - 0.5);
    return {
      id: `EXAM-${Date.now()}`,
      questions: shuffled.slice(0, opts.count),
      duration: opts.durationMin,
      createdAt: Date.now(),
    };
  },
};
