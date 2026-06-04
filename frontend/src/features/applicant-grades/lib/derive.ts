/**
 * Pure derivation helpers shared by the page, drawers, and dialogs.
 * Keep these free of React so they remain testable in isolation.
 */

import type { GradeRow } from '../types';

export interface DerivedRow extends GradeRow {
  /** Effective max — overrideMax when set, else importMax. */
  max: number;
  isOverridden: boolean;
  /** Sum of active adjustments. */
  adj: number;
  /** Original percentage (total / max). */
  pct: number;
  /** Effective total — total + sum(active adjustments), clamped [0, max]. */
  eff: number;
  /** Effective percentage (eff / max). */
  effPct: number;
  /**
   * True when the applicant has already submitted an application linked
   * to this grade row in any cycle. While true, every grade-editing
   * affordance is locked in the admin UI.
   */
  isLockedBySubmission: boolean;
}

export function deriveRow(r: GradeRow): DerivedRow {
  const max = r.overrideMax ?? r.importMax;
  const adj = r.log.filter((x) => x.isActive).reduce((s, x) => s + x.amount, 0);
  const eff = Math.max(0, Math.min(max, r.total + adj));
  return {
    ...r,
    max,
    isOverridden: r.overrideMax != null,
    adj,
    pct: +((r.total / max) * 100).toFixed(2),
    eff,
    effPct: +((eff / max) * 100).toFixed(2),
    isLockedBySubmission: r.hasSubmittedApplication === true,
  };
}

/** Standard Arabic message shown wherever the lock blocks an edit. */
export const SUBMISSION_LOCK_MESSAGE =
  'لا يمكن تعديل درجات هذا الطالب — تم استخدامها في طلب تقديم مُرسَل بالفعل، وأي تعديل يخل بصحة سجل التقديم.';

/** Compact tooltip used on disabled icons / dropdown items. */
export const SUBMISSION_LOCK_TOOLTIP =
  'هذا الطالب قدّم بالفعل باستخدام هذه الدرجات؛ التعديل غير متاح.';

/** Arabic-normalize a string for case-insensitive substring match. */
export function arNormalize(s: string): string {
  return s
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[‎‏]/g, '')
    .trim()
    .toLowerCase();
}
