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
 *   POST /applicant/payment/intent                  → { intentId, refNumber, fawryCode? }
 *   POST /applicant/payment/confirm                 → { confirmed, paidAt }
 *   POST /applicant/payment/initiate               → { redirectUrl|fawryCode, refNumber }
 *   GET  /applicant/payment/verify/:refNumber      → { status, receipt }
 *   GET  /applicant/exam-slots                     → ExamSlot[]
 *   POST /applicant/exam-slots/:slotId/reserve     → { confirmed, slot }
 *   POST /applicant/parents/approve                 → { approvedAt }     (MOI اعتماد gate)
 *   POST /applicant/exam-date                       → { date }           (MOI first-exam-date pick)
 *   GET  /applicant/follow-up/:applicantId         → followUp pipeline
 *   POST /applicant/attendance-card/:applicantId   → { ok, draft }
 *   POST /applicant/acquaintance-doc/:applicantId  → { ok, draft }
 */

import { MOCK } from '@/shared/mock-data';
import { applicantApiClient, isBackendEnabled } from '@/shared/lib/api-client';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import type { ApplicantDraft, ExamSlot, PaymentTransaction } from '@/shared/types/domain';
import { useAuthStore } from '@/features/auth';

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

export const applicantPortalService = {
  async initiateAuth(nationalId: string, phoneNumber: string): Promise<{ sessionId: string; expiresAt: number }> {
    if (isBackendEnabled()) {
      return applicantApiClient.post('/applicant/auth/initiate', { nationalId, phoneNumber });
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
      return applicantApiClient.post('/applicant/auth/verify', { sessionId, smsCode });
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

  /** Admin-only: update one or more exam result fields for a given applicant.
   *  INTEGRATION CONTRACT: PUT /applicant/follow-up/:applicantId
   *    Body: Partial<followUp> — only known keys (capacities|traits|sports|medical|investigation|finalResult) are written.
   *    Returns: { ok: true }
   */
  async updateFollowUp(
    applicantId: string,
    data: Partial<NonNullable<ApplicantDraft['followUp']>>,
  ): Promise<void> {
    if (isBackendEnabled()) {
      await applicantApiClient.put(`/applicant/follow-up/${encodeURIComponent(applicantId)}`, data);
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

  async createPaymentIntent(_input: {
    method: 'fawry-code';
  }): Promise<{ intentId: string; refNumber: string; fawryCode: string }> {
    if (isBackendEnabled()) {
      return applicantApiClient.post('/applicant/payment/intent', _input);
    }
    await simulateLatency(400, 700);
    const { deterministicPaymentReference } = await import('../lib/deterministic-codes');
    const refNumber = deterministicPaymentReference(DRAFT.applicantId);
    const intentId = `INT-${refNumber}`;
    const fawryCode = String(Math.floor(Math.random() * 90_000_000) + 10_000_000);
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
    if (isBackendEnabled()) {
      return applicantApiClient.post('/applicant/exam-date', input);
    }
    await simulateLatency(250, 500);
    const slot = SLOTS.find((s) => s.id === input.slotId);
    const date = slot?.date ?? input.slotId;
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
