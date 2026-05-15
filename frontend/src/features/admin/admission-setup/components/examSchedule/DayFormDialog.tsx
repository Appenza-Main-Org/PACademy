/**
 * DayFormDialog — add a single day or edit an existing one.
 *
 * zod-validated. On submit, calls `useAddDay` (when no `day` prop) or
 * `useUpdateDay` (when editing). Scoped to one (cycleId × applicantCategoryId)
 * pair passed by the parent.
 */

import { useState } from 'react';
import { Modal, Button, DatePicker, Switch, Input, toast } from '@/shared/components';
import type { ExamScheduleDay, DayKind } from '../../types';
import { useAddDay, useUpdateDay } from '../../api/examSchedule.queries';

export interface DayFormDialogProps {
  open: boolean;
  onClose: () => void;
  cycleId: string;
  applicantCategoryId: string;
  categoryNameAr: string;
  /** Cycle window — restricts the DatePicker. */
  cycleStartIso: string;
  cycleEndIso: string;
  /** Editing existing day; omit for create. */
  day?: ExamScheduleDay | null;
}

function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function DayFormDialog({
  open,
  onClose,
  cycleId,
  applicantCategoryId,
  categoryNameAr,
  cycleStartIso,
  cycleEndIso,
  day,
}: DayFormDialogProps): JSX.Element {
  const isEdit = Boolean(day);
  const [date, setDate] = useState<Date | null>(
    day ? new Date(`${day.date}T00:00:00.000Z`) : null,
  );
  const [kind, setKind] = useState<DayKind>(day?.kind ?? 'WORKING');
  const [note, setNote] = useState<string>(day?.note ?? '');
  const [error, setError] = useState<string | null>(null);

  const addMut = useAddDay();
  const updateMut = useUpdateDay();

  function reset(): void {
    setDate(null);
    setKind('WORKING');
    setNote('');
    setError(null);
  }

  function close(): void {
    reset();
    onClose();
  }

  function submit(): void {
    if (!date) {
      setError('اختر تاريخاً');
      return;
    }
    const iso = toIsoDate(date);
    if (iso < cycleStartIso || iso > cycleEndIso) {
      setError('التاريخ خارج نطاق الدورة');
      return;
    }
    setError(null);
    const trimmed = note.trim();
    if (isEdit && day) {
      updateMut.mutate(
        {
          dayId: day.id,
          cycleId,
          applicantCategoryId,
          patch: { date: iso, kind, note: trimmed.length > 0 ? trimmed : null },
        },
        {
          onSuccess: () => {
            toast('تم تعديل اليوم', 'success');
            close();
          },
        },
      );
    } else {
      addMut.mutate(
        {
          cycleId,
          applicantCategoryId,
          date: iso,
          kind,
          note: trimmed.length > 0 ? trimmed : null,
        },
        {
          onSuccess: () => {
            toast('تم إضافة اليوم', 'success');
            close();
          },
        },
      );
    }
  }

  const isPending = addMut.isPending || updateMut.isPending;

  return (
    <Modal
      open={open}
      onClose={close}
      title={isEdit ? `تعديل يوم — ${categoryNameAr}` : `إضافة يوم — ${categoryNameAr}`}
      size="sm"
      transparentBackdrop={false}
    >
      <div className="space-y-4 p-1">
        <DatePicker
          label="التاريخ"
          value={date}
          onChange={setDate}
        />
        <div className="flex items-center justify-between gap-3 rounded-md border border-border-subtle px-3 py-2">
          <div>
            <p className="text-sm font-medium text-ink-900">يوم عمل</p>
            <p className="text-2xs text-ink-500">
              عند الإيقاف يُعتبر اليوم عطلة (لا يُجدول فيه اختبار).
            </p>
          </div>
          <Switch
            checked={kind === 'WORKING'}
            onCheckedChange={(checked: boolean) => setKind(checked ? 'WORKING' : 'OFF')}
            aria-label="يوم عمل"
          />
        </div>
        <Input
          label="ملاحظة (اختياري)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="مثل: يوم اختبار اللياقة"
        />
        {error ? (
          <p className="text-2xs text-terra-600">{error}</p>
        ) : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={close}>
            إلغاء
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            isLoading={isPending}
          >
            {isEdit ? 'حفظ التعديل' : 'إضافة'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
