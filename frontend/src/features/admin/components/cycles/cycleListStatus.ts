/**
 * Two-state simplification of the broader CycleStatus enum for the
 * /admin/cycles list and add form.
 *
 * The domain `CycleStatus` carries several post-publication states
 * (active/open/extended/closed/processing/finalized/archived) that the
 * admission-setup, audit, and other surfaces continue to differentiate.
 * For the cycles list + add form we collapse the lifecycle to a binary:
 *
 *   review    → draft cycle, still being authored — inactive
 *   published → approved & published cycle — active
 *
 * The list no longer exposes a separate activation status. Active/inactive
 * is derived from this two-state value.
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

export function isCycleActiveByListStatus(s: CycleListStatus): boolean {
  return s === 'published';
}

export function listStatusToCyclePatch(
  s: CycleListStatus,
): { status: 'draft' | 'active'; isActive: boolean } {
  return {
    status: fromListStatus(s),
    isActive: isCycleActiveByListStatus(s),
  };
}
