/**
 * useApplicantGuard — common guard for the applicant Wizard stages.
 * Source: AUD-007 (suspended-applicant guard on stages).
 *
 * Returns:
 *  - `suspended`: true → render `SuspendedScreen` instead of the form
 *  - `wrap(child)`: helper that returns either the child or the
 *    suspended-screen JSX, whichever applies.
 */

import { Ban } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '@/shared/components';
import { useDraft } from '../api/applicantPortal.queries';

const APPLICANT_ID = 'APP-2026000';

export function useApplicantGuard(): {
  suspended: boolean;
  wrap: (child: ReactNode) => JSX.Element;
} {
  const { data: draft } = useDraft(APPLICANT_ID);
  const suspended = Boolean(draft?.suspended);

  const wrap = (child: ReactNode): JSX.Element =>
    suspended ? <SuspendedScreen /> : <>{child}</>;

  return { suspended, wrap };
}

function SuspendedScreen(): JSX.Element {
  return (
    <Card className="border-terra-500 bg-terra-50">
      <div className="flex items-start gap-4 p-2">
        <span aria-hidden className="inline-flex h-12 w-12 items-center justify-center rounded-md bg-terra-500 text-white">
          <Ban size={22} strokeWidth={1.75} />
        </span>
        <div>
          <p className="font-ar-display text-md font-bold text-terra-700">طلبك موقوف مؤقتاً</p>
          <p className="mt-1 text-sm text-terra-700/85 leading-normal">
            لا يمكن إجراء أي تعديل أو إرسال على ملف التقديم في الوقت الحالي. سيتم إخطارك فور
            تحديث الحالة. للاستفسار يمكنك التواصل عبر الخط الساخن
            <span className="mx-1 inline-block font-mono font-bold" dir="ltr">19000</span>.
          </p>
        </div>
      </div>
    </Card>
  );
}
