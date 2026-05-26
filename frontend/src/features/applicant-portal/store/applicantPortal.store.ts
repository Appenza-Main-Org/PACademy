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
  /** Faculty picked on /applicant/start for the `specialized_officers`
   *  category — the applicant picks الكلية first, then chooses a
   *  specialization scoped to that faculty. Stored as the human-readable
   *  Arabic name (matches the lookups `name` field). Null when the picker
   *  hasn't been used. */
  selectedFaculty: string | null;
  /** Sub-specialization picked on /applicant/start when the category is
   *  `specialized_officers` — the applicant chooses which specialization
   *  to apply for before entering the wizard. Null for all other
   *  categories (or before the picker has been used). */
  selectedSpecialization: string | null;

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
  /** Committee assigned by the eligibility check for the selected category.
   *  Taken from the first committee in the eligible-categories response.
   *  Displayed on Stage 8 and printed on the print card. */
  assignedCommitteeId: string | null;
  assignedCommitteeName: string | null;
  /** Demo-only flag set when the "submitted" sample applicant logs in.
   *  Triggers the 4-tab post-submission view in ApplicantPortalLayout
   *  instead of the wizard. Reaching the wizard's exam-date stage by
   *  walking through the normal flow does NOT flip this. */
  submittedDemo: boolean;

  /** Timestamp (ms epoch) the applicant pressed «تأكيد الإرسال» on the
   *  وثيقة تعارف (Stage 11). Drives a 24-hour edit window after which
   *  the document becomes view-and-print only. */
  vothiqaTaarufSubmittedAt: number | null;

  setNationalId: (id: string | null) => void;
  setSelectedCategoryKey: (key: string | null) => void;
  setSelectedCycleId: (id: string | null) => void;
  setSelectedFaculty: (f: string | null) => void;
  setSelectedSpecialization: (s: string | null) => void;
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
  setAssignedCommittee: (id: string | null, name: string | null) => void;
  setSubmittedDemo: (on: boolean) => void;
  setVothiqaTaarufSubmittedAt: (ts: number | null) => void;
  clear: () => void;
}

export const useApplicantPortalStore = create<ApplicantPortalState>()(
  persist(
    (set) => ({
      nationalId: null,
      selectedCategoryKey: null,
      selectedCycleId: null,
      selectedFaculty: null,
      selectedSpecialization: null,
      moiSession: null,
      verifiedAt: null,
      paid: false,
      paymentMethod: null,
      paymentReference: null,
      fawryCode: null,
      firstExamDate: null,
      parentsApproved: false,
      submittedDemo: false,
      vothiqaTaarufSubmittedAt: null,
      assignedCommitteeId: null,
      assignedCommitteeName: null,
      setNationalId: (id) => set({ nationalId: id }),
      setSelectedCategoryKey: (key) => set({ selectedCategoryKey: key }),
      setSelectedCycleId: (id) => set({ selectedCycleId: id }),
      setSelectedFaculty: (f) => set({ selectedFaculty: f }),
      setSelectedSpecialization: (s) => set({ selectedSpecialization: s }),
      setMoiSession: (session) => set({ moiSession: session }),
      setVerifiedAt: (ts) => set({ verifiedAt: ts }),
      setPayment: (input) => set(input),
      setFirstExamDate: (iso) => set({ firstExamDate: iso }),
      setParentsApproved: (approved) => set({ parentsApproved: approved }),
      setAssignedCommittee: (id, name) => set({ assignedCommitteeId: id, assignedCommitteeName: name }),
      setSubmittedDemo: (on) => set({ submittedDemo: on }),
      setVothiqaTaarufSubmittedAt: (ts) => set({ vothiqaTaarufSubmittedAt: ts }),
      clear: () =>
        set({
          nationalId: null,
          selectedCategoryKey: null,
          selectedCycleId: null,
          selectedFaculty: null,
          selectedSpecialization: null,
          moiSession: null,
          verifiedAt: null,
          paid: false,
          paymentMethod: null,
          paymentReference: null,
          fawryCode: null,
          firstExamDate: null,
          parentsApproved: false,
          submittedDemo: false,
          vothiqaTaarufSubmittedAt: null,
          assignedCommitteeId: null,
          assignedCommitteeName: null,
        }),
    }),
    {
      name: 'pa-applicant-portal',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
