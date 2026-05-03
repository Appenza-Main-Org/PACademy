/**
 * Stage 8 — exam schedule (RFP Scope Document §2.2 stage 8).
 * Picker grid of available slots; reserve and confirm.
 */

import { useState } from 'react';
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
import { cn } from '@/shared/lib/cn';

const APPLICANT_ID = 'APP-2026000';

export function Stage8ExamSchedulePage(): JSX.Element {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useExamSlots();
  const reserveMut = useReserveSlot(APPLICANT_ID);
  const [chosen, setChosen] = useState<string | null>(null);

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
          <div>
            <h2 className="font-ar-display text-xl font-bold text-ink-900">حجز موعد الاختبار</h2>
            <p className="mt-1 text-sm text-ink-500">
              اختر موعداً واحداً من الأماكن المتاحة. لا يمكن تغيير الموعد بعد التأكيد.
            </p>
          </div>
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
