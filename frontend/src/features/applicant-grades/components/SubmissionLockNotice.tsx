/**
 * SubmissionLockNotice — inline banner shown in the grades drawers and
 * dialogs when the row belongs to an applicant who has already submitted
 * an application in a cycle. Explains why every edit affordance in the
 * surrounding container is disabled.
 */

import { Lock } from 'lucide-react';
import { SUBMISSION_LOCK_MESSAGE } from '../lib/derive';
import type { DerivedRow } from '../lib/derive';

interface Props {
  row: Pick<DerivedRow, 'submittedCycleName'>;
  variant?: 'banner' | 'compact';
}

export function SubmissionLockNotice({ row, variant = 'banner' }: Props): JSX.Element {
  if (variant === 'compact') {
    return (
      <div
        role="status"
        className="inline-flex items-center gap-1.5 rounded-full border border-terra-200 bg-terra-50 px-2.5 py-1 text-2xs font-semibold text-terra-700"
      >
        <Lock size={11} strokeWidth={1.75} aria-hidden />
        <span>مُقفل — تم التقديم</span>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="flex items-start gap-2.5 rounded-md border border-terra-300 border-s-[3px] border-s-terra-500 bg-terra-50 p-3.5 text-xs leading-relaxed text-terra-700"
    >
      <Lock size={14} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="font-bold">سجل درجات مُقفل لارتباطه بطلب تقديم</div>
        <p className="m-0 mt-1">{SUBMISSION_LOCK_MESSAGE}</p>
        {row.submittedCycleName ? (
          <p className="m-0 mt-1 text-2xs text-terra-600">
            دورة التقديم: <strong className="text-terra-700">{row.submittedCycleName}</strong>
          </p>
        ) : null}
      </div>
    </div>
  );
}
