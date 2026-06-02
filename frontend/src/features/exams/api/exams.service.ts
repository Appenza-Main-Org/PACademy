/**
 * Exams / Question Bank API — Sprint 7 (RFP Scope Document §9).
 *
 * INTEGRATION CONTRACT (backend default; mock fallback when the active *_USE_MOCKS flag is true):
 *   GET    /api/questions?status=&category=                  → BankQuestion[]
 *   GET    /api/questions/:id                                → BankQuestion
 *   POST   /api/questions                                    → BankQuestion (draft)
 *   POST   /api/questions/batch                              → BatchCreateResult
 *   PATCH  /api/questions/:id                                → BankQuestion (++version)
 *   POST   /api/questions/:id/publish                        → BankQuestion (status: live)
 *   GET    /api/exams/categories                             → { name, count }[]
 *   GET    /api/exams                                        → ExamConfig[]
 *   GET    /api/exams/:id                                    → ExamConfig
 *   GET    /api/exams/published/:token                       → ExamConfig (public exam-room lookup)
 *   POST   /api/exams                                        → ExamConfig
 *   POST   /api/exams/:id/publish                            → ExamConfig (published)
 *          body: { allowedIps: string[], accessStartAt: ISO, accessEndAt: ISO, publishedUrl?: string }
 *   POST   /api/exams/:id/take/start                         → ExamAttempt
 *   POST   /api/exams/attempts/:attemptId/submit             → ExamAttempt (auto-graded)
 *   GET    /api/exams/:id/attempts                           → ExamAttempt[]
 *   GET    /api/exams/:id/conflict?applicantId=…             → { ok, reason? }
 *   GET    /api/exams/:id/sessions/live                      → LiveSessionsResponse
 *   POST   /api/exams/:id/stop                               → ExamConfig (stopped)
 *   POST   /api/exams/:id/attempts/open                      → ExamConfig
 *   POST   /api/exams/access/validate                        → ExamAccessValidationResult
 *   GET    /api/exams/committee-users                        → ExamCommitteeUser[]
 *   GET    /api/exams/devices                                → ExamAuthorizedDevice[]
 *   GET    /api/exams/results                                → ElectronicExamResult[]
 *   POST   /api/exams/results/:id/approve                    → ElectronicExamResult
 *   POST   /api/exams/results/:id/publish                    → ElectronicExamResult
 *   GET    /api/exams/audit                                  → ExamAuditRecord[]
 */

import { apiClient, isBackendEnabled } from '@/shared/lib/api-client';
import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import {
  buildExamRoomUrl,
  createPublishToken,
  isIpAllowed,
  normaliseIpAllowlist,
} from '../lib/exam-publishing';
import type {
  BankQuestion,
  BatchCreateResult,
  ElectronicExamResult,
  ExamAttempt,
  ExamAnswer,
  ExamAuditRecord,
  ExamAuthorizedDevice,
  ExamAccessValidationRequest,
  ExamAccessValidationResult,
  ExamCommitteeUser,
  ExamConfig,
  ExamSession,
  LiveSessionsResponse,
  Question,
  QuestionDraft,
  QuestionStatus,
  SessionStatus,
} from '@/shared/types/domain';

interface PublishExamPayload {
  allowedIps?: string[];
  accessStartAt?: string;
  accessEndAt?: string;
  publishedUrl?: string;
}

