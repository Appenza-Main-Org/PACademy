/**
 * TestTimeline — visual progression of all an applicant's tests.
 * Renders a horizontal connected pipeline (RTL-aware) with one node
 * per test, each showing the test kind icon, label, scheduled date,
 * and status. Each node is colour-coded by status (passed/failed/
 * scheduled/missed/pending).
 */

import { CalendarClock, CheckCircle2, Clock, XCircle, type LucideIcon } from 'lucide-react';
import { date as fmtDate } from '@/shared/lib/format';
import type { TestSchedule, TestStatus } from '@/shared/types/domain';
import { TEST_KIND_ICON, TEST_KIND_LABEL_AR } from '../lib/category-test-labels';

interface TestTimelineProps {
  tests: readonly TestSchedule[];
}

const STATUS_TONE: Record<
  TestStatus,
  { ring: string; bg: string; text: string; line: string; label: string; Icon: LucideIcon }
> = {
  passed: {
    ring: 'border-success ring-success',
    bg: 'bg-success-bg',
    text: 'text-success',
    line: 'bg-success',
    label: 'مجتاز',
    Icon: CheckCircle2,
  },
  failed: {
    ring: 'border-terra-500',
    bg: 'bg-terra-50',
    text: 'text-terra-700',
    line: 'bg-terra-500',
    label: 'لم يجتز',
    Icon: XCircle,
  },
  attended: {
    ring: 'border-teal-500',
    bg: 'bg-teal-50',
    text: 'text-teal-700',
    line: 'bg-teal-300',
    label: 'تم الحضور',
    Icon: Clock,
  },
  pending_result: {
    ring: 'border-gold-400',
    bg: 'bg-gold-50',
    text: 'text-gold-700',
    line: 'bg-gold-300',
    label: 'بانتظار النتيجة',
    Icon: Clock,
  },
  scheduled: {
    ring: 'border-teal-300',
    bg: 'bg-surface-card',
    text: 'text-teal-700',
    line: 'bg-ink-200',
    label: 'قادم',
    Icon: CalendarClock,
  },
  missed: {
    ring: 'border-gold-500',
    bg: 'bg-gold-50',
    text: 'text-gold-700',
    line: 'bg-gold-300',
    label: 'متخلف عنه',
    Icon: XCircle,
  },
};

export function TestTimeline({ tests }: TestTimelineProps): JSX.Element | null {
  if (tests.length === 0) return null;

  /* Order chronologically by scheduledAt asc — past on the start side, future on the end side. */
  const ordered = [...tests].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
  );

  return (
    <section className="rounded-lg border border-border-subtle bg-surface-card p-5 shadow-xs">
      <header className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h3 className="font-ar-display text-md font-bold text-ink-900">جدول رحلتك في الاختبارات</h3>
          <p className="mt-0.5 text-2xs text-ink-500">
            {ordered.length} اختبار · يبدأ بـ{TEST_KIND_LABEL_AR[ordered[0]!.kind]}
          </p>
        </div>
        <Legend />
      </header>

      <ol className="relative flex items-start gap-2 overflow-x-auto pb-2">
        {ordered.map((t, i) => {
          const tone = STATUS_TONE[t.status];
          const KindIcon = TEST_KIND_ICON[t.kind];
          const isLast = i === ordered.length - 1;
          return (
            <li key={t.id} className="relative flex min-w-[150px] flex-1 flex-col items-center">
              {!isLast && (
                <span
                  aria-hidden
                  className={`absolute top-6 inset-inline-end-[-50%] h-0.5 w-full ${tone.line}`}
                />
              )}
              <div
                className={`relative flex h-12 w-12 items-center justify-center rounded-full border-2 ${tone.ring} ${tone.bg}`}
              >
                <KindIcon size={20} strokeWidth={1.75} />
              </div>
              <p className="mt-2 text-center text-xs font-bold text-ink-900">
                {TEST_KIND_LABEL_AR[t.kind]}
              </p>
              <p className="mt-0.5 text-center text-2xs text-ink-500 font-numeric tnum">
                {fmtDate(t.scheduledAt, 'short')}
              </p>
              <span
                className={`mt-1 inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-2xs font-medium ${tone.bg} ${tone.text}`}
              >
                <tone.Icon size={10} strokeWidth={2} />
                {tone.label}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Legend(): JSX.Element {
  return (
    <ul className="hidden items-center gap-3 text-2xs text-ink-500 md:flex">
      <Dot color="var(--success)" label="مجتاز" />
      <Dot color="var(--gold-400)" label="بانتظار النتيجة" />
      <Dot color="var(--teal-300)" label="قادم" />
      <Dot color="var(--terra-500)" label="لم يجتز" />
    </ul>
  );
}

function Dot({ color, label }: { color: string; label: string }): JSX.Element {
  return (
    <li className="flex items-center gap-1">
      <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      <span>{label}</span>
    </li>
  );
}
