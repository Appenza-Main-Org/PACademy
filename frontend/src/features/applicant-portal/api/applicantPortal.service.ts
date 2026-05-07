/**
 * Applicant portal API Contract — Sprint 2 (KARASA_GAPS §2.4).
 *
 * INTEGRATION CONTRACT:
 *   POST /applicant/auth/initiate                  → { sessionId, expiresAt }
 *   POST /applicant/auth/verify                    → { token, applicantId }
 *   GET  /applicant/draft/:applicantId             → ApplicantDraft
 *   PATCH /applicant/draft/:applicantId            → ApplicantDraft (merge)
 *   POST /applicant/stage/:applicantId/:stage      → { valid, errors? }
 *   POST /applicant/verify-certificate             → { match, mismatchedFields }
 *   POST /applicant/payment/initiate               → { redirectUrl|fawryCode, refNumber }
 *   GET  /applicant/payment/verify/:refNumber      → { status, receipt }
 *   GET  /applicant/exam-slots                     → ExamSlot[]
 *   POST /applicant/exam-slots/:slotId/reserve     → { confirmed, slot }
 *   GET  /applicant/follow-up/:applicantId         → followUp pipeline
 *   POST /applicant/attendance-card/:applicantId   → Blob (PDF/print)
 *   POST /applicant/acquaintance-doc/:applicantId  → Blob (PDF/print)
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import type { ApplicantDraft, ExamSlot, PaymentTransaction } from '@/shared/types/domain';

let DRAFT: ApplicantDraft = { ...MOCK.sampleApplicantDraft };
const SLOTS: ExamSlot[] = MOCK.examSlots.map((s) => ({ ...s }));
let TXN_COUNTER = 1;
const PAYMENTS: PaymentTransaction[] = [];

export const applicantPortalService = {
  async initiateAuth(nationalId: string, phoneNumber: string): Promise<{ sessionId: string; expiresAt: number }> {
    await simulateLatency(400, 800);
    if (!/^[0-9]{14}$/.test(nationalId)) throw new Error('الرقم القومي غير صحيح');
    if (!/^01[0125][0-9]{8}$/.test(phoneNumber)) throw new Error('رقم الهاتف غير صحيح');
    return { sessionId: `SESS-${Date.now()}`, expiresAt: Date.now() + 5 * 60_000 };
  },

  async verifyAuth(_sessionId: string, smsCode: string): Promise<{ token: string; applicantId: string }> {
    await simulateLatency(300, 600);
    /* Demo: any 6-digit code accepted, except '000000' (rejected for test). */
    if (!/^[0-9]{6}$/.test(smsCode)) throw new Error('رمز التحقق يجب أن يكون 6 أرقام');
    if (smsCode === '000000') throw new Error('رمز التحقق غير صحيح');
    DRAFT = { ...DRAFT, furthestStage: Math.max(DRAFT.furthestStage, 2), lastSavedAt: Date.now() };
    return { token: `TKN-${Date.now()}`, applicantId: DRAFT.applicantId };
  },

  async getDraft(_applicantId: string): Promise<ApplicantDraft> {
    await simulateLatency(150, 300);
    return { ...DRAFT };
  },

  async saveDraft(_applicantId: string, partial: Partial<ApplicantDraft>): Promise<ApplicantDraft> {
    await simulateLatency(200, 500);
    DRAFT = { ...DRAFT, ...partial, lastSavedAt: Date.now() };
    return { ...DRAFT };
  },

  async submitStage(_applicantId: string, stageNumber: number, data: Record<string, unknown>): Promise<{ valid: boolean }> {
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
    await simulateLatency(800, 1400);
    /* Demo: seat numbers ending in 0 simulate a mismatch with التربية والتعليم. */
    if (certData.seatNumber && certData.seatNumber.endsWith('0')) {
      return { match: false, mismatchedFields: ['totalScore'] };
    }
    return { match: true };
  },

  async initiatePayment(applicantId: string, method: 'fawry' | 'card', amount: number): Promise<{
    refNumber: string;
    fawryCode?: string;
    redirectUrl?: string;
  }> {
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
    PAYMENTS.push(txn);
    if (method === 'fawry') return { refNumber, fawryCode: String(Math.floor(Math.random() * 90000000) + 10000000) };
    return { refNumber, redirectUrl: 'https://payment.gov.eg/redirect-mock' };
  },

  async verifyPayment(refNumber: string): Promise<{ status: PaymentTransaction['status']; receipt?: PaymentTransaction }> {
    await simulateLatency(300, 600);
    const txn = PAYMENTS.find((p) => p.refNumber === refNumber);
    if (!txn) return { status: 'failed' };
    /* Auto-succeed in demo. */
    txn.status = 'success';
    txn.paidAt = Date.now();
    DRAFT = {
      ...DRAFT,
      payment: { method: txn.method, refNumber: txn.refNumber, amount: txn.amount, paidAt: txn.paidAt },
      /* Stage 6 is complete the moment payment is verified — mark it so the
       * wizard sidebar checkmark + nextStage URL pick up the progress. */
      furthestStage: Math.max(DRAFT.furthestStage, 6),
      lastSavedAt: Date.now(),
    };
    return { status: 'success', receipt: { ...txn } };
  },

  async getExamSlots(): Promise<ExamSlot[]> {
    await simulateLatency(300, 600);
    return [...SLOTS];
  },

  async reserveExamSlot(_applicantId: string, slotId: string): Promise<{ confirmed: boolean; slot?: ExamSlot }> {
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

  async getFollowUp(_applicantId: string): Promise<NonNullable<ApplicantDraft['followUp']>> {
    await simulateLatency(200, 400);
    return DRAFT.followUp ?? MOCK.sampleApplicantDraft.followUp!;
  },

  async generateAttendanceCard(_applicantId: string): Promise<void> {
    await simulateLatency(200, 400);
    if (typeof window !== 'undefined') window.print();
  },

  async generateAcquaintanceDoc(_applicantId: string): Promise<void> {
    await simulateLatency(200, 400);
    if (typeof window !== 'undefined') window.print();
  },
};
