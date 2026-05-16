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
  LoadingState,
} from '@/shared/components';
import type { DataTableColumn } from '@/shared/components';
import { useDraft, useFollowUp } from '../api/applicantPortal.queries';
import { date as fmtDate } from '@/shared/lib/format';
import { useApplicantPortalStore } from '../store/applicantPortal.store';
import { MOI_APPLICANT_SESSION } from '../lib/moi-session.mock';

const APPLICANT_ID = MOI_APPLICANT_SESSION.applicantId;

interface ResultRow {
  serial: number;
  testLabel: string;
  date: string | null;
  result: { label: string; tone: 'success' | 'danger' | 'warning' | 'neutral' };
  notes: string;
}

const TEST_LABELS: Record<string, string> = {
  capacities: 'قدرات',
  traits: 'السمات',
  sports: 'لياقة بدنية',
  medical: 'القومسيون الطبي',
  investigation: 'التحريات',
  finalResult: 'النتيجة النهائية',
};

const RESULT_TONE: Record<string, ResultRow['result']> = {
  passed: { label: 'اجتاز', tone: 'success' },
  failed: { label: 'لم يجتز', tone: 'danger' },
  'in-progress': { label: 'جارٍ', tone: 'warning' },
  'awaiting-approval': { label: 'بانتظار الاعتماد', tone: 'warning' },
  pending: { label: 'لم يبدأ', tone: 'neutral' },
};

export function Stage10FollowUpPage(): JSX.Element {
  const { data: draft } = useDraft(APPLICANT_ID);
  const { data: followUp, isLoading } = useFollowUp(APPLICANT_ID);
  const firstExamDate = useApplicantPortalStore((s) => s.firstExamDate);

  const rows: readonly ResultRow[] = useMemo(() => {
    if (!followUp) return [];
    const examDate = firstExamDate ?? draft?.examSlot?.date ?? null;
    const order = ['capacities', 'traits', 'sports', 'medical', 'investigation', 'finalResult'] as const;
    return order.map((key, i) => ({
      serial: i + 1,
      testLabel: TEST_LABELS[key] ?? key,
      date: key === 'capacities' ? examDate : null,
      result: RESULT_TONE[followUp[key as keyof typeof followUp] ?? 'pending'] ?? RESULT_TONE.pending!,
      notes: '—',
    }));
  }, [followUp, firstExamDate, draft?.examSlot?.date]);

  const columns: DataTableColumn<ResultRow>[] = useMemo(
    () => [
      { key: 'serial', label: 'م', width: '56px', render: (r: ResultRow) => <span className="font-numeric tnum">{r.serial}</span> },
      { key: 'testLabel', label: 'الإختبار', render: (r: ResultRow) => r.testLabel },
      {
        key: 'date',
        label: 'التاريخ',
        render: (r: ResultRow) =>
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
        render: (r: ResultRow) => <Badge tone={r.result.tone}>{r.result.label}</Badge>,
      },
      { key: 'notes', label: 'ملاحظات', render: (r: ResultRow) => <span className="text-ink-500">{r.notes}</span> },
    ],
    [],
  );

  if (isLoading || !followUp) return <LoadingState variant="table" rows={6} />;

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
        <DataTable<ResultRow>
          data={[...rows]}
          columns={columns}
          rowKey={(r: ResultRow) => `result-${r.serial}`}
        />
      </Card>
    </div>
  );
}
