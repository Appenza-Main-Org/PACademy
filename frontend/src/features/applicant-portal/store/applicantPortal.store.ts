/**
 * Applicant-portal store — Zustand with sessionStorage persistence.
 *
 * Cross-stage state the wizard needs but TanStack Query draft doesn't carry:
 *   - National ID captured in Stage 1 (so Stage 3+ can derive DOB/gender)
 *   - Category chosen in the pre-wizard gate (drives wizard header + tests)
 *   - Cycle id (per-cycle openness/eligibility)
 *   - Payment state (paid flag + Fawry code + reference + chosen method)
 *   - First exam date (set on Stage 8 reservation, printed on Stage 9 card)
 *   - Parents-approval flag (Stage 7 اعتماد gate)
 *
 * `selectedCategoryKey` is widened to `string | null` here to keep this
 * file independent of the domain-types churn elsewhere; consumers narrow
 * via the imported `ApplicantCategoryKey` union when reading.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { MoiApplicantSession } from '../lib/moi-session.mock';

export type ApplicantPaymentMethod = 'fawry-code';

interface ApplicantPortalState {
  nationalId: string | null;
  selectedCategoryKey: string | null;
  selectedCycleId: string | null;

  /** Snapshot of the MOI identity-verification response captured on
   *  login. Drives the dimmed/auto-populated identity fields in the
   *  profile page. Null when MOI returned 404 or wasn't called. */
  moiSession: MoiApplicantSession | null;

  /** Identity re-verification (PDF p.5 lower) — set on /applicant/verify. */
  verifiedAt: number | null;

  /** Payment block — set on Stage 6. paid implies paymentReference. */
  paid: boolean;
  paymentMethod: ApplicantPaymentMethod | null;
  /** 10-digit reference, deterministic via seed-42 LCG. */
  paymentReference: string | null;
  /** 8-digit Fawry code (only set when method === 'fawry-code'). */
  fawryCode: string | null;

  /** First exam date, ISO string — set on Stage 8 reservation. */
  firstExamDate: string | null;
  /** Stage 7 اعتماد flag (parents must be approved before Stage 8). */
  parentsApproved: boolean;

  setNationalId: (id: string | null) => void;
  setSelectedCategoryKey: (key: string | null) => void;
  setSelectedCycleId: (id: string | null) => void;
  setMoiSession: (session: MoiApplicantSession | null) => void;
  setVerifiedAt: (ts: number | null) => void;
  setPayment: (input: {
    paid: boolean;
    paymentMethod: ApplicantPaymentMethod | null;
    paymentReference: string | null;
    fawryCode: string | null;
  }) => void;
  setFirstExamDate: (iso: string | null) => void;
  setParentsApproved: (approved: boolean) => void;
  clear: () => void;
}

export const useApplicantPortalStore = create<ApplicantPortalState>()(
  persist(
    (set) => ({
      nationalId: null,
      selectedCategoryKey: null,
      selectedCycleId: null,
      moiSession: null,
      verifiedAt: null,
      paid: false,
      paymentMethod: null,
      paymentReference: null,
      fawryCode: null,
      firstExamDate: null,
      parentsApproved: false,
      setNationalId: (id) => set({ nationalId: id }),
      setSelectedCategoryKey: (key) => set({ selectedCategoryKey: key }),
      setSelectedCycleId: (id) => set({ selectedCycleId: id }),
      setMoiSession: (session) => set({ moiSession: session }),
      setVerifiedAt: (ts) => set({ verifiedAt: ts }),
      setPayment: (input) => set(input),
      setFirstExamDate: (iso) => set({ firstExamDate: iso }),
      setParentsApproved: (approved) => set({ parentsApproved: approved }),
      clear: () =>
        set({
          nationalId: null,
          selectedCategoryKey: null,
          selectedCycleId: null,
          moiSession: null,
          verifiedAt: null,
          paid: false,
          paymentMethod: null,
          paymentReference: null,
          fawryCode: null,
          firstExamDate: null,
          parentsApproved: false,
        }),
    }),
    {
      name: 'pa-applicant-portal',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
