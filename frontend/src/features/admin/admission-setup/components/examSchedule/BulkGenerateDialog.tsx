/**
 * BulkGenerateDialog — two-pane bulk-generate form.
 *
 * Right pane: DateRangePicker + note. Left pane: live preview of the
 * proposed days with weekend rows pre-marked OFF and existing dates
 * muted.
 *
 * On submit: calls `useGenerateBulkDays`. If the response includes
 * `skippedExistingDates`, the dialog flips into a follow-up "clear &
 * regenerate?" confirmation step.
 */

import { useMemo, useState } from 'react';
import { AlertCircle, CalendarCheck, CalendarX } from 'lucide-react';
import {
  Modal,
  Button,
  DateRangePicker,
  Badge,
  Textarea,
  toast,
} from '@/shared/components';
import type { DateRange } from '@/shared/components';
import { cn } from '@/shared/lib/cn';
import { WEEKEND_DAY_INDICES } from '../../types';
import type { ExamScheduleDay } from '../../types';
import {
  useClearDayRange,
  useGenerateBulkDays,
} from '../../api/examSchedule.queries';

export interface BulkGenerateDialogProps {
  open: boolean;
  onClose: () => void;
  cycleId: string;
  applicantCategoryId: string;
  categoryNameAr: string;
  /** Cycle window — restricts the DateRangePicker. */
  cycleStartIso: string;
  cycleEndIso: string;
  /** Current days for the target category — used for collision preview. */
  existingDays: ExamScheduleDay[];
}

