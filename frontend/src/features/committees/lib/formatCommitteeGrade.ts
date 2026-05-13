/**
 * formatCommitteeGrade — single sanctioned renderer for the "معيار
 * القبول" column on the list page and the grade pill on the detail
 * page.
 *
 *   score → "الدرجة: {min}% – {max}%"
 *   tier  → "التقدير: {GRADE_TIERS[min]} – {GRADE_TIERS[max]}"
 *           (collapses to a single label when min === max)
 *
 * The shape is identical at the call site regardless of the
 * discriminator so the column can render a single string. Numbers go
 * through `num()` so Arabic numerals match the rest of the admin UI.
 */

import { GRADE_TIERS, type Committee } from '@/shared/types/domain';
import { num } from '@/shared/lib/format';

export function formatCommitteeGrade(c: Committee): string {
  if (c.gradeType === 'score') {
    return `الدرجة: ${num(c.gradeMin)}% – ${num(c.gradeMax)}%`;
  }
  const minLabel = GRADE_TIERS[c.gradeMin] ?? '—';
  const maxLabel = GRADE_TIERS[c.gradeMax] ?? '—';
  if (c.gradeMin === c.gradeMax) return `التقدير: ${minLabel}`;
  return `التقدير: ${minLabel} – ${maxLabel}`;
}
