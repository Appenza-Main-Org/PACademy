/**
 * BulkEligibilityDialog — apply a uniform eligibility (and optional
 * capacity) to a selection of cells.
 *
 * Selection modes:
 *   • all       — every (committee × day) in the category
 *   • row       — one committee × all days
 *   • column    — all committees × one day
 *   • manual    — pick (committee, day) pairs from a multi-step list
 *
 * Overwrite flag respects existing rows; when false, the bulk call only
 * fills empty cells.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  Combobox,
  Dialog,
  Field,
  Input,
  toast,
} from '@/shared/components';
import type { ComboboxOption } from '@/shared/components';
import { MOCK } from '@/shared/mock-data';
import { readPercentageRange } from '@/features/lookups';
import type {
  AdmissionCycle,
  ApplicantCategoryKey,
  Committee,
} from '@/shared/types/domain';
import type {
  BindingEligibility,
  ExamScheduleDay,
} from '../../types';
import { useBulkSetEligibility } from '../../api/committeeBinding.queries';
import { num, date as fmtDate } from '@/shared/lib/format';
import type { GradingMode } from '@/features/lookups';

type SelectionKind = 'all' | 'row' | 'column';

interface BulkEligibilityDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  cycle: AdmissionCycle;
  categoryKey: ApplicantCategoryKey;
  categoryLabel: string;
  mode: GradingMode;
  rosterCommittees: Committee[];
  workingDays: ExamScheduleDay[];
}

export function BulkEligibilityDialog({
  open,
  onOpenChange,
  cycle,
  categoryKey,
  categoryLabel,
  mode,
  rosterCommittees,
  workingDays,
}: BulkEligibilityDialogProps): JSX.Element {
  const mutation = useBulkSetEligibility();

  const [selectionKind, setSelectionKind] = useState<SelectionKind>('all');
  const [pickedCommitteeId, setPickedCommitteeId] = useState<string>('');
  const [pickedDayId, setPickedDayId] = useState<string>('');
  const [overwrite, setOverwrite] = useState<boolean>(false);

  const [capacityStr, setCapacityStr] = useState<string>('');
  const [applyCapacity, setApplyCapacity] = useState<boolean>(false);

  const [minPercentageStr, setMinPercentageStr] = useState<string>('60');
  const [maxPercentageStr, setMaxPercentageStr] = useState<string>('100');
  const [minAcademicGradeId, setMinAcademicGradeId] = useState<string>('AGR-03');
  const [maxAcademicGradeId, setMaxAcademicGradeId] = useState<string>('AGR-01');

  useEffect(() => {
    if (!open) return;
    setSelectionKind('all');
    setPickedCommitteeId(rosterCommittees[0]?.id ?? '');
    setPickedDayId(workingDays[0]?.id ?? '');
    setOverwrite(false);
    setApplyCapacity(false);
    setCapacityStr('');
    if (mode === 'GRADES') {
      setMinPercentageStr('60');
      setMaxPercentageStr('100');
    } else {
      setMinAcademicGradeId('AGR-03');
      setMaxAcademicGradeId('AGR-01');
    }
  }, [open, mode, rosterCommittees, workingDays]);

  const committeeOptions = useMemo<ComboboxOption[]>(
    () =>
      rosterCommittees.map((c) => ({
        value: c.id,
        label: `${c.name} — ${c.head}`,
        keywords: c.head,
      })),
    [rosterCommittees],
  );

  const dayOptions = useMemo<ComboboxOption[]>(
    () =>
      workingDays.map((d) => ({
        value: d.id,
        label: fmtDate(d.date, 'full'),
        keywords: d.date,
      })),
    [workingDays],
  );

  const academicGradeOptions = useMemo<ComboboxOption[]>(() => {
    return MOCK.lookups['academic-grades']
      .filter((g) => g.isActive)
      .slice()
      .sort((a, b) => {
        const ra = readPercentageRange(a)?.min ?? 0;
        const rb = readPercentageRange(b)?.min ?? 0;
        return rb - ra;
      })
      .map<ComboboxOption>((g) => {
        const range = readPercentageRange(g);
        return {
          value: g.code,
          label: g.name,
          badge: range ? `${num(range.min)}–${num(range.max)}%` : undefined,
        };
      });
  }, []);

  const handleApply = async (): Promise<void> => {
    const eligibility: BindingEligibility =
      mode === 'GRADES'
        ? {
            gradeKind: 'GRADES',
            minPercentage: Number(minPercentageStr),
            maxPercentage: Number(maxPercentageStr),
          }
        : {
            gradeKind: 'TAGDIR',
            minAcademicGradeId,
            maxAcademicGradeId,
          };

    let targets: Array<{ committeeId: string; examScheduleDayId: string }> = [];
    if (selectionKind === 'all') {
      targets = [{ committeeId: '*', examScheduleDayId: '*' }];
    } else if (selectionKind === 'row') {
      if (!pickedCommitteeId) {
        toast('اختر لجنة أولاً', 'warning');
        return;
      }
      targets = [{ committeeId: pickedCommitteeId, examScheduleDayId: '*' }];
    } else {
      if (!pickedDayId) {
        toast('اختر يومًا أولاً', 'warning');
        return;
      }
      targets = [{ committeeId: '*', examScheduleDayId: pickedDayId }];
    }

    const capacityNum = applyCapacity ? Number(capacityStr) : undefined;
    if (applyCapacity && (!Number.isFinite(capacityNum!) || (capacityNum ?? 0) <= 0)) {
      toast('السعة يجب أن تكون أكبر من صفر', 'danger');
      return;
    }

    try {
      const res = await mutation.mutateAsync({
        cycleId: cycle.id,
        applicantCategoryId: categoryKey,
        targets,
        eligibility,
        ...(capacityNum !== undefined ? { capacity: capacityNum } : {}),
        overwrite,
      });
      toast(
        `تم التحديث: ${num(res.updated)} · إنشاء: ${num(res.created)} · تجاوز: ${num(res.skipped)}`,
        'success',
      );
      onOpenChange(false);
    } catch {
      /* Toast surfaced by surfaceError(). */
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="تطبيق أهلية موحدة"
      description={`الفئة: ${categoryLabel} · النمط: ${mode === 'GRADES' ? 'درجات' : 'تقدير'}`}
      size="md"
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
            تطبيق
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 py-1">
        <Field label="نطاق التطبيق">
          <div className="flex flex-col gap-1.5">
            <RadioRow
              checked={selectionKind === 'all'}
              onSelect={() => setSelectionKind('all')}
              label="كل اللجان × كل الأيام"
            />
            <RadioRow
              checked={selectionKind === 'row'}
              onSelect={() => setSelectionKind('row')}
              label="لجنة واحدة × كل أيامها"
            />
            <RadioRow
              checked={selectionKind === 'column'}
              onSelect={() => setSelectionKind('column')}
              label="يوم واحد × كل اللجان"
            />
          </div>
        </Field>

        {selectionKind === 'row' && (
          <Combobox
            label="اللجنة"
            options={committeeOptions}
            value={pickedCommitteeId}
            onChange={(next) => setPickedCommitteeId(next ?? '')}
            required
          />
        )}
        {selectionKind === 'column' && (
          <Combobox
            label="اليوم"
            options={dayOptions}
            value={pickedDayId}
            onChange={(next) => setPickedDayId(next ?? '')}
            required
          />
        )}

        {mode === 'GRADES' ? (
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              inputMode="decimal"
              label="الحد الأدنى للنسبة المئوية"
              min={0}
              max={100}
              step={0.01}
              value={minPercentageStr}
              onChange={(e) => setMinPercentageStr(e.target.value)}
              trailingIcon={<span className="text-2xs text-ink-500">%</span>}
            />
            <Input
              type="number"
              inputMode="decimal"
              label="الحد الأقصى للنسبة المئوية"
              min={0}
              max={100}
              step={0.01}
              value={maxPercentageStr}
              onChange={(e) => setMaxPercentageStr(e.target.value)}
              trailingIcon={<span className="text-2xs text-ink-500">%</span>}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Combobox
              label="الحد الأدنى للتقدير"
              options={academicGradeOptions}
              value={minAcademicGradeId}
              onChange={(next) => setMinAcademicGradeId(next ?? '')}
              required
            />
            <Combobox
              label="الحد الأقصى للتقدير"
              options={academicGradeOptions}
              value={maxAcademicGradeId}
              onChange={(next) => setMaxAcademicGradeId(next ?? '')}
              required
            />
          </div>
        )}

        <div className="flex flex-col gap-2 rounded-md border border-border-subtle bg-surface-default p-3">
          <Checkbox
            checked={applyCapacity}
            onCheckedChange={(next) => setApplyCapacity(Boolean(next))}
            label="تطبيق سعة موحدة"
          />
          {applyCapacity && (
            <Input
              type="number"
              inputMode="numeric"
              label="السعة لكل خلية"
              min={1}
              step={1}
              value={capacityStr}
              onChange={(e) => setCapacityStr(e.target.value)}
            />
          )}
        </div>

        <Checkbox
          checked={overwrite}
          onCheckedChange={(next) => setOverwrite(Boolean(next))}
          label="استبدال الروابط الموجودة"
          helper="عند الإلغاء يتم ملء الخلايا الفارغة فقط."
        />
      </div>
    </Dialog>
  );
}

function RadioRow({
  checked,
  onSelect,
  label,
}: {
  checked: boolean;
  onSelect: () => void;
  label: string;
}): JSX.Element {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-2xs text-ink-700">
      <input
        type="radio"
        name="bulk-selection"
        checked={checked}
        onChange={onSelect}
        className="h-3.5 w-3.5 accent-current"
        style={{ color: 'var(--accent-500)' }}
      />
      <span>{label}</span>
    </label>
  );
}
