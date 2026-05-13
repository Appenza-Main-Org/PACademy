/**
 * CopyRowDialog / CopyColumnDialog — duplicate every binding from one
 * row (committee) or column (day) into another within the same (cycle,
 * category). Overwrite flag respects existing cells.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  Combobox,
  Dialog,
  toast,
} from '@/shared/components';
import type { ComboboxOption } from '@/shared/components';
import type {
  AdmissionCycle,
  ApplicantCategoryKey,
  Committee,
} from '@/shared/types/domain';
import type { ExamScheduleDay } from '../../types';
import {
  useCopyColumn,
  useCopyRow,
} from '../../api/committeeBinding.queries';
import { num, date as fmtDate } from '@/shared/lib/format';

interface BaseProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  cycle: AdmissionCycle;
  categoryKey: ApplicantCategoryKey;
  categoryLabel: string;
}

interface CopyRowDialogProps extends BaseProps {
  initialSourceCommitteeId: string | null;
  rosterCommittees: Committee[];
}

export function CopyRowDialog({
  open,
  onOpenChange,
  cycle,
  categoryKey,
  categoryLabel,
  initialSourceCommitteeId,
  rosterCommittees,
}: CopyRowDialogProps): JSX.Element {
  const mutation = useCopyRow();

  const [sourceId, setSourceId] = useState<string>('');
  const [targetId, setTargetId] = useState<string>('');
  const [overwrite, setOverwrite] = useState<boolean>(false);

  useEffect(() => {
    if (!open) return;
    setSourceId(initialSourceCommitteeId ?? rosterCommittees[0]?.id ?? '');
    const firstOther = rosterCommittees.find(
      (c) => c.id !== (initialSourceCommitteeId ?? rosterCommittees[0]?.id),
    );
    setTargetId(firstOther?.id ?? '');
    setOverwrite(false);
  }, [open, initialSourceCommitteeId, rosterCommittees]);

  const options = useMemo<ComboboxOption[]>(
    () =>
      rosterCommittees.map((c) => ({
        value: c.id,
        label: `${c.name} — ${c.head}`,
        keywords: c.head,
      })),
    [rosterCommittees],
  );

  const handleApply = async (): Promise<void> => {
    if (!sourceId || !targetId) {
      toast('اختر اللجنتين المصدر والهدف', 'warning');
      return;
    }
    if (sourceId === targetId) {
      toast('لا يمكن النسخ إلى نفس اللجنة', 'warning');
      return;
    }
    try {
      const res = await mutation.mutateAsync({
        cycleId: cycle.id,
        applicantCategoryId: categoryKey,
        sourceCommitteeId: sourceId,
        targetCommitteeId: targetId,
        overwrite,
      });
      toast(
        `تم النسخ: إنشاء ${num(res.created)} · تحديث ${num(res.updated)} · تجاوز ${num(res.skipped)}`,
        'success',
      );
      onOpenChange(false);
    } catch {
      /* surfaceError handles toast */
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="نسخ صف لجنة"
      description={`الفئة: ${categoryLabel} — يتم نسخ كل روابط اللجنة المصدر إلى الهدف.`}
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            إلغاء
          </Button>
          <Button
            variant="primary"
            onClick={handleApply}
            disabled={mutation.isPending}
            isLoading={mutation.isPending}
          >
            نسخ
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3 py-1">
        <Combobox
          label="اللجنة المصدر"
          options={options}
          value={sourceId}
          onChange={(next) => setSourceId(next ?? '')}
          required
        />
        <Combobox
          label="اللجنة الهدف"
          options={options}
          value={targetId}
          onChange={(next) => setTargetId(next ?? '')}
          required
        />
        <Checkbox
          checked={overwrite}
          onCheckedChange={(next) => setOverwrite(Boolean(next))}
          label="استبدال الروابط الموجودة على الصف الهدف"
        />
      </div>
    </Dialog>
  );
}

interface CopyColumnDialogProps extends BaseProps {
  initialSourceDayId: string | null;
  workingDays: ExamScheduleDay[];
}

export function CopyColumnDialog({
  open,
  onOpenChange,
  cycle,
  categoryKey,
  categoryLabel,
  initialSourceDayId,
  workingDays,
}: CopyColumnDialogProps): JSX.Element {
  const mutation = useCopyColumn();

  const [sourceId, setSourceId] = useState<string>('');
  const [targetId, setTargetId] = useState<string>('');
  const [overwrite, setOverwrite] = useState<boolean>(false);

  useEffect(() => {
    if (!open) return;
    setSourceId(initialSourceDayId ?? workingDays[0]?.id ?? '');
    const firstOther = workingDays.find(
      (d) => d.id !== (initialSourceDayId ?? workingDays[0]?.id),
    );
    setTargetId(firstOther?.id ?? '');
    setOverwrite(false);
  }, [open, initialSourceDayId, workingDays]);

  const options = useMemo<ComboboxOption[]>(
    () =>
      workingDays.map((d) => ({
        value: d.id,
        label: fmtDate(d.date, 'full'),
        keywords: d.date,
      })),
    [workingDays],
  );

  const handleApply = async (): Promise<void> => {
    if (!sourceId || !targetId) {
      toast('اختر اليومين المصدر والهدف', 'warning');
      return;
    }
    if (sourceId === targetId) {
      toast('لا يمكن النسخ إلى نفس اليوم', 'warning');
      return;
    }
    try {
      const res = await mutation.mutateAsync({
        cycleId: cycle.id,
        applicantCategoryId: categoryKey,
        sourceDayId: sourceId,
        targetDayId: targetId,
        overwrite,
      });
      toast(
        `تم النسخ: إنشاء ${num(res.created)} · تحديث ${num(res.updated)} · تجاوز ${num(res.skipped)}`,
        'success',
      );
      onOpenChange(false);
    } catch {
      /* surfaceError handles toast */
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="نسخ عمود يوم"
      description={`الفئة: ${categoryLabel} — يتم نسخ كل روابط اليوم المصدر إلى الهدف.`}
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            إلغاء
          </Button>
          <Button
            variant="primary"
            onClick={handleApply}
            disabled={mutation.isPending}
            isLoading={mutation.isPending}
          >
            نسخ
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3 py-1">
        <Combobox
          label="اليوم المصدر"
          options={options}
          value={sourceId}
          onChange={(next) => setSourceId(next ?? '')}
          required
        />
        <Combobox
          label="اليوم الهدف"
          options={options}
          value={targetId}
          onChange={(next) => setTargetId(next ?? '')}
          required
        />
        <Checkbox
          checked={overwrite}
          onCheckedChange={(next) => setOverwrite(Boolean(next))}
          label="استبدال الروابط الموجودة على العمود الهدف"
        />
      </div>
    </Dialog>
  );
}
