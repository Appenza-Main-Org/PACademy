/**
 * Stage 8 — exam schedule (RFP Scope Document §2.2 stage 8).
 *
 * Daily-only scheduling: the applicant picks one of the next 3 available
 * days; the academy assigns the time internally. Per-hour slot picking
 * was removed — the underlying ExamSlot still carries a canonical time
 * (08:00 صباحاً) so the printed card has something to render, but the
 * applicant doesn't pick it.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, Check, MapPin, Users } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  toast,
} from '@/shared/components';
import { date as fmtDate } from '@/shared/lib/format';
import { arabicDayOfWeek } from '@/shared/lib/arabic';
import { useExamSlots, useReserveSlot } from '../api/applicantPortal.queries';
import { useCategories } from '../api/categories.queries';
import { useApplicantPortalStore } from '../store/applicantPortal.store';
import { TEST_KIND_ICON, TEST_KIND_LABEL_AR } from '../lib/category-test-labels';
import type { ApplicantCategoryKey, ExamSlot, RequiredTestKind } from '@/shared/types/domain';
import { cn } from '@/shared/lib/cn';

const APPLICANT_ID = 'APP-2026000';
const VISIBLE_DAYS = 3;

export function Stage8ExamSchedulePage(): JSX.Element {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useExamSlots();
  const reserveMut = useReserveSlot(APPLICANT_ID);
  const [chosen, setChosen] = useState<string | null>(null);

  const selectedCategoryKey = useApplicantPortalStore(
    (s) => s.selectedCategoryKey,
  );
  const categoriesQuery = useCategories();
  const exam = useMemo(
    () => resolveExam(categoriesQuery.data, selectedCategoryKey),
    [categoriesQuery.data, selectedCategoryKey],
  );
  const ExamIcon = TEST_KIND_ICON[exam.kind];

  const days = useMemo(() => nextDays(data ?? [], VISIBLE_DAYS), [data]);

  if (isLoading) return <LoadingState variant="card-grid" count={3} />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (days.length === 0) return <EmptyState variant="generic" title="لا توجد مواعيد متاحة" />;

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="mb-3 flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-md bg-teal-50 text-teal-700">
            <CalendarCheck size={18} strokeWidth={1.75} />
          </span>
          <div className="flex-1">
            <p className="text-2xs font-bold uppercase tracking-wide text-ink-500">
              الاختبار المحدد
            </p>
            <h2 className="mt-0.5 font-ar-display text-xl font-bold text-ink-900">
              حجز يوم {exam.name}
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              اختر يوماً واحداً من الأيام المتاحة. تُحدِّد الأكاديمية ميعاد بدء الاختبار داخل اليوم وتُطبَع على بطاقة التردد.
            </p>
          </div>
        </div>

        <div
          className="flex flex-wrap items-center gap-3 rounded-md border p-3"
          style={{
            borderColor: 'var(--accent-500, #1A6868)',
            background: 'var(--accent-50, #E6F1F1)',
          }}
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-surface-card text-ink-900">
            <ExamIcon size={18} strokeWidth={1.75} />
          </span>
          <div className="flex-1">
            <p className="font-ar-display text-md font-bold text-ink-900">
              {exam.name}
            </p>
            {exam.subtitle && (
              <p className="mt-0.5 text-2xs text-ink-700">{exam.subtitle}</p>
            )}
          </div>
          {exam.order !== null && (
            <Badge tone="info">
              الترتيب {exam.order} من {exam.total}
            </Badge>
          )}
        </div>
      </Card>

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}
      >
        {days.map((slot) => (
          <DayCard
            key={slot.id}
            slot={slot}
            selected={chosen === slot.id}
            onPick={() => setChosen(slot.id)}
          />
        ))}
      </div>

      <div className="sticky bottom-20 flex items-center justify-between gap-3 rounded-lg border border-border-default bg-surface-card px-4 py-3 shadow-md">
        <span className="text-sm text-ink-700">
          {chosen ? 'سيتم حجز اليوم المحدد ولا يمكن تغييره لاحقاً.' : 'لم يتم اختيار يوم بعد.'}
        </span>
        <Button
          variant="primary"
          size="lg"
          disabled={!chosen}
          isLoading={reserveMut.isPending}
          onClick={() => {
            if (!chosen) return;
            reserveMut.mutate(chosen, {
              onSuccess: () => {
                toast('تم حجز اليوم بنجاح', 'success');
                navigate('/applicant/print-card');
              },
              onError: (err) => toast(err.message ?? 'تعذر الحجز', 'danger'),
            });
          }}
        >
          تأكيد الحجز
        </Button>
      </div>
    </div>
  );
}

interface DayCardProps {
  slot: ExamSlot;
  selected: boolean;
  onPick: () => void;
}

function DayCard({ slot, selected, onPick }: DayCardProps): JSX.Element {
  const remaining = slot.capacity - slot.reserved;
  const full = remaining <= 0;
  const fillPercent = Math.min(100, Math.round((slot.reserved / slot.capacity) * 100));
  const lowStock = !full && remaining < 30;

  let availabilityTone: 'success' | 'warning' | 'danger' = 'success';
  let availabilityLabel = `${remaining} مقعد متاح`;
  if (full) {
    availabilityTone = 'danger';
    availabilityLabel = 'ممتلئ';
  } else if (lowStock) {
    availabilityTone = 'warning';
    availabilityLabel = `${remaining} مقاعد فقط`;
  }

  const fillBarColor = full
    ? 'bg-terra-500'
    : lowStock
      ? 'bg-gold-500'
      : 'bg-teal-500';

  const dayName = arabicDayOfWeek(slot.date);

  return (
    <button
      type="button"
      onClick={() => !full && onPick()}
      disabled={full}
      aria-pressed={selected}
      className={cn(
        'group relative flex flex-col gap-3 overflow-hidden rounded-lg border bg-surface-card p-4 text-start transition-all duration-fast ease-standard',
        'focus-visible:shadow-focus-teal focus-visible:outline-none',
        full
          ? 'cursor-not-allowed border-border-subtle bg-ink-50 opacity-70'
          : selected
            ? 'border-teal-500 bg-teal-50/50 shadow-card ring-2 ring-teal-500/30'
            : 'border-border-default hover:-translate-y-px hover:border-teal-500/40 hover:bg-teal-50/20 hover:shadow-sm',
      )}
    >
      {selected && (
        <span
          aria-hidden
          className="absolute end-0 top-0 h-full w-1 bg-teal-500"
        />
      )}

      <header className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'inline-flex h-10 w-10 items-center justify-center rounded-md transition-colors',
              full
                ? 'bg-ink-100 text-ink-500'
                : selected
                  ? 'bg-teal-500 text-white'
                  : 'bg-teal-50 text-teal-700 group-hover:bg-teal-500 group-hover:text-white',
            )}
          >
            <CalendarCheck size={18} strokeWidth={1.75} />
          </span>
          <div>
            <p className="font-ar-display text-md font-bold leading-tight text-ink-900">
              {dayName}
            </p>
            <p className="mt-0.5 font-numeric tnum text-2xs text-ink-500" dir="ltr">
              {fmtDate(slot.date, 'short')}
            </p>
          </div>
        </div>
        {selected && (
          <span
            aria-hidden
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-teal-500 text-white"
          >
            <Check size={14} strokeWidth={2.5} />
          </span>
        )}
      </header>

      <div className="flex items-start gap-2 text-sm text-ink-700">
        <MapPin size={14} strokeWidth={1.75} className="mt-0.5 shrink-0 text-ink-500" />
        <span className="line-clamp-2 font-medium">{slot.location}</span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-2xs text-ink-500">
            <Users size={12} strokeWidth={1.75} />
            <span className="font-numeric tnum" dir="ltr">
              {slot.reserved}/{slot.capacity}
            </span>
            <span>مقعد محجوز</span>
          </span>
          <Badge tone={availabilityTone}>{availabilityLabel}</Badge>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-ink-100">
          <div
            className={cn('h-full transition-all duration-base ease-standard', fillBarColor)}
            style={{ width: `${fillPercent}%` }}
          />
        </div>
      </div>
    </button>
  );
}

interface ResolvedExam {
  kind: RequiredTestKind;
  name: string;
  subtitle: string | null;
  order: number | null;
  total: number;
}

const FALLBACK_EXAM: ResolvedExam = {
  kind: 'aptitude',
  name: TEST_KIND_LABEL_AR.aptitude,
  subtitle: null,
  order: null,
  total: 0,
};

/** Pick the schedulable exam tied to the applicant's category. The first
 *  required test (lowest `order`) is the one Stage 8 schedules — typically
 *  aptitude or written. Falls back to a generic aptitude label when the
 *  category data isn't loaded or the applicant skipped the pre-wizard. */
function resolveExam(
  categories: readonly { key: ApplicantCategoryKey; labelAr: string; requiredTests: { kind: RequiredTestKind; order: number; passingCriteria: string }[] }[] | undefined,
  selectedKey: string | null,
): ResolvedExam {
  if (!categories || !selectedKey) return FALLBACK_EXAM;
  const cat = categories.find((c) => c.key === selectedKey);
  if (!cat || cat.requiredTests.length === 0) return FALLBACK_EXAM;
  const sorted = [...cat.requiredTests].sort((a, b) => a.order - b.order);
  const first = sorted[0];
  return {
    kind: first.kind,
    name: TEST_KIND_LABEL_AR[first.kind],
    subtitle: `فئة: ${cat.labelAr}`,
    order: first.order,
    total: sorted.length,
  };
}

/** Take up to N future-day slots in chronological order. Each input slot
 *  represents a full day (the seed emits one per day; if the data ever
 *  carries multiple per day, we de-duplicate by date and keep the first). */
function nextDays(slots: readonly ExamSlot[], n: number): ExamSlot[] {
  const seen = new Set<string>();
  const ordered = [...slots]
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((s) => {
      const key = s.date.slice(0, 10);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return ordered.slice(0, n);
}
