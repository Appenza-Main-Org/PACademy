/**
 * Applicant-portal store — Zustand with sessionStorage persistence.
 *
 * Holds the cross-stage state the wizard needs but TanStack Query draft
 * doesn't carry: the National ID captured in Stage 1 (so Stage 3 can
 * derive DOB/gender from it) and the category chosen in the pre-wizard
 * gate (so the wizard header can show the badge and Stage 8/Test screens
 * can drive their test list from it).
 *
 * `selectedCategoryKey` is widened to `string | null` here to keep this
 * file independent of the domain-types churn in Bucket B1; consumers
 * narrow via the imported `ApplicantCategoryKey` union when reading.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface ApplicantPortalState {
  nationalId: string | null;
  selectedCategoryKey: string | null;
  setNationalId: (id: string | null) => void;
  setSelectedCategoryKey: (key: string | null) => void;
  clear: () => void;
}

export const useApplicantPortalStore = create<ApplicantPortalState>()(
  persist(
    (set) => ({
      nationalId: null,
      selectedCategoryKey: null,
      setNationalId: (id) => set({ nationalId: id }),
      setSelectedCategoryKey: (key) => set({ selectedCategoryKey: key }),
      clear: () => set({ nationalId: null, selectedCategoryKey: null }),
    }),
    {
      name: 'pa-applicant-portal',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
