/**
 * Stage 8 — exam schedule (RFP Scope Document §2.2 stage 8).
 * Picker grid of available slots; reserve and confirm.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck } from 'lucide-react';
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
import { useExamSlots, useReserveSlot } from '../api/applicantPortal.queries';
import { useCategories } from '../api/categories.queries';
import { useApplicantPortalStore } from '../store/applicantPortal.store';
import { TEST_KIND_ICON, TEST_KIND_LABEL_AR } from '../lib/category-test-labels';
import type { ApplicantCategoryKey, RequiredTestKind } from '@/shared/types/domain';
import { cn } from '@/shared/lib/cn';

const APPLICANT_ID = 'APP-2026000';

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

  if (isLoading) return <LoadingState variant="card-grid" count={9} />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data || data.length === 0) return <EmptyState variant="generic" title="لا توجد مواعيد متاحة" />;

  const grouped = groupByDate(data);

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
              حجز موعد {exam.name}
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              اختر موعداً واحداً من الأماكن المتاحة. لا يمكن تغيير الموعد بعد التأكيد.
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

      {grouped.map(({ date, slots }) => (
        <Card key={date}>
          <h3 className="mb-3 font-ar-display text-md font-bold text-ink-900">{fmtDate(date, 'short')}</h3>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {slots.map((s) => {
              const remaining = s.capacity - s.reserved;
              const full = remaining <= 0;
              const selected = chosen === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => !full && setChosen(s.id)}
                  disabled={full}
                  aria-pressed={selected}
                  className={cn(
                    'rounded-lg border p-3 text-start transition-colors duration-fast ease-standard',
                    full
                      ? 'cursor-not-allowed border-border-subtle bg-ink-50 opacity-60'
                      : selected
                        ? 'border-teal-500 bg-teal-50 shadow-focus-teal'
                        : 'border-border-default hover:bg-ink-50',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-numeric tnum text-md font-bold text-ink-900" dir="ltr">
                      {s.time}
                    </span>
                    {full && <Badge tone="danger">ممتلئ</Badge>}
                    {!full && remaining < 10 && <Badge tone="warning">{remaining} متاح</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-ink-500">{s.location}</p>
                  <p className="mt-2 text-2xs text-ink-500 font-numeric tnum">
                    {s.reserved}/{s.capacity} مقعد
                  </p>
                </button>
              );
            })}
          </div>
        </Card>
      ))}

      <div className="sticky bottom-20 flex items-center justify-between gap-3 rounded-lg border border-border-default bg-surface-card px-4 py-3 shadow-md">
        <span className="text-sm text-ink-700">
          {chosen ? 'سيتم حجز الموعد المحدد ولا يمكن تغييره لاحقاً.' : 'لم يتم اختيار موعد بعد.'}
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
                toast('تم حجز الموعد بنجاح', 'success');
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
  const first = sorted[0]!;
  return {
    kind: first.kind,
    name: TEST_KIND_LABEL_AR[first.kind],
    subtitle: `فئة: ${cat.labelAr}`,
    order: first.order,
    total: sorted.length,
  };
}

function groupByDate<T extends { date: string }>(slots: T[]): { date: string; slots: T[] }[] {
  const map = new Map<string, T[]>();
  for (const s of slots) {
    const key = s.date.slice(0, 10);
    const arr = map.get(key) ?? [];
    arr.push(s);
    map.set(key, arr);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 5)
    .map(([date, slots]) => ({ date, slots }));
}
