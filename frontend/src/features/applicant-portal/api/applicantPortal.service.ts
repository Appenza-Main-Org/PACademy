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
    /* Demo: only the canonical '123456' is accepted. Production will
     * compare against the SMS-issued code stored server-side. */
    if (!/^[0-9]{6}$/.test(smsCode)) throw new Error('رمز التحقق يجب أن يكون 6 أرقام');
    if (smsCode !== '123456') throw new Error('رمز التحقق غير صحيح');
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

  /**
   * Pre-payment identity re-verification (AF-2). Applicant re-enters NID
   * and mobile to confirm before money moves. Mismatch throws so callers
   * surface a danger toast.
   */
  async confirmPrePayment(_applicantId: string, input: { nationalId: string; phoneNumber: string }): Promise<{ confirmed: true }> {
    await simulateLatency(250, 500);
    if (!/^[0-9]{14}$/.test(input.nationalId)) throw new Error('الرقم القومي غير صحيح');
    if (!/^01[0125][0-9]{8}$/.test(input.phoneNumber)) throw new Error('رقم الهاتف غير صحيح');
    /* In production, compare against the Stage 1 values stored on the
     * server-side draft. Demo accepts any well-formed pair. */
    return { confirmed: true };
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
    if (method === 'fawry') {
      txn.fawryCode = String(Math.floor(Math.random() * 9_000_000_000) + 1_000_000_000);
      PAYMENTS.push(txn);
      return { refNumber, fawryCode: txn.fawryCode };
    }
    PAYMENTS.push(txn);
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
      payment: {
        method: txn.method,
        refNumber: txn.refNumber,
        amount: txn.amount,
        paidAt: txn.paidAt,
        ...(txn.fawryCode ? { fawryCode: txn.fawryCode } : {}),
      },
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

  /* ── MOI-aligned methods ──────────────────────────────────────────── */

  /**
   * MOI verify step (PDF p.5 lower). The applicant re-enters NID + mobile
   * after submitting profile data — values must match the MOI session.
   *
   * INTEGRATION CONTRACT: POST /applicant/verify
   *   body: { nationalId, mobile }
   *   response: { confirmed: boolean }
   *   errors: throws on validation failure
   */
  async verifyApplicant(input: { nationalId: string; mobile: string }): Promise<{ confirmed: boolean }> {
    await simulateLatency(250, 500);
    /* The mock checks against the static MOI session payload. Production
     * compares against the server-side draft populated at MOI SSO time. */
    const { moiSessionMatches } = await import('../lib/moi-session.mock');
    const ok = moiSessionMatches(input);
    return { confirmed: ok };
  },

  /**
   * Create a payment intent (PDF pp.6-7). Returns an intentId + a
   * deterministic 10-digit reference. Fawry-code intents also carry an
   * 8-digit code valid for 48 hours.
   *
   * INTEGRATION CONTRACT: POST /applicant/payment/intent
   *   body: { method: 'fawry-code' | 'credit-card' }
   *   response: { intentId, refNumber, fawryCode? }
   */
  async createPaymentIntent(input: {
    method: 'fawry-code' | 'credit-card';
  }): Promise<{ intentId: string; refNumber: string; fawryCode?: string }> {
    await simulateLatency(400, 700);
    const { deterministicPaymentReference, deterministicFawryCode } = await import(
      '../lib/deterministic-codes'
    );
    const refNumber = deterministicPaymentReference(DRAFT.applicantId);
    const intentId = `INT-${refNumber}`;
    if (input.method === 'fawry-code') {
      return { intentId, refNumber, fawryCode: deterministicFawryCode(DRAFT.applicantId) };
    }
    return { intentId, refNumber };
  },

  /**
   * Confirm payment after the user completes the credit-card flow (PDF
   * p.8 top). Returns the paid timestamp + marks the draft.
   *
   * INTEGRATION CONTRACT: POST /applicant/payment/confirm
   *   body: { intentId }
   *   response: { confirmed: true, paidAt }
   */
  async confirmPayment(_input: { intentId: string }): Promise<{ confirmed: true; paidAt: number }> {
    await simulateLatency(500, 900);
    const paidAt = Date.now();
    DRAFT = {
      ...DRAFT,
      furthestStage: Math.max(DRAFT.furthestStage, 6),
      lastSavedAt: paidAt,
    };
    return { confirmed: true, paidAt };
  },

  /**
   * Mark parents data as اعتماد (PDF p.10). Stage 8 is blocked until this
   * flag is set on the draft.
   *
   * INTEGRATION CONTRACT: POST /applicant/parents/approve
   *   response: { approvedAt }
   */
  async approveParents(): Promise<{ approvedAt: number }> {
    await simulateLatency(250, 500);
    const approvedAt = Date.now();
    DRAFT = {
      ...DRAFT,
      furthestStage: Math.max(DRAFT.furthestStage, 7),
      lastSavedAt: approvedAt,
    };
    return { approvedAt };
  },

  /**
   * Pick the first-exam date (PDF p.11). Persisted on the draft so the
   * attendance card (Stage 9) can render the chosen date.
   *
   * INTEGRATION CONTRACT: POST /applicant/exam-date
   *   body: { date: ISO string }
   *   response: { date }
   */
  async pickFirstExamDate(input: { date: string }): Promise<{ date: string }> {
    await simulateLatency(250, 500);
    DRAFT = {
      ...DRAFT,
      examSlot: {
        slotId: `MOI-${input.date}`,
        date: input.date,
        time: '08:00',
        location: 'كلية الشرطة - مبنى الاختبارات - القاهرة',
      },
      furthestStage: Math.max(DRAFT.furthestStage, 8),
      lastSavedAt: Date.now(),
    };
    return { date: input.date };
  },
};