function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isoDateRange(startIso: string, endIso: string): string[] {
  const start = new Date(`${startIso}T00:00:00.000Z`);
  const end = new Date(`${endIso}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  if (end.getTime() < start.getTime()) return [];
  const out: string[] = [];
  for (
    let cursor = new Date(start);
    cursor.getTime() <= end.getTime();
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    out.push(toIsoDate(cursor));
  }
  return out;
}

function isWeekendIso(iso: string): boolean {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return WEEKEND_DAY_INDICES.includes(d.getUTCDay());
}

function formatPreviewDate(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'short',
    weekday: 'long',
    timeZone: 'UTC',
  });
}

export function BulkGenerateDialog({
  open,
  onClose,
  cycleId,
  applicantCategoryId,
  categoryNameAr,
  cycleStartIso,
  cycleEndIso,
  existingDays,
}: BulkGenerateDialogProps): JSX.Element {
  const [range, setRange] = useState<DateRange>({ start: null, end: null });
  const [note, setNote] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState<{
    createdCount: number;
    skipped: string[];
    rangeStart: string;
    rangeEnd: string;
  } | null>(null);

  const bulkMut = useGenerateBulkDays();
  const clearMut = useClearDayRange();

  const startIso = range.start ? toIsoDate(range.start) : null;
  const endIso = range.end ? toIsoDate(range.end) : null;

  const existingDateSet = useMemo(
    () => new Set(existingDays.map((d) => d.date)),
    [existingDays],
  );

  const previewDates = useMemo(() => {
    if (!startIso || !endIso) return [];
    return isoDateRange(startIso, endIso);
  }, [startIso, endIso]);

  const previewStats = useMemo(() => {
    let working = 0;
    let off = 0;
    let skipped = 0;
    for (const iso of previewDates) {
      if (existingDateSet.has(iso)) {
        skipped++;
        continue;
      }
      if (isWeekendIso(iso)) off++;
      else working++;
    }
    return { total: previewDates.length, working, off, skipped };
  }, [previewDates, existingDateSet]);

  function reset(): void {
    setRange({ start: null, end: null });
    setNote('');
    setFormError(null);
    setFollowUp(null);
  }

  function close(): void {
    reset();
    onClose();
  }

  function submit(): void {
    if (!startIso || !endIso) {
      setFormError('اختر نطاق التواريخ');
      return;
    }
    if (endIso < startIso) {
      setFormError('تاريخ النهاية يجب أن يكون بعد تاريخ البداية');
      return;
    }
    if (startIso < cycleStartIso || endIso > cycleEndIso) {
      setFormError('نطاق التواريخ يجب أن يكون داخل نطاق الدورة');
      return;
    }
    setFormError(null);
    const trimmed = note.trim();
    bulkMut.mutate(
      {
        cycleId,
        applicantCategoryId,
        startDate: startIso,
        endDate: endIso,
        note: trimmed.length > 0 ? trimmed : null,
      },
      {
        onSuccess: (res) => {
          if (res.skippedExistingDates.length > 0) {
            setFollowUp({
              createdCount: res.created.length,
              skipped: res.skippedExistingDates,
              rangeStart: startIso,
              rangeEnd: endIso,
            });
            return;
          }
          toast(`تم إنشاء ${res.created.length} يوم`, 'success');
          close();
        },
      },
    );
  }

  function clearAndRegenerate(): void {
    if (!followUp) return;
    clearMut.mutate(
      {
        cycleId,
        applicantCategoryId,
        startDate: followUp.rangeStart,
        endDate: followUp.rangeEnd,
      },
      {
        onSuccess: () => {
          bulkMut.mutate(
            {
              cycleId,
              applicantCategoryId,
              startDate: followUp.rangeStart,
              endDate: followUp.rangeEnd,
              note: note.trim().length > 0 ? note.trim() : null,
            },
            {
              onSuccess: (res) => {
                toast(`تم إعادة التوليد: ${res.created.length} يوم`, 'success');
                close();
              },
            },
          );
        },
      },
    );
  }

  const isPending = bulkMut.isPending || clearMut.isPending;

  return (
    <Modal
      open={open}
      onClose={close}
      title={`توليد أيام لـ ${categoryNameAr}`}
      size="lg"
      transparentBackdrop={false}
    >
      {followUp ? (
        <div className="space-y-4 p-1">
          <div className="rounded-md border border-dashed border-gold-300 bg-gold-50 p-3 text-sm text-gold-700">
            تم إنشاء {followUp.createdCount} يوم. {followUp.skipped.length} تاريخ
            تم تخطيه (مسجل بالفعل). مسح وإعادة التوليد؟
          </div>
          <ul className="max-h-40 overflow-y-auto rounded-md border border-border-subtle bg-bg-muted/40 p-2 text-2xs text-ink-600">
            {followUp.skipped.map((iso) => (
              <li key={iso} className="px-2 py-0.5">
                {formatPreviewDate(iso)}
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              تجاهل وإغلاق
            </Button>
            <Button
              variant="primary"
              onClick={clearAndRegenerate}
              isLoading={isPending}
            >
              مسح وإعادة التوليد
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 p-1 md:grid-cols-2">
          {/* Right pane (form) — sits first in RTL */}
          <div className="space-y-3">
            <DateRangePicker
              label="نطاق التواريخ"
              value={range}
              onChange={setRange}
            />
            <div className="flex items-start gap-2 rounded-md border border-border-subtle bg-bg-muted/60 p-2 text-2xs text-ink-700">
              <AlertCircle size={14} strokeWidth={1.75} className="mt-0.5 shrink-0 text-teal-600" />
              <span>
                سيتم وضع علامة عطلة تلقائياً على أيام الجمعة والسبت. يمكن
                تعديل كل يوم بعد التوليد.
              </span>
            </div>
            <Textarea
              label="ملاحظة (اختياري)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ستُطبَّق هذه الملاحظة على كل يوم تم توليده."
              rows={3}
            />
            {formError ? (
              <p className="text-2xs text-terra-600">{formError}</p>
            ) : null}
          </div>

          {/* Left pane (preview) */}
          <div className="space-y-2 rounded-md border border-border-subtle bg-surface-card p-3">
            <header className="flex items-center justify-between">
              <h4 className="font-ar-display text-sm font-bold text-ink-900">معاينة</h4>
              {previewDates.length > 0 ? (
                <span className="text-2xs text-ink-500">
                  سيتم إنشاء {previewStats.total - previewStats.skipped} يوم:{' '}
                  <Badge tone="success">{previewStats.working} عمل</Badge>{' '}
                  <Badge tone="warning">{previewStats.off} عطلة</Badge>
                  {previewStats.skipped > 0 ? (
                    <>
                      {' '}
                      <Badge tone="neutral">{previewStats.skipped} تخطي</Badge>
                    </>
                  ) : null}
                </span>
              ) : null}
            </header>
            <ul className="max-h-72 overflow-y-auto rounded border border-border-subtle">
              {previewDates.length === 0 ? (
                <li className="p-3 text-center text-2xs text-ink-400">
                  اختر نطاقاً لعرض المعاينة.
                </li>
              ) : (
                previewDates.map((iso) => {
                  const collides = existingDateSet.has(iso);
                  const off = isWeekendIso(iso);
                  return (
                    <li
                      key={iso}
                      className={cn(
                        'flex items-center justify-between gap-2 px-2 py-1 text-2xs',
                        collides && 'bg-bg-muted/40 text-ink-400 line-through',
                      )}
                      title={collides ? 'يوم موجود — سيُتخطى' : undefined}
                    >
                      <span>{formatPreviewDate(iso)}</span>
                      {collides ? (
                        <Badge tone="neutral">موجود</Badge>
                      ) : off ? (
                        <Badge tone="warning">
                          <CalendarX size={10} strokeWidth={1.75} className="me-1 inline-block" />
                          عطلة
                        </Badge>
                      ) : (
                        <Badge tone="success">
                          <CalendarCheck size={10} strokeWidth={1.75} className="me-1 inline-block" />
                          يوم عمل
                        </Badge>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </div>

          <div className="flex justify-end gap-2 md:col-span-2">
            <Button variant="ghost" onClick={close}>
              إلغاء
            </Button>
            <Button variant="primary" onClick={submit} isLoading={isPending}>
              توليد
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
