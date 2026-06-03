/**
 * DaysTable — per-category list of exam-schedule days.
 *
 * Renders the active category's days with:
 *   - date + Arabic day-of-week
 *   - WORKING / OFF status badge
 *   - actions menu: toggle off/on, edit, delete
 *
 * Week separators are inserted before every Saturday row (Egyptian
 * week start) so the calendar reads as a vertical week list.
 *
 * Single-feature use; not promoted to shared (Guardrail §2.5 — 3+
 * threshold not met).
 */

import { useState } from 'react';
import { Calendar, MoreVertical, Pencil, RefreshCcw, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  DropdownMenu,
  EmptyState,
  ErrorState,
  Modal,
  Skeleton,
  toast,
} from '@/shared/components';
import { ARABIC_WEEKDAYS_SAT_FIRST } from '@/shared/components';
import { cn } from '@/shared/lib/cn';
import type { ExamScheduleDay } from '../../types';
import { useDeleteDay, useToggleDayOff } from '../../api/examSchedule.queries';

export interface DaysTableProps {
  cycleId: string;
  applicantCategoryId: string;
  days: ExamScheduleDay[];
  isLoading: boolean;
  isError: boolean;
  onEdit: (day: ExamScheduleDay) => void;
}

function arabicWeekday(iso: string): string {
  /* `Date.getUTCDay()`: Sun=0, Mon=1, ..., Sat=6.
   * `ARABIC_WEEKDAYS_SAT_FIRST` is indexed Sat=0, Sun=1, ..., Fri=6.
   * Map JS index → Sat-first index. */
  const d = new Date(`${iso}T00:00:00.000Z`).getUTCDay();
  const satFirstIndex = (d + 1) % 7;
  return ARABIC_WEEKDAYS_SAT_FIRST[satFirstIndex] ?? '';
}

function formatIsoDateAr(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function isSaturday(iso: string): boolean {
  return new Date(`${iso}T00:00:00.000Z`).getUTCDay() === 6;
}

export function DaysTable({
  cycleId,
  applicantCategoryId,
  days,
  isLoading,
  isError,
  onEdit,
}: DaysTableProps): JSX.Element {
  const toggleMut = useToggleDayOff();
  const deleteMut = useDeleteDay();
  const [deleteTarget, setDeleteTarget] = useState<ExamScheduleDay | null>(null);

  if (isError) {
    return <ErrorState title="تعذّر تحميل الأيام" />;
  }
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }
  if (days.length === 0) {
    return (
      <EmptyState
        variant="generic"
        title="لا توجد أيام مسجلة لهذه الفئة بعد"
        description="استخدم زر «توليد أيام جماعي» أعلاه لإنشاء التقويم."
      />
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-md border border-border-subtle">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-bg-muted text-2xs uppercase tracking-wide text-ink-600">
            <tr>
              <th className="w-14 px-4 py-2 text-center font-medium font-numeric tnum">م</th>
              <th className="px-4 py-2 text-start font-medium">التاريخ</th>
              <th className="px-4 py-2 text-start font-medium">الحالة</th>
              <th className="px-4 py-2 text-end font-medium">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle bg-surface-card">
            {days.map((day, index) => {
              const isOff = day.kind === 'OFF';
              const showWeekSeparator = isSaturday(day.date);
              return (
                <RowWithSeparator
                  key={day.id}
                  serial={index + 1}
                  day={day}
                  isOff={isOff}
                  showWeekSeparator={showWeekSeparator}
                  toggling={toggleMut.isPending}
                  onToggle={() =>
                    toggleMut.mutate(
                      { dayId: day.id, cycleId, applicantCategoryId },
                      {
                        onSuccess: () =>
                          toast(
                            isOff ? 'تم تحويل اليوم إلى يوم عمل' : 'تم تحويل اليوم إلى عطلة',
                            'success',
                          ),
                      },
                    )
                  }
                  onEdit={() => onEdit(day)}
                  onDelete={() => setDeleteTarget(day)}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="حذف يوم"
        size="sm"
        transparentBackdrop={false}
      >
        <div className="space-y-4 p-1">
          <p className="text-sm text-ink-700">
            {deleteTarget
              ? `حذف يوم ${formatIsoDateAr(deleteTarget.date)}؟ لا يمكن التراجع.`
              : ''}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!deleteTarget) return;
                deleteMut.mutate(
                  {
                    dayId: deleteTarget.id,
                    cycleId,
                    applicantCategoryId,
                  },
                  {
                    onSuccess: () => {
                      toast('تم حذف اليوم', 'success');
                      setDeleteTarget(null);
                    },
                  },
                );
              }}
              isLoading={deleteMut.isPending}
            >
              حذف
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function RowWithSeparator({
  serial,
  day,
  isOff,
  showWeekSeparator,
  toggling,
  onToggle,
  onEdit,
  onDelete,
}: {
  serial: number;
  day: ExamScheduleDay;
  isOff: boolean;
  showWeekSeparator: boolean;
  toggling: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}): JSX.Element {
  return (
    <>
      {showWeekSeparator ? (
        <tr aria-hidden className="bg-bg-muted/60">
          <td colSpan={4} className="px-4 py-1 text-2xs text-ink-500">
            <span className="inline-flex items-center gap-1">
              <Calendar size={12} strokeWidth={1.75} />
              الأسبوع الذي يبدأ في {formatIsoDateAr(day.date)}
            </span>
          </td>
        </tr>
      ) : null}
      <tr
        className={cn(
          'transition-colors',
          isOff && 'bg-bg-muted/40',
        )}
      >
        <th
          scope="row"
          className="px-4 py-2 text-center align-middle font-numeric text-sm font-medium text-ink-500 tnum"
        >
          <span dir="ltr">{serial.toLocaleString('en-US')}</span>
        </th>
        <td className="px-4 py-2 align-middle">
          <div className="flex flex-col">
            <span
              className={cn(
                'font-medium text-ink-900',
                isOff && 'text-ink-500 line-through',
              )}
            >
              {formatIsoDateAr(day.date)}
            </span>
            <span className="text-2xs text-ink-500">{arabicWeekday(day.date)}</span>
          </div>
        </td>
        <td className="px-4 py-2 align-middle">
          {isOff ? (
            <Badge tone="warning">عطلة</Badge>
          ) : (
            <Badge tone="success">يوم عمل</Badge>
          )}
        </td>
        <td className="px-4 py-2 text-end align-middle">
          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label="إجراءات اليوم"
                disabled={toggling}
              >
                <MoreVertical size={14} strokeWidth={1.75} />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              <DropdownMenu.Item onSelect={onToggle}>
                <RefreshCcw size={12} strokeWidth={1.75} className="me-2 inline-block" />
                {isOff ? 'تحويل إلى يوم عمل' : 'تحويل إلى عطلة'}
              </DropdownMenu.Item>
              <DropdownMenu.Item onSelect={onEdit}>
                <Pencil size={12} strokeWidth={1.75} className="me-2 inline-block" />
                تعديل
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item destructive onSelect={onDelete}>
                <Trash2 size={12} strokeWidth={1.75} className="me-2 inline-block" />
                حذف
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        </td>
      </tr>
    </>
  );
}
