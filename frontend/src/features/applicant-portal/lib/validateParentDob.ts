/**
 * Parent-child age-gap validator (client direction 2026-05-21).
 *
 * Every parent's date of birth must be at least 15 years earlier than
 * their child's. Used as a react-hook-form `validate` callback on each
 * parent date-of-birth input.
 *
 * The validator is silent (returns `true`) when either side is missing or
 * unparseable so fields can be filled in any order without spurious
 * errors — only flags an actual ordering violation.
 *
 * Extracted from Stage7FamilyPage so the same rule applies inside
 * Stage 11 (وثيقة تعارف) without duplication.
 */

export const PARENT_CHILD_MIN_YEARS = 15;

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

export function validateParentDob(
  parentIso: string,
  childIso: string | undefined,
): true | string {
  if (!childIso || !parentIso) return true;
  const parent = new Date(parentIso);
  const child = new Date(childIso);
  if (Number.isNaN(parent.getTime()) || Number.isNaN(child.getTime())) return true;
  const years = (child.getTime() - parent.getTime()) / MS_PER_YEAR;
  return (
    years >= PARENT_CHILD_MIN_YEARS ||
    `يجب أن يكبر تاريخ ميلاد الوالد/الوالدة عن الإبن/الإبنة بـ ${PARENT_CHILD_MIN_YEARS} سنة على الأقل`
  );
}