const QS_STATE: BankQuestion[] = [...MOCK.bankQuestions];
const EX_STATE: ExamConfig[] = [...MOCK.examConfigs];
const ATT_STATE: ExamAttempt[] = [...MOCK.examAttempts];
const SESSIONS_STATE: ExamSession[] = MOCK.liveExamSessions.map((s) => ({ ...s }));
const DEVICE_STATE: ExamAuthorizedDevice[] = [
  {
    id: 'DEV-001',
    label: 'معمل الاختبارات الرئيسي · جهاز 01',
    macAddress: 'A4:8D:3B:91:22:10',
    ipAddress: '10.20.14.11',
    status: 'active',
    allowedFrom: new Date(Date.now() - 60 * 60_000).toISOString(),
    allowedTo: new Date(Date.now() + 3 * 60 * 60_000).toISOString(),
    examId: 'EXAM-0001',
  },
  {
    id: 'DEV-002',
    label: 'معمل الاختبارات الرئيسي · جهاز 02',
    macAddress: 'A4:8D:3B:91:22:11',
    ipAddress: '10.20.14.12',
    status: 'active',
    allowedFrom: new Date(Date.now() - 60 * 60_000).toISOString(),
    allowedTo: new Date(Date.now() + 3 * 60 * 60_000).toISOString(),
    examId: 'EXAM-0001',
  },
  {
    id: 'DEV-003',
    label: 'معمل احتياطي · جهاز 07',
    macAddress: 'B8:17:C2:4A:90:07',
    ipAddress: '10.20.30.27',
    status: 'inactive',
    allowedFrom: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
    allowedTo: new Date(Date.now() + 27 * 60 * 60_000).toISOString(),
  },
];
const USER_STATE: ExamCommitteeUser[] = [
  {
    id: 'EXU-001',
    fullName: 'العقيد أحمد فاروق سعد',
    username: 'exam.manager',
    passwordMask: '••••••••',
    permission: 'committee-manager',
    examType: 'قدرات عامة',
    status: 'active',
    authorizedDeviceId: 'DEV-001',
    authorizedIp: '10.20.14.11',
  },
  {
    id: 'EXU-002',
    fullName: 'الرائد د. كريم البنا',
    username: 'exam.results',
    passwordMask: '••••••••',
    permission: 'results-approver',
    examType: 'قدرات عامة',
    status: 'active',
    authorizedDeviceId: 'DEV-002',
    authorizedIp: '10.20.14.12',
  },
  {
    id: 'EXU-003',
    fullName: 'النقيب سامح عبد الرازق',
    username: 'exam.proctor.3',
    passwordMask: '••••••••',
    permission: 'proctor',
    examType: 'قدرات عددية',
    status: 'suspended',
    authorizedDeviceId: 'DEV-003',
    authorizedIp: '10.20.30.27',
  },
];
const RESULT_STATE: ElectronicExamResult[] = MOCK.examAttempts
  .filter((attempt) => attempt.submittedAt && typeof attempt.score === 'number')
  .map((attempt, index) => {
    const applicant = MOCK.applicants.find((row) => row.id === attempt.applicantId);
    const score = attempt.score ?? 0;
    return {
      id: `ER-${String(index + 1).padStart(5, '0')}`,
      examId: attempt.examId,
      attemptId: attempt.id,
      applicantId: attempt.applicantId,
      applicantName: applicant?.name ?? `متقدم ${index + 1}`,
      score,
      maxScore: 100,
      percentage: score,
      passFail: score >= 60 ? 'pass' : 'fail',
      status: index % 6 === 0 ? 'approved' : index % 9 === 0 ? 'published' : 'preliminary',
      submittedAt: new Date(attempt.submittedAt ?? Date.now()).toISOString(),
      approvedAt: index % 6 === 0 ? new Date(Date.now() - 2 * 60 * 60_000).toISOString() : undefined,
      publishedAt: index % 9 === 0 ? new Date(Date.now() - 60 * 60_000).toISOString() : undefined,
    };
  });
const AUDIT_STATE: ExamAuditRecord[] = [
  {
    id: 'EXAUD-0001',
    user: 'العقيد أحمد فاروق سعد',
    timestamp: new Date(Date.now() - 90 * 60_000).toISOString(),
    action: 'exam.published',
    entity: 'exam',
    entityId: 'EXAM-0001',
    previousValue: 'draft',
    newValue: 'published',
  },
  {
    id: 'EXAUD-0002',
    user: 'الرائد د. كريم البنا',
    timestamp: new Date(Date.now() - 45 * 60_000).toISOString(),
    action: 'result.approved',
    entity: 'result',
    entityId: 'ER-00001',
    previousValue: 'preliminary',
    newValue: 'approved',
  },
];
let qId = QS_STATE.length + 1;
let eId = EX_STATE.length + 1;
let aId = ATT_STATE.length + 1;
let deviceId = DEVICE_STATE.length + 1;
let examUserId = USER_STATE.length + 1;
let resultId = RESULT_STATE.length + 1;
let auditId = AUDIT_STATE.length + 1;

