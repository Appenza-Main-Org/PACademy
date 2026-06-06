/**
 * useActiveCategoriesForCycle — projects step 1's active categories into
 * a stable view shape consumed by the exam-schedule step's tab header.
 *
 * Source of truth: applicant category configs filtered by
 * `isActive: true`, joined with the `applicant-categories` lookup row
 * for `nameAr`, sorted by `sortOrder`.
 *
 * The `cycleId` parameter scopes the app-settings source so switching
 * admission cycles never reuses another cycle's category configuration.
 */

import { useCategoryConfigs } from '../api/applicationSettings.queries';
import { useLookup } from '@/features/lookups';

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
  cycleId: string,
): UseActiveCategoriesForCycleResult {
  const query = useCategoryConfigs(Boolean(cycleId), cycleId);
  const categoriesQuery = useLookup('applicant-categories');
  const activeLookupCodes = new Set(
    (categoriesQuery.data ?? [])
      .filter((category) => category.isActive)
      .map((category) => category.code),
  );
  const data = query.data
    ?.filter((c) => c.isActive && activeLookupCodes.has(c.categoryCode))
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
    isLoading: query.isLoading || categoriesQuery.isLoading,
    isError: query.isError || categoriesQuery.isError,
  };
}
