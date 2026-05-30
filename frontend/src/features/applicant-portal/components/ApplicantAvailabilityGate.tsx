/**
 * ApplicantAvailabilityGate — admission-window guard for the applicant portal.
 *
 * The portal only accepts applications while an admission cycle is BOTH
 * flagged active (نشطة → `isActive`) AND approved-and-published
 * (اعتماد ونشر → status open/active/extended). The gate predicate lives in
 * `categories.service.ts::isCycleLive`; `useActiveCycles()` returns an empty
 * list whenever no cycle satisfies it.
 *
 * Wrapped around the `<Outlet />` of both applicant shells
 * (`ApplicantPreWizardLayout` + `ApplicantPortalLayout`) so that — until a
 * cycle is active+published — the applicant lands on a single
 * «التقديم غير متاح في الوقت الحالي» notice and cannot reach the category
 * picker, wizard, or any downstream stage.
 *
 * @example
 *   <ApplicantAvailabilityGate>
 *     <Outlet />
 *   </ApplicantAvailabilityGate>
 */

import type { ReactNode } from 'react';
import { CalendarClock } from 'lucide-react';
import { Card, ErrorState, LoadingState } from '@/shared/components';
import { useActiveCycles } from '../api/categories.queries';

export function ApplicantAvailabilityGate({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const cyclesQuery = useActiveCycles();

  if (cyclesQuery.isLoading) {
    return (
      <LoadingState
        mode="spinner"
        label="جارٍ التحقق من توافر التقديم…"
        className="py-16"
      />
    );
  }

  if (cyclesQuery.isError) {
    return (
      <ErrorState
        title="تعذّر التحقق من حالة التقديم"
        description="حدث خطأ أثناء الاتصال بالخادم. يُرجى المحاولة مرة أخرى."
        onRetry={() => void cyclesQuery.refetch()}
      />
    );
  }

  const hasOpenCycle = (cyclesQuery.data ?? []).length > 0;
  if (!hasOpenCycle) {
    return <ApplicationUnavailableNotice />;
  }

  return <>{children}</>;
}

function ApplicationUnavailableNotice(): JSX.Element {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center py-12">
      <Card variant="feature" withAccentBorder className="w-full text-center">
        <div className="flex flex-col items-center gap-4 px-6 py-8">
          <span
            aria-hidden
            className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-gold-50 text-gold-700"
          >
            <CalendarClock size={30} strokeWidth={1.6} />
          </span>
          <h2 className="font-ar-display text-lg font-bold text-ink-900">
            التقديم غير متاح في الوقت الحالي
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-ink-500">
            لم يبدأ باب التقديم بعد. سيُفتح التقديم فور اعتماد ونشر دورة القبول
            وتفعيلها من قِبل الأكاديمية. يُرجى المتابعة لاحقاً.
          </p>
        </div>
      </Card>
    </div>
  );
}
