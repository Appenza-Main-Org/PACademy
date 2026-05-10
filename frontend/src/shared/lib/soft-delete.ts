/**
 * Soft-delete helpers — Gap D (admin-gaps).
 *
 * Tiny, framework-agnostic helpers for the SoftDeleteFields mixin.
 * Services use these to avoid open-coding `row.deletedAt` checks; UI uses
 * `DependencyResult` as the typed shape returned from `getDependencies()`.
 */

import type { SoftDeleteFields } from '@/shared/types/domain';

/** Typed result shape for service-side dependency checks. */
export interface DependencyResult {
  /** Per-relation counts, e.g. { applicants: 47, committees: 5 }. */
  counts: Record<string, number>;
  /** When true, soft delete is rejected — show DependencyWarning. */
  blocking: boolean;
  /** Optional pre-formatted Arabic message. */
  message?: string;
}

/** True when the row carries a non-null `deletedAt`. */
export function isSoftDeleted<T extends SoftDeleteFields>(row: T): boolean {
  return Boolean(row.deletedAt);
}

/** Filter out soft-deleted rows unless `includeDeleted` is true. */
export function filterDeleted<T extends SoftDeleteFields>(rows: T[], includeDeleted = false): T[] {
  if (includeDeleted) return rows;
  return rows.filter((r) => !r.deletedAt);
}

/** Stamp a row as soft-deleted; returns a new object (no mutation). */
export function applySoftDelete<T extends SoftDeleteFields>(
  row: T,
  options: { reason?: string; deletedBy?: string },
): T {
  return {
    ...row,
    deletedAt: new Date().toISOString(),
    deletedBy: options.deletedBy,
    deleteReason: options.reason,
  };
}

/** Strip the tombstone fields; returns a new object (no mutation). */
export function applyRestore<T extends SoftDeleteFields>(row: T): T {
  const next = { ...row };
  delete next.deletedAt;
  delete next.deletedBy;
  delete next.deleteReason;
  return next;
}

/**
 * Format a dependency result into the Arabic warning template.
 * Pass the Arabic noun for the parent ("هذه الفئة"/"هذه الدورة"), and
 * a label dictionary for the child relation keys.
 */
export function formatDependencyMessage(
  parentNoun: string,
  result: DependencyResult,
  labels: Record<string, string>,
): string {
  const parts: string[] = [];
  for (const [key, count] of Object.entries(result.counts)) {
    if (count <= 0) continue;
    const label = labels[key] ?? key;
    parts.push(`${count} ${label}`);
  }
  if (parts.length === 0) return '';
  return `لا يمكن حذف ${parentNoun} لارتباط${parts.length === 1 ? 'ها' : 'ها'} بـ ${parts.join(' و')}`;
}

/**
 * Throwable typed error — services raise this when soft delete is blocked.
 */
export class DependencyBlockedError extends Error {
  readonly code = 'DEPENDENCY_BLOCKED' as const;
  readonly result: DependencyResult;

  constructor(result: DependencyResult, parentNoun: string, labels: Record<string, string>) {
    super(formatDependencyMessage(parentNoun, result, labels));
    this.name = 'DependencyBlockedError';
    this.result = result;
  }
}
