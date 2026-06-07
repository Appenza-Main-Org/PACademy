/**
 * Applicant portal API Contract — Sprint 2 (KARASA_GAPS §2.4) +
 * applicant-flow MOI-alignment additions.
 *
 * INTEGRATION CONTRACT:
 *   POST /applicant/auth/initiate                  → { sessionId, expiresAt }
 *   POST /applicant/auth/verify                    → { token, applicantId }
 *   GET  /applicant/draft/:applicantId             → ApplicantDraft
 *   PATCH /applicant/draft/:applicantId            → ApplicantDraft (merge)
 *   POST /applicant/stage/:applicantId/:stage      → { valid, errors? }
 *   POST /applicant/verify-certificate             → { match, mismatchedFields }
 *   POST /applicant/payment/confirm-identity       → { confirmed }   (AF-2 pre-payment re-verification)
 *   POST /applicant/verify                          → { confirmed }  (MOI-aligned re-verify after profile)
 *   GET  /api/cycles/active                         → active cycle fee config for applicant payment
 *   POST /applicant/payment/intent                  → { intentId, refNumber, fawryCode? }
 *   POST /applicant/payment/confirm                 → { confirmed, paidAt }
 *   POST /applicant/payment/initiate               → { redirectUrl|fawryCode, refNumber }
 *   GET  /applicant/payment/verify/:refNumber      → { status, receipt }
 *   GET  /applicant/exam-slots                     → ExamSlot[]
 *   POST /applicant/exam-slots/:slotId/reserve     → { confirmed, slot }
 *   POST /applicant/parents/approve                 → { approvedAt }     (MOI اعتماد gate)
 *   POST /applicant/exam-date                       → { date }           (MOI first-exam-date pick)
 *   GET  /applicant/follow-up/:applicantId         → followUp pipeline
 *   GET  /api/applicant/acquaintance-doc/status    → AcquaintanceDocStatus
 *   GET  /api/applicant/acquaintance-doc           → AcquaintanceDocResponse
 *   PATCH /api/applicant/acquaintance-doc          → AcquaintanceDocResponse
 *   GET  /api/applicant/acquaintance-doc/print     → AcquaintanceDocResponse
 *   GET  /api/admission-setup/declaration/published → PublishedDeclaration | null
 *   GET  /api/lookups/tests?isActive=true          → active test names/order
 *   GET  /api/cycles/:cycleId/categories/:categoryId/exam-plan
 *                                                  → configured cycle tests
 *   POST /applicant/attendance-card/:applicantId   → { ok, draft }
 *   POST /applicant/acquaintance-doc/:applicantId  → { ok, draft }
 */

import { MOCK } from '@/shared/mock-data';
import { adminApiClient, applicantApiClient, isBackendEnabled } from '@/shared/lib/api-client';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import type {
  AdmissionCycle,
  ApplicantDraft,
  ExamSlot,
  FawryConfig,
  PaymentTransaction,
} from '@/shared/types/domain';
import { useAuthStore } from '@/features/auth';
import type { FollowUpExam, FollowUpExamPlan } from '../lib/follow-up-exam-plan';
import { normalizeApplicationInstructions } from '../lib/application-lock';
import { emptyDocument, type VothiqaTaarufDocument } from '../lib/vothiqaTaaruf.types';
import {
  isBookableExamDate,
  normalizeExamDateValue,
} from '../lib/exam-date-availability';

/* When the real backend is active the applicantId must be the GUID
 * issued by auth/verify, not the mock "APP-2026000" constant that pages
 * still reference. The auth store's user.id is set to that GUID during
 * login (ApplicantLoginForm → backendUser = { ...user, id: applicantId }). */
function resolveApplicantId(passedId: string): string {
  if (!isBackendEnabled()) return passedId;
  return useAuthStore.getState().user?.id ?? passedId;
}

let DRAFT: ApplicantDraft = { ...MOCK.sampleApplicantDraft };
const SLOTS: ExamSlot[] = MOCK.examSlots.map((s) => ({ ...s }));
let TXN_COUNTER = 1;
const PAYMENTS: PaymentTransaction[] = [];
const PAYMENT_INTENT_AMOUNTS = new Map<string, number>();
let ACQUAINTANCE_DOC: VothiqaTaarufDocument | null = null;
let ACQUAINTANCE_DOC_CLOSED = false;

