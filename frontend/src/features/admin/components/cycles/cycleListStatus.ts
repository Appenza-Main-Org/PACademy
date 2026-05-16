/**
 * Two-state simplification of the broader CycleStatus enum for the
 * /admin/cycles list and add form.
 *
 * The domain `CycleStatus` carries several post-publication states
 * (active/open/extended/closed/processing/finalized/archived) that the
 * admission-setup, audit, and other surfaces continue to differentiate.
 * For the cycles list + add form we collapse the lifecycle to a binary:
 *
 *   review    → draft cycle, still being authored — edits permitted
 *   published → any cycle that has been approved & published — locked
 *
 * Edit gating in the list keys off `review`. Submitting `published` from
 * the add form routes through the existing single-active-cycle invariant
 * (cyclesService.create activates the new cycle, conflict dialog handles
 * demotion of an existing active one).
 */

import type { CycleStatus } from '@/shared/types/domain';

export type CycleListStatus = 'review' | 'published';

export const LIST_STATUS_LABEL: Record<CycleListStatus, string> = {
  review: 'إدراج ومراجعة',
  published: 'اعتماد ونشر',
};

export const LIST_STATUS_TONE: Record<CycleListStatus, 'neutral' | 'success'> = {
  review: 'neutral',
  published: 'success',
};

export const LIST_STATUS_OPTIONS: ReadonlyArray<{ value: CycleListStatus; label: string }> = [
  { value: 'review', label: LIST_STATUS_LABEL.review },
  { value: 'published', label: LIST_STATUS_LABEL.published },
];

export function toListStatus(s: CycleStatus): CycleListStatus {
  return s === 'draft' ? 'review' : 'published';
}

/** Map the list-status back to the domain enum the service layer accepts. */
export function fromListStatus(s: CycleListStatus): 'draft' | 'active' {
  return s === 'review' ? 'draft' : 'active';
}