function recordAudit(entry: Omit<ExamAuditRecord, 'id' | 'timestamp' | 'user'> & { user?: string }): void {
  AUDIT_STATE.unshift({
    id: `EXAUD-${String(auditId++).padStart(4, '0')}`,
    user: entry.user ?? 'مدير نظام الاختبارات',
    timestamp: new Date().toISOString(),
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    previousValue: entry.previousValue,
    newValue: entry.newValue,
  });
}

function isMatchingAnswer(answer: ExamAnswer | undefined): answer is Record<string, string> {
  return Boolean(answer && typeof answer === 'object' && !Array.isArray(answer));
}

function isQuestionCorrect(question: BankQuestion, answer: ExamAnswer | undefined): boolean {
  if (question.type === 'matching') {
    if (!question.matchingPairs || question.matchingPairs.length === 0 || !isMatchingAnswer(answer)) return false;
    return question.matchingPairs.every((pair) => answer[pair.prompt] === pair.match);
  }

  return typeof answer === 'number' && answer === question.correctIndex;
}

export const examsService = {
  async listQuestions(filters: { status?: QuestionStatus | 'all'; category?: string | 'all' } = {}): Promise<BankQuestion[]> {
    if (isBackendEnabled()) {
      return apiClient.get<BankQuestion[]>('/api/questions', {
        query: {
          status: filters.status ?? undefined,
          category: filters.category ?? undefined,
        },
      });
    }
    await simulateLatency();
    let out = QS_STATE;
    if (filters.status && filters.status !== 'all') out = out.filter((q) => q.status === filters.status);
    if (filters.category && filters.category !== 'all') out = out.filter((q) => q.category === filters.category);
    return [...out];
  },

  async getQuestion(id: string): Promise<BankQuestion | null> {
    if (isBackendEnabled()) {
      try {
        return await apiClient.get<BankQuestion>(`/api/questions/${encodeURIComponent(id)}`);
      } catch {
        return null;
      }
    }
    await simulateLatency();
    return QS_STATE.find((q) => q.id === id) ?? null;
  },

  async createQuestion(payload: Omit<BankQuestion, 'id' | 'status' | 'version'>): Promise<BankQuestion> {
    if (isBackendEnabled()) {
      return apiClient.post<BankQuestion>('/api/questions', payload);
    }
    await simulateLatency();
    const next: BankQuestion = {
      ...payload,
      id: `Q-${String(qId++).padStart(5, '0')}`,
      status: 'draft',
      version: 1,
    };
    QS_STATE.unshift(next);
    recordAudit({
      action: 'question.created',
      entity: 'question',
      entityId: next.id,
      newValue: next.text,
    });
    return next;
  },

  async updateQuestion(id: string, patch: Partial<BankQuestion>): Promise<BankQuestion | null> {
    if (isBackendEnabled()) {
      try {
        return await apiClient.patch<BankQuestion>(`/api/questions/${encodeURIComponent(id)}`, patch);
      } catch {
        return null;
      }
    }
    await simulateLatency();
    const i = QS_STATE.findIndex((q) => q.id === id);
    if (i === -1) return null;
    const before = JSON.stringify(QS_STATE[i]);
    QS_STATE[i] = { ...QS_STATE[i], ...patch, version: (QS_STATE[i]!.version ?? 1) + 1 } as BankQuestion;
    recordAudit({
      action: patch.status === 'draft' ? 'question.hidden' : patch.status === 'live' ? 'question.shown' : 'question.edited',
      entity: 'question',
      entityId: id,
      previousValue: before,
      newValue: JSON.stringify(QS_STATE[i]),
    });
    return QS_STATE[i]!;
  },

  async publishQuestion(id: string): Promise<BankQuestion | null> {
    if (isBackendEnabled()) {
      try {
        return await apiClient.post<BankQuestion>(`/api/questions/${encodeURIComponent(id)}/publish`);
      } catch {
        return null;
      }
    }
    return examsService.updateQuestion(id, { status: 'live' });
  },

  async getCategories(): Promise<Array<{ name: string; count: number }>> {
    if (isBackendEnabled()) {
      return apiClient.get<Array<{ name: string; count: number }>>('/api/exams/categories');
    }
    await simulateLatency();
    const counts = new Map<string, number>();
    for (const q of QS_STATE) counts.set(q.category, (counts.get(q.category) ?? 0) + 1);
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
  },

  async listExams(): Promise<ExamConfig[]> {
    if (isBackendEnabled()) {
      return apiClient.get<ExamConfig[]>('/api/exams');
    }
    await simulateLatency();
    return [...EX_STATE];
  },

  async getExam(id: string): Promise<ExamConfig | null> {
    if (isBackendEnabled()) {
      try {
        return await apiClient.get<ExamConfig>(`/api/exams/${encodeURIComponent(id)}`);
      } catch {
        return null;
      }
    }
    await simulateLatency();
    return EX_STATE.find((e) => e.id === id) ?? null;
  },

  async getPublishedExamByToken(token: string): Promise<ExamConfig | null> {
    if (isBackendEnabled()) {
      try {
        return await apiClient.get<ExamConfig>(`/api/exams/published/${encodeURIComponent(token)}`);
      } catch {
        return null;
      }
    }
    await simulateLatency();
    return EX_STATE.find((row) => {
      const rowToken = row.publishToken ?? createPublishToken(row.id);
      return row.status === 'published' && rowToken === token;
    }) ?? null;
  },

  async createExam(payload: Omit<ExamConfig, 'id' | 'status'>): Promise<ExamConfig> {
    if (isBackendEnabled()) {
      return apiClient.post<ExamConfig>('/api/exams', payload);
    }
    await simulateLatency();
    const next: ExamConfig = { ...payload, id: `EXAM-${String(eId++).padStart(4, '0')}`, status: 'draft' };
    EX_STATE.unshift(next);
    recordAudit({
      action: 'exam.created',
      entity: 'exam',
      entityId: next.id,
      newValue: next.nameAr,
    });
    return next;
  },

  async publishExam(id: string, payload: PublishExamPayload = {}): Promise<ExamConfig | null> {
    if (isBackendEnabled()) {
      try {
        return await apiClient.post<ExamConfig>(`/api/exams/${encodeURIComponent(id)}/publish`, payload);
      } catch {
        return null;
      }
    }
    await simulateLatency();
    const e = EX_STATE.find((x) => x.id === id);
    if (!e) return null;
    const previous = e.status;
    const publishToken = e.publishToken ?? createPublishToken(e.id);
    const accessStartAt = payload.accessStartAt ?? e.accessStartAt ?? e.scheduledFor;
    const accessEndAt =
      payload.accessEndAt ??
      e.accessEndAt ??
      new Date(new Date(e.scheduledFor).getTime() + 3 * 60 * 60_000).toISOString();
    e.status = 'published';
    e.publishToken = publishToken;
    e.publishedUrl = payload.publishedUrl ?? e.publishedUrl ?? buildExamRoomUrl(publishToken);
    e.allowedIps = normaliseIpAllowlist(payload.allowedIps ?? e.allowedIps ?? []);
    e.accessStartAt = accessStartAt;
    e.accessEndAt = accessEndAt;
    recordAudit({
      action: 'exam.published',
      entity: 'exam',
      entityId: id,
      previousValue: previous,
      newValue: e.status,
    });
    return e;
  },

  async stopExam(id: string): Promise<ExamConfig | null> {
    if (isBackendEnabled()) {
      try {
        return await apiClient.post<ExamConfig>(`/api/exams/${encodeURIComponent(id)}/stop`);
      } catch {
        return null;
      }
    }
    await simulateLatency();
    const e = EX_STATE.find((x) => x.id === id);
    if (!e) return null;
    const previous = e.status;
    e.status = 'stopped';
    recordAudit({
      action: 'exam.stopped',
      entity: 'exam',
      entityId: id,
      previousValue: previous,
      newValue: e.status,
    });
    return e;
  },

  async openAttempt(examId: string, applicantId: string): Promise<ExamConfig | null> {
    if (isBackendEnabled()) {
      try {
        return await apiClient.post<ExamConfig>(`/api/exams/${encodeURIComponent(examId)}/attempts/open`, { applicantId });
      } catch {
        return null;
      }
    }
    await simulateLatency();
    const e = EX_STATE.find((x) => x.id === examId);
    if (!e) return null;
    e.reopenedApplicantIds = Array.from(new Set([...(e.reopenedApplicantIds ?? []), applicantId]));
    recordAudit({
      action: 'attempt.opened',
      entity: 'exam',
      entityId: examId,
      newValue: applicantId,
    });
    return e;
  },

  async startAttempt(examId: string, applicantId: string): Promise<ExamAttempt> {
    if (isBackendEnabled()) {
      return apiClient.post<ExamAttempt>(`/api/exams/${encodeURIComponent(examId)}/take/start`, { applicantId });
    }
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
    recordAudit({
      action: 'applicant.started',
      entity: 'attempt',
      entityId: next.id,
      newValue: `${applicantId} / ${examId}`,
    });
    return next;
  },

  async submitAttempt(attemptId: string, answers: Record<string, ExamAnswer>, opts: { auto?: boolean } = {}): Promise<ExamAttempt> {
    if (isBackendEnabled()) {
      return apiClient.post<ExamAttempt>(`/api/exams/attempts/${encodeURIComponent(attemptId)}/submit`, { answers });
    }
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
        if (q && isQuestionCorrect(q, answers[qid])) correct += 1;
      }
      const pct = Math.round((correct / Math.max(1, total)) * 100);
      a.score = pct;
      a.passFail = pct >= 60 ? 'pass' : 'fail';
      const applicant = MOCK.applicants.find((row) => row.id === a.applicantId);
      const result: ElectronicExamResult = {
        id: `ER-${String(resultId++).padStart(5, '0')}`,
        examId: a.examId,
        attemptId: a.id,
        applicantId: a.applicantId,
        applicantName: applicant?.name ?? a.applicantId,
        score: pct,
        maxScore: 100,
        percentage: pct,
        passFail: pct >= 60 ? 'pass' : 'fail',
        status: 'preliminary',
        submittedAt: new Date(a.submittedAt).toISOString(),
      };
      RESULT_STATE.unshift(result);
    }
    recordAudit({
      action: opts.auto ? 'applicant.auto_submitted' : 'applicant.submitted',
      entity: 'attempt',
      entityId: attemptId,
      newValue: JSON.stringify({ answers: Object.keys(answers).length, score: a.score }),
    });
    return a;
  },

  async getAttempts(examId: string): Promise<ExamAttempt[]> {
    if (isBackendEnabled()) {
      return apiClient.get<ExamAttempt[]>(`/api/exams/${encodeURIComponent(examId)}/attempts`);
    }
    await simulateLatency();
    return ATT_STATE.filter((a) => a.examId === examId);
  },

  /** Pre-exam check: prevents re-take within 6 months for the same exam (per K§3.5). */
  async checkConflict(applicantId: string, examId: string): Promise<{ ok: boolean; reason?: string }> {
    if (isBackendEnabled()) {
      return apiClient.get<{ ok: boolean; reason?: string }>(
        `/api/exams/${encodeURIComponent(examId)}/conflict`,
        { query: { applicantId } },
      );
    }
    await simulateLatency(80, 160);
    const sixMonthsAgo = Date.now() - 180 * 86_400_000;
    const recent = ATT_STATE.find((a) => a.applicantId === applicantId && a.examId === examId && a.startedAt > sixMonthsAgo);
    if (recent) return { ok: false, reason: 'لا يمكن إعادة الاختبار قبل مرور 6 شهور.' };
    return { ok: true };
  },

  async validateAccess(request: ExamAccessValidationRequest): Promise<ExamAccessValidationResult> {
    if (isBackendEnabled()) {
      return apiClient.post<ExamAccessValidationResult>('/api/exams/access/validate', request);
    }
    await simulateLatency(120, 260);
    const applicant = MOCK.applicants.find(
      (row) => row.nationalId === request.nationalId || row.id === request.applicantCode,
    );
    const exam = EX_STATE.find((row) => row.id === request.examId) ?? EX_STATE.find((row) => row.status === 'published');
    const allowedIps = normaliseIpAllowlist(exam?.allowedIps);
    const publishedIpAllowed = isIpAllowed(request.ipAddress, allowedIps);
    const device = DEVICE_STATE.find(
      (row) =>
        row.status === 'active' &&
        (row.macAddress.toLowerCase() === request.deviceIdentifier.toLowerCase() || row.ipAddress === request.ipAddress) &&
        (!exam || !row.examId || row.examId === exam.id),
    );
    const now = Date.now();
    const startsAt = exam?.accessStartAt ?? exam?.scheduledFor;
    const endsAt = exam?.accessEndAt ?? (exam ? new Date(new Date(exam.scheduledFor).getTime() + 3 * 60 * 60_000).toISOString() : undefined);
    const hasTimeWindow = Boolean(startsAt && endsAt && now >= new Date(startsAt).getTime() && now <= new Date(endsAt).getTime());
    const previousAttempt = exam && applicant
      ? ATT_STATE.find((row) => row.examId === exam.id && row.applicantId === applicant.id && row.submittedAt)
      : undefined;
    const reopened = Boolean(exam && applicant && exam.reopenedApplicantIds?.includes(applicant.id));
    const checks = [
      {
        key: 'applicant',
        label: 'المتقدم موجود في بيانات لجان القبول',
        ok: Boolean(applicant),
        detail: applicant ? applicant.name : 'لا يوجد متقدم مطابق للرقم القومي/الكود.',
      },
      {
        key: 'today',
        label: 'لديه اختبار اليوم',
        ok: Boolean(exam && exam.status === 'published'),
        detail: exam && exam.status === 'published' ? exam.nameAr : 'لا يوجد اختبار منشور متاح.',
      },
      {
        key: 'assignment',
        label: 'المتقدم مخصص لهذا الاختبار',
        ok: Boolean(exam && applicant && (exam.assignedGenders?.length ? exam.assignedGenders.includes(applicant.gender) : true)),
        detail: 'مطابقة الفئة/النوع/الجنس/التخصص محفوظة على تكوين الاختبار.',
      },
      {
        key: 'suspension',
        label: 'المتقدم غير موقوف',
        ok: applicant?.status !== 'on-hold' && applicant?.status !== 'rejected',
        detail: applicant ? applicant.stageLabel : 'لا يمكن التحقق قبل العثور على المتقدم.',
      },
      {
        key: 'device',
        label: 'IP غرفة الاختبار مصرح به',
        ok: publishedIpAllowed || (allowedIps.length === 0 && Boolean(device)),
        detail: publishedIpAllowed
          ? `${request.ipAddress} ضمن قائمة النشر`
          : device && allowedIps.length === 0
            ? `${device.label} · ${device.ipAddress}`
            : 'هذا الـ IP غير مصرح له بفتح رابط الاختبار.',
      },
      {
        key: 'window',
        label: 'نافذة وقت الاختبار صالحة',
        ok: hasTimeWindow,
        detail: startsAt && endsAt ? `${new Date(startsAt).toLocaleString('ar-EG')} → ${new Date(endsAt).toLocaleString('ar-EG')}` : 'لا توجد نافذة مفعلة.',
      },
      {
        key: 'duplicate',
        label: 'لا توجد محاولة سابقة مغلقة',
        ok: !previousAttempt || reopened,
        detail: previousAttempt && !reopened ? 'تم تسليم محاولة سابقة، ويلزم فتح محاولة أخرى.' : 'مسموح بالبدء.',
      },
    ];
    const ok = checks.every((check) => check.ok);
    return {
      ok,
      applicantId: applicant?.id,
      examId: exam?.id,
      reason: ok ? undefined : checks.find((check) => !check.ok)?.detail,
      checks,
    };
  },

  async validateExamAccess(request: ExamAccessValidationRequest): Promise<ExamAccessValidationResult> {
    return examsService.validateAccess(request);
  },

  async listCommitteeUsers(): Promise<ExamCommitteeUser[]> {
    if (isBackendEnabled()) return apiClient.get<ExamCommitteeUser[]>('/api/exams/committee-users');
    await simulateLatency();
    return USER_STATE.map((row) => ({ ...row }));
  },

  async listExamCommitteeUsers(): Promise<ExamCommitteeUser[]> {
    return examsService.listCommitteeUsers();
  },

  async createCommitteeUser(payload: Omit<ExamCommitteeUser, 'id' | 'passwordMask'> & { password: string }): Promise<ExamCommitteeUser> {
    if (isBackendEnabled()) return apiClient.post<ExamCommitteeUser>('/api/exams/committee-users', payload);
    await simulateLatency();
    const next: ExamCommitteeUser = {
      ...payload,
      id: `EXU-${String(examUserId++).padStart(3, '0')}`,
      passwordMask: '••••••••',
    };
    USER_STATE.unshift(next);
    return next;
  },

  async updateCommitteeUser(id: string, patch: Partial<ExamCommitteeUser>): Promise<ExamCommitteeUser | null> {
    if (isBackendEnabled()) {
      try {
        return await apiClient.patch<ExamCommitteeUser>(`/api/exams/committee-users/${encodeURIComponent(id)}`, patch);
      } catch {
        return null;
      }
    }
    await simulateLatency();
    const i = USER_STATE.findIndex((row) => row.id === id);
    if (i === -1) return null;
    USER_STATE[i] = { ...USER_STATE[i], ...patch };
    return USER_STATE[i]!;
  },

  async listDevices(): Promise<ExamAuthorizedDevice[]> {
    if (isBackendEnabled()) return apiClient.get<ExamAuthorizedDevice[]>('/api/exams/devices');
    await simulateLatency();
    return DEVICE_STATE.map((row) => ({ ...row }));
  },

  async listAuthorizedDevices(): Promise<ExamAuthorizedDevice[]> {
    return examsService.listDevices();
  },

  async createDevice(payload: Omit<ExamAuthorizedDevice, 'id'>): Promise<ExamAuthorizedDevice> {
    if (isBackendEnabled()) return apiClient.post<ExamAuthorizedDevice>('/api/exams/devices', payload);
    await simulateLatency();
    const next: ExamAuthorizedDevice = { ...payload, id: `DEV-${String(deviceId++).padStart(3, '0')}` };
    DEVICE_STATE.unshift(next);
    return next;
  },

  async updateDevice(id: string, patch: Partial<ExamAuthorizedDevice>): Promise<ExamAuthorizedDevice | null> {
    if (isBackendEnabled()) {
      try {
        return await apiClient.patch<ExamAuthorizedDevice>(`/api/exams/devices/${encodeURIComponent(id)}`, patch);
      } catch {
        return null;
      }
    }
    await simulateLatency();
    const i = DEVICE_STATE.findIndex((row) => row.id === id);
    if (i === -1) return null;
    DEVICE_STATE[i] = { ...DEVICE_STATE[i], ...patch };
    return DEVICE_STATE[i]!;
  },

  async listResults(): Promise<ElectronicExamResult[]> {
    if (isBackendEnabled()) return apiClient.get<ElectronicExamResult[]>('/api/exams/results');
    await simulateLatency();
    return RESULT_STATE.map((row) => ({ ...row }));
  },

  async approveResult(id: string): Promise<ElectronicExamResult | null> {
    if (isBackendEnabled()) {
      try {
        return await apiClient.post<ElectronicExamResult>(`/api/exams/results/${encodeURIComponent(id)}/approve`);
      } catch {
        return null;
      }
    }
    await simulateLatency();
    const r = RESULT_STATE.find((row) => row.id === id);
    if (!r || r.status === 'published') return r ?? null;
    const previous = r.status;
    r.status = 'approved';
    r.approvedAt = new Date().toISOString();
    recordAudit({ action: 'result.approved', entity: 'result', entityId: id, previousValue: previous, newValue: r.status });
    return r;
  },

  async publishResult(id: string): Promise<ElectronicExamResult | null> {
    if (isBackendEnabled()) {
      try {
        return await apiClient.post<ElectronicExamResult>(`/api/exams/results/${encodeURIComponent(id)}/publish`);
      } catch {
        return null;
      }
    }
    await simulateLatency();
    const r = RESULT_STATE.find((row) => row.id === id);
    if (!r || r.status !== 'approved') return r ?? null;
    const previous = r.status;
    r.status = 'published';
    r.publishedAt = new Date().toISOString();
    recordAudit({ action: 'result.published', entity: 'result', entityId: id, previousValue: previous, newValue: r.status });
    return r;
  },

  async listAudit(): Promise<ExamAuditRecord[]> {
    if (isBackendEnabled()) return apiClient.get<ExamAuditRecord[]>('/api/exams/audit');
    await simulateLatency();
    return AUDIT_STATE.map((row) => ({ ...row }));
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

  /**
   * INTEGRATION CONTRACT
   * POST /api/questions/batch
   * Body: { questions: QuestionDraft[] }   // up to 1000 rows
   * Response: { created: number, skipped: number, ids: string[] }
   * Auth: requires `questions:import` permission.
   * Side-effect: emits audit entries (one per created question).
   *
   * Imported rows land in `draft` state — same lifecycle as a manually-created
   * question (RFP Scope Document §9.A). The chief approves before they go live.
   */
  async createQuestionBatch(rows: QuestionDraft[]): Promise<BatchCreateResult> {
    if (rows.length === 0) return { created: 0, skipped: 0, ids: [] };
    if (rows.length > 1000) {
      throw new Error('عدد الأسئلة يتجاوز الحد المسموح (1000 سؤال).');
    }
    if (isBackendEnabled()) {
      return apiClient.post<BatchCreateResult>('/api/questions/batch', { questions: rows });
    }
    /* Latency proportional to row count, clamped to keep the demo snappy. */
    await simulateLatency(Math.min(800, 200 + rows.length * 2), Math.min(1400, 400 + rows.length * 3));
    const ids: string[] = [];
    for (const row of rows) {
      const next: BankQuestion = {
        ...row,
        id: `Q-${String(qId++).padStart(5, '0')}`,
        status: 'draft',
        version: 1,
      };
      QS_STATE.unshift(next);
      ids.push(next.id);
    }
    recordAudit({
      action: 'question.imported',
      entity: 'question',
      entityId: 'batch',
      newValue: `${ids.length} questions`,
    });
    return { created: ids.length, skipped: 0, ids };
  },

  /**
   * INTEGRATION CONTRACT
   * GET /api/exams/{examId}/sessions/live
   * Response: { sessions: ExamSession[], totalsByStatus: Record<SessionStatus, number>, lastUpdated: string, answersPerMinute: number[] }
   * Auth: requires `exams:proctor`.
   * Polling: 5s recommended.
   *
   * Mock layer rotates a small percentage of sessions on every poll so the
   * proctor surface feels alive in the demo. `answersPerMinute` is a 24-cell
   * strip of "answers in the last 60s" sampled from the running totals.
   */
  async listLiveSessions(examId: string): Promise<LiveSessionsResponse> {
    if (isBackendEnabled()) {
      return apiClient.get<LiveSessionsResponse>(`/api/exams/${encodeURIComponent(examId)}/sessions/live`);
    }
    await simulateLatency(120, 240);
    const now = Date.now();
    /* Drift: ~1 in 6 in-progress rows tick up an answer; ~1 in 30 transitions status. */
    for (const s of SESSIONS_STATE) {
      if (s.status === 'in-progress' && Math.random() < 0.32) {
        s.questionsAnswered = Math.min(s.totalQuestions, s.questionsAnswered + 1);
        s.lastHeartbeatAt = now;
        if (s.questionsAnswered === s.totalQuestions) {
          s.status = 'finished';
        }
      } else if (s.status === 'started' && Math.random() < 0.22) {
        s.status = 'in-progress';
        s.lastHeartbeatAt = now;
      } else if (s.status === 'not-started' && Math.random() < 0.05) {
        s.status = 'started';
        s.startedAt = now;
        s.lastHeartbeatAt = now;
      } else if (s.status === 'in-progress' && Math.random() < 0.008) {
        /* Connection drop (rare). */
        s.status = 'dropped';
      }
    }
    const totalsByStatus: Record<SessionStatus, number> = {
      'not-started': 0, started: 0, 'in-progress': 0, dropped: 0, finished: 0,
    };
    for (const s of SESSIONS_STATE) totalsByStatus[s.status] += 1;

    /* Cheap 24-bucket synthesis: lower at the head, peak in middle, taper. */
    const answersPerMinute: number[] = [];
    for (let i = 0; i < 24; i += 1) {
      const phase = Math.sin((i / 24) * Math.PI);
      answersPerMinute.push(Math.max(0, Math.round(8 + phase * 26 + (Math.random() - 0.5) * 6)));
    }
    return {
      sessions: SESSIONS_STATE.map((s) => ({ ...s })),
      totalsByStatus,
      lastUpdated: new Date(now).toISOString(),
      answersPerMinute,
    };
  },
};