const DEFAULT_APPLICATION_FEE = 250;

interface TestLookupRow {
  code: string;
  name: string;
  isActive: boolean;
  order: number;
  required: boolean;
  metadata?: Record<string, unknown>;
}

interface BackendExamPlan {
  id: string;
  cycleId: string;
  categoryId: string;
  exams: {
    examId: string;
    order: number;
    isRequired: boolean;
  }[];
}

interface ApplicationInstructionsResponse {
  applicationInstructions?: readonly string[] | string | null;
}

interface ExamDateSettingsResponse {
  examDaysPerApplicant?: number | null;
  examSlotSelectionWindowDays?: number | null;
}

export interface ExamDateSettings {
  /** Max number of exam-date options to show the applicant in Stage 8. */
  examDaysPerApplicant: number | null;
  /** Booking-window in days before each exam date during which the applicant
   *  may select that slot. Slots farther out are hidden until the window opens. */
  examSlotSelectionWindowDays: number | null;
}

export interface ApplicantPaymentConfig {
  cycleId: string | null;
  applicationFee: number;
  fawryConfig?: FawryConfig;
}

export interface PublishedDeclarationDocument {
  fileName: string;
  fileUrl: string;
  size: number;
}

export interface PublishedDeclaration {
  id: string;
  cycleId: string;
  /** Last edited/preferred admin tab. Text and PDF content may both be published. */
  mode: 'text' | 'pdf';
  bodyAr?: string;
  document?: PublishedDeclarationDocument | null;
  version: number;
  effectiveFrom: string;
  publishedAt?: string;
}

export interface AcquaintanceDocStatus {
  cycleId: string;
  status: 'not_open' | 'open' | 'closed';
  isOpen: boolean;
  isClosed: boolean;
  isLocked: boolean;
  canEdit: boolean;
  canPrint: boolean;
  reason: string;
  openingTestKey?: string;
  closingTestKey?: string;
  closingMode?: string;
  openedAt?: number | null;
  closedAt?: number | null;
  lastAutosavedAt?: number | null;
  version: number;
}

export interface AcquaintanceDocResponse {
  status: AcquaintanceDocStatus;
  document: Partial<VothiqaTaarufDocument> | null;
  lastAutosavedAt?: number | null;
  version?: number;
}

/** Admin-only portal follow-up snapshot for a single applicant, resolved by the admin
 *  route id (GUID / national id / admin record id). Served by the ADMIN API
 *  (GET /api/applicants/:id/follow-up) — the admin frontend is authenticated against the
 *  admin API, whereas the applicant API only accepts applicant JWTs, so the admin must
 *  go through the admin backend (which reads/writes the shared portal draft row).
 *  `hasPortalRecord` is false when the applicant has no portal draft yet. */
export interface AdminPortalStatus {
  applicantId: string | null;
  hasPortalRecord: boolean;
  followUp: Record<string, import('@/shared/types/domain').PipelineState>;
}

