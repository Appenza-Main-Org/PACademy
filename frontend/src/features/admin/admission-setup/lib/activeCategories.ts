/**
 * useActiveCategoriesForCycle — projects step 1's active categories into
 * a stable view shape consumed by the exam-schedule step's tab header.
 *
 * Source of truth: applicant category configs filtered by
 * `isActive: true`, joined with the `applicant-categories` lookup row
 * for `nameAr`, sorted by `sortOrder`.
 *
 * The `cycleId` parameter is reserved for the day the source becomes
 * cycle-scoped (today it's global master data — see migration report
 * Open Questions). Callers can pass the picked cycle id without any
 * code change at the call site when that day comes.
 */

import { useCategoryConfigs } from '../api/applicationSettings.queries';

export interface ActiveCategoryView {
  /** Lookup `code` field (`officers_general` etc.) — used as the
   *  applicantCategoryId everywhere downstream. */
  id: string;
  nameAr: string;
  /** Same as `id` — duplicated for callers that already use `code`
   *  semantics in their existing data flow. */
  code: string;
  sortOrder: number;
}

export interface UseActiveCategoriesForCycleResult {
  data: ActiveCategoryView[] | undefined;
  isLoading: boolean;
  isError: boolean;
}

export function useActiveCategoriesForCycle(
  _cycleId: string,
): UseActiveCategoriesForCycleResult {
  const query = useCategoryConfigs();
  const data = query.data
    ?.filter((c) => c.isActive)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map<ActiveCategoryView>((c) => ({
      id: c.categoryCode,
      nameAr: c.categoryNameAr,
      code: c.categoryCode,
      sortOrder: c.sortOrder,
    }));
  return {
    data,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
