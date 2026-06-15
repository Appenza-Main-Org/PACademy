/**
 * Stage 10 — exam-results follow-up (PDF p.12 lower, MOI-aligned).
 *
 * The MOI reference flow renders this stage as a simple table with the
 * same five columns as the printed card's exam table (م · الإختبار ·
 * التاريخ · النتيجة · ملاحظات). The previous rich pipeline cards
 * (capacities/traits/sports/medical/investigation/finalResult tiles) are
 * gone — that detail moves to the staff-side committee/medical/board
 * surfaces. Applicants get the same five-column row view that's printed
 * on their attendance card.
 */

import { useMemo } from 'react';
import { Calendar } from 'lucide-react';
import {
  Badge,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/shared/components';
import type { DataTableColumn } from '@/shared/components';
import { useDraft, useFollowUp, useFollowUpExamPlan } from '../api/applicantPortal.queries';
import { date as fmtDate } from '@/shared/lib/format';
import { useApplicantPortalStore } from '../store/applicantPortal.store';
import { MOI_APPLICANT_SESSION } from '../lib/moi-session.mock';
import {
  buildFollowUpRows,
  type FollowUpResultRow,
} from '../lib/follow-up-exam-plan';

const APPLICANT_ID = MOI_APPLICANT_SESSION.applicantId;

export function Stage10FollowUpPage(): JSX.Element {
  const { data: draft, isLoading: isDraftLoading, error: draftError, refetch: refetchDraft } = useDraft(APPLICANT_ID);
  const { data: followUp, isLoading: isFollowUpLoading, error: followUpError, refetch: refetchFollowUp } = useFollowUp(APPLICANT_ID);
  const firstExamDate = useApplicantPortalStore((s) => s.firstExamDate);
  const selectedCycleId = useApplicantPortalStore((s) => s.selectedCycleId);
  const selectedCategoryKey = useApplicantPortalStore((s) => s.selectedCategoryKey);
  const cycleId = draft?.cycleId ?? selectedCycleId ?? null;
  const categoryKey = draft?.categoryKey ?? selectedCategoryKey ?? 'officers_general';
  const examPlanQuery = useFollowUpExamPlan(cycleId, categoryKey);

  const rows: readonly FollowUpResultRow[] = useMemo(() => {
    const examDate = firstExamDate ?? draft?.examSlot?.date ?? null;
    const scheduleDates: Record<string, string | null | undefined> = {};
    for (const schedule of draft?.testSchedules ?? []) {
      const code = schedule.examId ?? schedule.testCode;
      if (code && schedule.date && !(code in scheduleDates)) scheduleDates[code] = schedule.date;
    }
    return buildFollowUpRows({
      plan: examPlanQuery.data?.plan,
      exams: examPlanQuery.data?.exams ?? [],
      followUp: followUp ?? null,
      firstExamDate: examDate,
      scheduleDates,
    });
  }, [examPlanQuery.data, followUp, firstExamDate, draft?.examSlot?.date, draft?.testSchedules]);

  const columns: DataTableColumn<FollowUpResultRow>[] = useMemo(
    () => [
      { key: 'serial', label: 'م', width: '56px', render: (r: FollowUpResultRow) => <span className="font-numeric tnum">{r.serial}</span> },
      { key: 'testLabel', label: 'الإختبار', render: (r: FollowUpResultRow) => r.testLabel },
      {
        key: 'date',
        label: 'التاريخ',
        render: (r: FollowUpResultRow) =>
          r.date ? (
            <span className="font-numeric tnum" dir="ltr">
              {fmtDate(r.date, 'short')}
            </span>
          ) : (
            <span className="text-ink-500">—</span>
          ),
      },
      {
        key: 'result',
        label: 'النتيجة',
        render: (r: FollowUpResultRow) => <Badge tone={r.result.tone}>{r.result.label}</Badge>,
      },
      { key: 'notes', label: 'ملاحظات', render: (r: FollowUpResultRow) => <span className="text-ink-500">{r.notes}</span> },
    ],
    [],
  );

  const error = draftError ?? followUpError ?? examPlanQuery.error;
  if (isDraftLoading || isFollowUpLoading || examPlanQuery.isLoading) {
    return <LoadingState variant="table" rows={6} />;
  }
  if (error) {
    return (
      <ErrorState
        error={error as Error}
        onRetry={() => {
          void refetchDraft();
          void refetchFollowUp();
          void examPlanQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <header className="mb-3 flex items-start gap-3">
          <span aria-hidden className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-teal-50 text-teal-700">
            <Calendar size={20} strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="font-ar-display text-xl font-bold text-ink-900">نتائج ومواعيد الإختبارات</h2>
            <p className="mt-1 text-sm text-ink-500 leading-normal">
              تابع كل إختبار من هنا. تظهر النتائج تلقائياً فور اعتمادها بمعرفة الجهات المختصة.
            </p>
          </div>
        </header>
        {rows.length > 0 ? (
          <DataTable<FollowUpResultRow>
            data={[...rows]}
            columns={columns}
            rowKey={(r: FollowUpResultRow) => `result-${r.serial}`}
          />
        ) : (
          <EmptyState
            variant="generic"
            title="لم يتم تفعيل اختبارات لهذه الفئة"
            description="ستظهر هنا الاختبارات بعد اعتماد إعدادات دورة القبول من لوحة الإدارة."
          />
        )}
      </Card>
    </div>
  );
}