function metadataString(row: TestLookupRow, key: string): string | undefined {
  const value = row.metadata?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function normalizePositiveInteger(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const n = Math.trunc(value);
  return n >= 1 ? n : null;
}

function normalizeActiveCycle(value: AdmissionCycle | AdmissionCycle[] | null): AdmissionCycle | null {
  const rows = Array.isArray(value) ? value : value ? [value] : [];
  return (
    rows.find((cycle) => cycle.status === 'active' || cycle.status === 'open' || cycle.status === 'extended') ??
    null
  );
}

function cycleToPaymentConfig(cycle: AdmissionCycle | null): ApplicantPaymentConfig {
  const config: ApplicantPaymentConfig = {
    cycleId: cycle?.id ?? null,
    applicationFee: cycle?.fees?.applicationFee ?? DEFAULT_APPLICATION_FEE,
  };
  if (cycle?.fees?.fawryConfig) config.fawryConfig = cycle.fees.fawryConfig;
  return config;
}

function lookupRowToFollowUpExam(row: TestLookupRow): FollowUpExam {
  return {
    id: row.code,
    key: metadataString(row, 'key') ?? row.code,
    nameAr: row.name,
  };
}

function mockConfiguredPlan(cycleId: string, categoryKey: string): FollowUpExamPlan {
  const existing = MOCK.cycleCategoryExamPlans.find(
    (plan) => plan.cycleId === cycleId && plan.categoryId === categoryKey,
  );
  if (existing) return existing;

  return {
    id: `mock-${cycleId}-${categoryKey}-exam-plan`,
    cycleId,
    categoryId: categoryKey,
    exams: MOCK.academyExams
      .filter((exam) => exam.isQualifying)
      .map((exam, index) => ({
        examId: exam.id,
        order: index + 1,
        isRequired: true,
      })),
  };
}

export const applicantPortalService = {
  async initiateAuth(nationalId: string, phoneNumber: string): Promise<{ sessionId: string; expiresAt: number }> {
    if (isBackendEnabled()) {
      return applicantApiClient.post('/applicant/auth/initiate', { nationalId, phoneNumber }, { skipAuth: true });
    }
    await simulateLatency(400, 800);
    if (!/^[0-9]{14}$/.test(nationalId)) throw new Error('الرقم القومي غير صحيح');
    if (!/^01[0125][0-9]{8}$/.test(phoneNumber)) throw new Error('رقم الهاتف غير صحيح');
    return { sessionId: `SESS-${Date.now()}`, expiresAt: Date.now() + 5 * 60_000 };
  },

  async verifyAuth(sessionId: string, smsCode: string): Promise<{
    token: string;
    applicantId: string;
    profile: {
      applicantId: string; fullName: string; nationalId: string; mobile: string;
      email: string; dateOfBirth: string; gender: string; birthGovernorate: string;
      birthDistrict: string; religion: string;
    } | null;
  }> {
    if (isBackendEnabled()) {
      return applicantApiClient.post('/applicant/auth/verify', { sessionId, smsCode }, { skipAuth: true });
    }
    await simulateLatency(300, 600);
    if (!/^[0-9]{6}$/.test(smsCode)) throw new Error('رمز التحقق يجب أن يكون 6 أرقام');
    if (smsCode !== '123456') throw new Error('رمز التحقق غير صحيح');
    DRAFT = { ...DRAFT, furthestStage: Math.max(DRAFT.furthestStage, 2), lastSavedAt: Date.now() };
    return { token: `TKN-${Date.now()}`, applicantId: DRAFT.applicantId, profile: null };
  },

  async getDraft(applicantId: string): Promise<ApplicantDraft> {
    if (isBackendEnabled()) {
      const id = resolveApplicantId(applicantId);
      return applicantApiClient.get<ApplicantDraft>(`/applicant/draft/${encodeURIComponent(id)}`);
    }
    await simulateLatency(150, 300);
    return { ...DRAFT };
  },

  async resetDraft(applicantId: string): Promise<void> {
    if (isBackendEnabled()) {
      const id = resolveApplicantId(applicantId);
      await applicantApiClient.delete(`/applicant/draft/${encodeURIComponent(id)}`);
      return;
    }
    DRAFT = { applicantId, furthestStage: 0, suspended: false, lastSavedAt: Date.now() } as ApplicantDraft;
  },

  async saveDraft(applicantId: string, partial: Partial<ApplicantDraft>): Promise<ApplicantDraft> {
    if (isBackendEnabled()) {
      const id = resolveApplicantId(applicantId);
      return applicantApiClient.patch<ApplicantDraft>(
        `/applicant/draft/${encodeURIComponent(id)}`,
        partial as Record<string, unknown>,
      );
    }
    await simulateLatency(200, 500);
    DRAFT = { ...DRAFT, ...partial, lastSavedAt: Date.now() };
    return { ...DRAFT };
  },

  async submitStage(applicantId: string, stageNumber: number, data: Record<string, unknown>): Promise<{ valid: boolean }> {
    if (isBackendEnabled()) {
      const id = resolveApplicantId(applicantId);
      return applicantApiClient.post(
        `/applicant/stage/${encodeURIComponent(id)}/${stageNumber}`,
        data,
      );
    }
    await simulateLatency(300, 600);
    DRAFT = {
      ...DRAFT,
      furthestStage: Math.max(DRAFT.furthestStage, stageNumber),
      lastSavedAt: Date.now(),
      ...data,
    };
    return { valid: true };
  },

  async verifyCertificate(_applicantId: string, certData: { certificateType: string; seatNumber?: string }): Promise<{
    match: boolean;
    mismatchedFields?: string[];
  }> {
    if (isBackendEnabled()) {
      return applicantApiClient.post('/applicant/verify-certificate', certData);
    }
    await simulateLatency(800, 1400);
    if (certData.seatNumber && certData.seatNumber.endsWith('0')) {
      return { match: false, mismatchedFields: ['totalScore'] };
    }
    return { match: true };
  },

  async confirmPrePayment(_applicantId: string, input: { nationalId: string; phoneNumber: string }): Promise<{ confirmed: true }> {
    if (isBackendEnabled()) {
      return applicantApiClient.post('/applicant/payment/confirm-identity', input);
    }
    await simulateLatency(250, 500);
    if (!/^[0-9]{14}$/.test(input.nationalId)) throw new Error('الرقم القومي غير صحيح');
    if (!/^01[0125][0-9]{8}$/.test(input.phoneNumber)) throw new Error('رقم الهاتف غير صحيح');
    return { confirmed: true };
  },

  async initiatePayment(applicantId: string, method: 'fawry' | 'card', amount: number): Promise<{
    refNumber: string;
    fawryCode?: string;
    redirectUrl?: string;
  }> {
    if (isBackendEnabled()) {
      return applicantApiClient.post('/applicant/payment/initiate', { applicantId, method, amount });
    }
    await simulateLatency(500, 900);
    const refNumber = `PAY-${Date.now()}-${TXN_COUNTER++}`;
    const txn: PaymentTransaction = {
      refNumber,
      applicantId,
      method,
      amount,
      status: 'pending',
      initiatedAt: Date.now(),
    };
    if (method === 'fawry') {
      txn.fawryCode = String(Math.floor(Math.random() * 9_000_000_000) + 1_000_000_000);
      PAYMENTS.push(txn);
      return { refNumber, fawryCode: txn.fawryCode };
    }
    PAYMENTS.push(txn);
    return { refNumber, redirectUrl: 'https://payment.gov.eg/redirect-mock' };
  },

  async verifyPayment(refNumber: string): Promise<{ status: PaymentTransaction['status']; receipt?: PaymentTransaction }> {
    if (isBackendEnabled()) {
      return applicantApiClient.get(`/applicant/payment/verify/${encodeURIComponent(refNumber)}`);
    }
    await simulateLatency(300, 600);
    const txn = PAYMENTS.find((p) => p.refNumber === refNumber);
    if (!txn) return { status: 'failed' };
    txn.status = 'success';
    txn.paidAt = Date.now();
    DRAFT = {
      ...DRAFT,
      payment: {
        method: txn.method,
        refNumber: txn.refNumber,
        amount: txn.amount,
        paidAt: txn.paidAt,
        ...(txn.fawryCode ? { fawryCode: txn.fawryCode } : {}),
      },
      furthestStage: Math.max(DRAFT.furthestStage, 6),
      lastSavedAt: Date.now(),
    };
    return { status: 'success', receipt: { ...txn } };
  },

  async getExamSlots(): Promise<ExamSlot[]> {
    if (isBackendEnabled()) {
      return applicantApiClient.get<ExamSlot[]>('/applicant/exam-slots');
    }
    await simulateLatency(300, 600);
    return [...SLOTS];
  },

  async reserveExamSlot(_applicantId: string, slotId: string): Promise<{ confirmed: boolean; slot?: ExamSlot }> {
    if (isBackendEnabled()) {
      return applicantApiClient.post(`/applicant/exam-slots/${encodeURIComponent(slotId)}/reserve`);
    }
    await simulateLatency(400, 800);
    const slot = SLOTS.find((s) => s.id === slotId);
    if (!slot) throw new Error('الموعد غير موجود');
    if (slot.reserved >= slot.capacity) throw new Error('انتهت الأماكن في هذا الموعد');
    slot.reserved += 1;
    DRAFT = {
      ...DRAFT,
      examSlot: { slotId: slot.id, date: slot.date, time: slot.time, location: slot.location },
      lastSavedAt: Date.now(),
    };
    return { confirmed: true, slot: { ...slot } };
  },

  async getFollowUp(applicantId: string): Promise<NonNullable<ApplicantDraft['followUp']>> {
    if (isBackendEnabled()) {
      const id = resolveApplicantId(applicantId);
      return applicantApiClient.get(`/applicant/follow-up/${encodeURIComponent(id)}`);
    }
    await simulateLatency(200, 400);
    return DRAFT.followUp ?? MOCK.sampleApplicantDraft.followUp!;
  },

  /** Admin-only: read an applicant's portal exam follow-up by admin route id
   *  (GUID / national id / admin record id).
   *  INTEGRATION CONTRACT: GET /api/applicants/:id/follow-up (admin API)
   *    → { applicantId, hasPortalRecord, followUp } */
  async getAdminPortalStatus(id: string): Promise<AdminPortalStatus> {
    if (isBackendEnabled()) {
      return adminApiClient.get<AdminPortalStatus>(
        `/api/applicants/${encodeURIComponent(id)}/follow-up`,
      );
    }
    await simulateLatency(150, 300);
    return {
      applicantId: id,
      hasPortalRecord: true,
      followUp: { ...(DRAFT.followUp ?? MOCK.sampleApplicantDraft.followUp!) },
    };
  },

  async getConfiguredFollowUpExamPlan(input: {
    cycleId: string;
    categoryKey: string;
  }): Promise<{ exams: FollowUpExam[]; plan: FollowUpExamPlan }> {
    if (isBackendEnabled()) {
      const [lookupRows, plan] = await Promise.all([
        adminApiClient.get<TestLookupRow[]>('/api/lookups/tests', {
          query: { isActive: true },
        }),
        adminApiClient.get<BackendExamPlan>(
          `/api/cycles/${encodeURIComponent(input.cycleId)}/categories/${encodeURIComponent(input.categoryKey)}/exam-plan`,
        ),
      ]);
      return {
        exams: lookupRows
          .slice()
          .sort((a, b) => a.order - b.order)
          .map(lookupRowToFollowUpExam),
        plan,
      };
    }

    await simulateLatency(150, 300);
    return {
      exams: MOCK.academyExams.map((exam) => ({
        id: exam.id,
        key: exam.key,
        nameAr: exam.nameAr,
      })),
      plan: mockConfiguredPlan(input.cycleId, input.categoryKey),
    };
  },

  async getApplicationInstructions(): Promise<readonly string[]> {
    if (isBackendEnabled()) {
      const settings = await adminApiClient.get<ApplicationInstructionsResponse>('/api/admin/settings');
      return normalizeApplicationInstructions(settings.applicationInstructions);
    }

    await simulateLatency(100, 200);
    return normalizeApplicationInstructions(null);
  },

  async getExamDateSettings(): Promise<ExamDateSettings> {
    if (isBackendEnabled()) {
      const settings = await adminApiClient.get<ExamDateSettingsResponse>('/api/admin/settings');
      return {
        examDaysPerApplicant: normalizePositiveInteger(settings.examDaysPerApplicant),
        examSlotSelectionWindowDays: normalizePositiveInteger(settings.examSlotSelectionWindowDays),
      };
    }

    await simulateLatency(100, 200);
    return { examDaysPerApplicant: null, examSlotSelectionWindowDays: null };
  },

  async getPublishedDeclaration(): Promise<PublishedDeclaration | null> {
    if (isBackendEnabled()) {
      return adminApiClient.get<PublishedDeclaration | null>('/api/admission-setup/declaration/published');
    }

    await simulateLatency(100, 200);
    return {
      id: 'DECL-MOCK-ACTIVE',
      cycleId: DRAFT.cycleId,
      mode: 'text',
      bodyAr:
        'أقر بأنني اطلعت على شروط الإلتحاق بأكاديمية الشرطة، وأن جميع البيانات والمستندات المقدمة صحيحة ومطابقة للأوراق الثبوتية، وألتزم بالحضور في المواعيد المحددة وإحضار الأصول المطلوبة يوم الاختبار.',
      document: null,
      version: 1,
      effectiveFrom: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
    };
  },

  /** Admin-only: update one or more exam result fields for a given applicant.
   *  Goes through the ADMIN API (the admin frontend isn't authenticated against the
   *  applicant API), which merges the outcomes into the shared portal draft row.
   *  INTEGRATION CONTRACT: PUT /api/applicants/:id/follow-up (admin API)
   *    Body: Partial<followUp> — only known keys (capacities|traits|sports|medical|investigation|finalResult) are written.
   *    Returns: { applicantId, hasPortalRecord, followUp }
   */
  async updateFollowUp(
    id: string,
    data: Partial<NonNullable<ApplicantDraft['followUp']>>,
  ): Promise<void> {
    if (isBackendEnabled()) {
      await adminApiClient.put(`/api/applicants/${encodeURIComponent(id)}/follow-up`, data);
      return;
    }
    await simulateLatency(200, 400);
    DRAFT = { ...DRAFT, followUp: { ...DRAFT.followUp, ...data } as NonNullable<ApplicantDraft['followUp']> };
  },

  async generateAttendanceCard(_applicantId: string): Promise<void> {
    await simulateLatency(200, 400);
    if (typeof window !== 'undefined') window.print();
  },

  async generateAcquaintanceDoc(_applicantId: string): Promise<void> {
    await simulateLatency(200, 400);
    if (typeof window !== 'undefined') window.print();
  },

  async getAcquaintanceDocStatus(_applicantId: string): Promise<AcquaintanceDocStatus> {
    if (isBackendEnabled()) {
      return applicantApiClient.get<AcquaintanceDocStatus>('/api/applicant/acquaintance-doc/status');
    }
    await simulateLatency(120, 220);
    const isOpen = !ACQUAINTANCE_DOC_CLOSED && DRAFT.furthestStage >= 8;
    return {
      cycleId: DRAFT.cycleId,
      status: ACQUAINTANCE_DOC_CLOSED ? 'closed' : isOpen ? 'open' : 'not_open',
      isOpen,
      isClosed: ACQUAINTANCE_DOC_CLOSED,
      isLocked: !isOpen,
      canEdit: isOpen,
      canPrint: ACQUAINTANCE_DOC_CLOSED,
      reason: ACQUAINTANCE_DOC_CLOSED ? 'closed_by_backend_rule' : isOpen ? 'open' : 'waiting_for_configured_test',
      openingTestKey: 'physical',
      closingTestKey: 'medical',
      closingMode: 'after_test_passed',
      lastAutosavedAt: DRAFT.lastSavedAt,
      version: ACQUAINTANCE_DOC ? 1 : 0,
    };
  },

  async getAcquaintanceDoc(applicantId: string): Promise<AcquaintanceDocResponse> {
    if (isBackendEnabled()) {
      return applicantApiClient.get<AcquaintanceDocResponse>('/api/applicant/acquaintance-doc');
    }
    const status = await this.getAcquaintanceDocStatus(applicantId);
    if (!status.isOpen && !status.isClosed) return { status, document: null };
    ACQUAINTANCE_DOC ??= emptyDocument();
    return { status, document: ACQUAINTANCE_DOC, lastAutosavedAt: DRAFT.lastSavedAt, version: 1 };
  },

  async saveAcquaintanceDoc(
    applicantId: string,
    partial: Partial<VothiqaTaarufDocument>,
  ): Promise<AcquaintanceDocResponse> {
    if (isBackendEnabled()) {
      return applicantApiClient.patch<AcquaintanceDocResponse>('/api/applicant/acquaintance-doc', partial);
    }
    await simulateLatency(180, 320);
    const status = await this.getAcquaintanceDocStatus(applicantId);
    if (!status.canEdit) throw new Error('وثيقة التعارف غير متاحة للتعديل حالياً');
    ACQUAINTANCE_DOC = { ...emptyDocument(), ...(ACQUAINTANCE_DOC ?? {}), ...partial };
    DRAFT = { ...DRAFT, lastSavedAt: Date.now() };
    return {
      status: { ...status, lastAutosavedAt: DRAFT.lastSavedAt, version: 1 },
      document: ACQUAINTANCE_DOC,
      lastAutosavedAt: DRAFT.lastSavedAt,
      version: 1,
    };
  },

  async getPrintableAcquaintanceDoc(applicantId: string): Promise<AcquaintanceDocResponse> {
    if (isBackendEnabled()) {
      return applicantApiClient.get<AcquaintanceDocResponse>('/api/applicant/acquaintance-doc/print');
    }
    const status = await this.getAcquaintanceDocStatus(applicantId);
    if (!status.canPrint) throw new Error('لا يمكن طباعة وثيقة التعارف قبل غلقها');
    return { status, document: ACQUAINTANCE_DOC ?? emptyDocument(), version: 1 };
  },

  /* ── MOI-aligned methods ──────────────────────────────────────────── */

  async verifyApplicant(input: { nationalId: string; mobile: string }): Promise<{ confirmed: boolean }> {
    if (isBackendEnabled()) {
      return applicantApiClient.post('/applicant/verify', input);
    }
    await simulateLatency(250, 500);
    const { moiSessionMatches } = await import('../lib/moi-session.mock');
    const ok = moiSessionMatches(input);
    return { confirmed: ok };
  },

  async fetchMoiVerification(nid: string) {
    await simulateLatency(300, 600);
    const { mockMoiVerifyNid } = await import('../lib/moi-session.mock');
    const result = mockMoiVerifyNid(nid);
    if (!result) throw new Error('الرقم القومي غير مسجَّل لدى بوابة التحقق القومي');
    return result;
  },

  async getPaymentConfig(): Promise<ApplicantPaymentConfig> {
    if (isBackendEnabled()) {
      const active = await adminApiClient.get<AdmissionCycle | AdmissionCycle[] | null>('/api/cycles/active');
      return cycleToPaymentConfig(normalizeActiveCycle(active));
    }
    await simulateLatency(80, 200);
    const active = MOCK.cycles.find(
      (cycle) => cycle.status === 'active' || cycle.status === 'open' || cycle.status === 'extended',
    ) ?? null;
    return cycleToPaymentConfig(active);
  },

  async createPaymentIntent(_input: {
    method: 'fawry-code';
    amount: number;
  }): Promise<{ intentId: string; refNumber: string; fawryCode: string }> {
    if (isBackendEnabled()) {
      return applicantApiClient.post('/applicant/payment/intent', _input);
    }
    await simulateLatency(400, 700);
    const { deterministicPaymentReference } = await import('../lib/deterministic-codes');
    const refNumber = deterministicPaymentReference(DRAFT.applicantId);
    const intentId = `INT-${refNumber}`;
    const fawryCode = String(Math.floor(Math.random() * 90_000_000) + 10_000_000);
    PAYMENT_INTENT_AMOUNTS.set(intentId, _input.amount);
    return { intentId, refNumber, fawryCode };
  },

  async confirmPayment(_input: { intentId: string }): Promise<{ confirmed: true; paidAt: number }> {
    if (isBackendEnabled()) {
      return applicantApiClient.post('/applicant/payment/confirm', _input);
    }
    await simulateLatency(500, 900);
    const paidAt = Date.now();
    DRAFT = {
      ...DRAFT,
      payment: {
        method: 'fawry-code',
        refNumber: _input.intentId.replace(/^INT-/, ''),
        amount: PAYMENT_INTENT_AMOUNTS.get(_input.intentId) ?? DEFAULT_APPLICATION_FEE,
        paidAt,
      },
      furthestStage: Math.max(DRAFT.furthestStage, 6),
      lastSavedAt: paidAt,
    };
    return { confirmed: true, paidAt };
  },

  async approveParents(): Promise<{ approvedAt: number }> {
    if (isBackendEnabled()) {
      return applicantApiClient.post('/applicant/parents/approve');
    }
    await simulateLatency(250, 500);
    const approvedAt = Date.now();
    DRAFT = {
      ...DRAFT,
      furthestStage: Math.max(DRAFT.furthestStage, 7),
      lastSavedAt: approvedAt,
    };
    return { approvedAt };
  },

  async pickFirstExamDate(input: { slotId: string }): Promise<{ date: string }> {
    const normalizedInputDate = normalizeExamDateValue(input.slotId);
    if (normalizedInputDate && !isBookableExamDate(normalizedInputDate)) {
      throw new Error('هذا الموعد لم يعد متاحاً للحجز');
    }

    if (isBackendEnabled()) {
      return applicantApiClient.post('/applicant/exam-date', input);
    }
    await simulateLatency(250, 500);
    const slot = SLOTS.find((s) => s.id === input.slotId);
    if (!slot && !normalizedInputDate) throw new Error('الموعد غير موجود');
    const date = slot?.date ?? normalizedInputDate ?? input.slotId;
    if (!isBookableExamDate(date)) throw new Error('هذا الموعد لم يعد متاحاً للحجز');
    DRAFT = {
      ...DRAFT,
      examSlot: {
        slotId: input.slotId,
        date,
        time: slot?.time ?? '08:00',
        location: slot?.location ?? 'كلية الشرطة - مبنى الاختبارات - القاهرة',
      },
      furthestStage: Math.max(DRAFT.furthestStage, 8),
      lastSavedAt: Date.now(),
    };
    return { date };
  },
};
