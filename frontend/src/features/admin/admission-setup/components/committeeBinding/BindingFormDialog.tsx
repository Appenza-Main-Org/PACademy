/**
 * BindingFormDialog — create / edit a single (committee × day) cell.
 *
 * Mode-branched eligibility: the parent category's resolved
 * `gradingMode` decides whether the form renders the numeric percentage
 * pair (GRADES) or the two ACADEMIC_GRADES comboboxes with band hints
 * (TAGDIR). The discriminator is non-editable — admins can't pick
 * GRADES eligibility for a TAGDIR category and vice versa.
 */

import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import {
  Button,
  Checkbox,
  Combobox,
  Dialog,
  Field,
  Input,
  Textarea,
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
  CommitteeDayBinding,
  ExamScheduleDay,
} from '../../types';
import {
  useCreateBinding,
  useUpdateBinding,
} from '../../api/committeeBinding.queries';
import { num, date as fmtDate } from '@/shared/lib/format';
import type { GradingMode } from '@/features/lookups';

interface BindingFormDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  cycle: AdmissionCycle;
  categoryKey: ApplicantCategoryKey;
  categoryLabel: string;
  /** Eligibility mode resolved at the panel level — passed in so the
   *  dialog doesn't re-walk lookup metadata on every open. */
  mode: GradingMode;
  /** Pre-selected pair when the user clicked an empty `+` cell. */
  initialCommitteeId?: string | null;
  initialExamScheduleDayId?: string | null;
  /** When set, the dialog edits an existing row instead of creating one. */
  editing?: CommitteeDayBinding | null;
  rosterCommittees: Committee[];
  workingDays: ExamScheduleDay[];
}

const baseSchema = z.object({
  committeeId: z.string().min(1, 'اختر لجنة'),
  examScheduleDayId: z.string().min(1, 'اختر يومًا'),
  capacity: z
    .number({ invalid_type_error: 'أدخل سعة صحيحة' })
    .int('السعة يجب أن تكون عددًا صحيحًا')
    .positive('السعة يجب أن تكون أكبر من صفر'),
  isActive: z.boolean(),
  note: z.string(),
});

const gradesSchema = baseSchema.extend({
  gradeKind: z.literal('GRADES'),
  minPercentage: z
    .number({ invalid_type_error: 'أدخل قيمة بين 0 و 100' })
    .min(0, 'الدرجة المئوية يجب أن تكون بين 0 و 100')
    .max(100, 'الدرجة المئوية يجب أن تكون بين 0 و 100'),
  maxPercentage: z
    .number({ invalid_type_error: 'أدخل قيمة بين 0 و 100' })
    .min(0, 'الدرجة المئوية يجب أن تكون بين 0 و 100')
    .max(100, 'الدرجة المئوية يجب أن تكون بين 0 و 100'),
});

const tagdirSchema = baseSchema.extend({
  gradeKind: z.literal('TAGDIR'),
  minAcademicGradeId: z.string().min(1, 'اختر تقديرًا للحد الأدنى'),
  maxAcademicGradeId: z.string().min(1, 'اختر تقديرًا للحد الأقصى'),
});

const formSchema = z.discriminatedUnion('gradeKind', [gradesSchema, tagdirSchema]);

export function BindingFormDialog({
  open,
  onOpenChange,
  cycle,
  categoryKey,
  categoryLabel,
  mode,
  initialCommitteeId,
  initialExamScheduleDayId,
  editing,
  rosterCommittees,
  workingDays,
}: BindingFormDialogProps): JSX.Element {
  const isEdit = Boolean(editing);
  const createMutation = useCreateBinding();
  const updateMutation = useUpdateBinding();

  /* ── Local form state ───────────────────────────────────────────── */
  const [committeeId, setCommitteeId] = useState<string>('');
  const [examScheduleDayId, setExamScheduleDayId] = useState<string>('');
  const [capacityStr, setCapacityStr] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [note, setNote] = useState<string>('');

  /* GRADES branch */
  const [minPercentageStr, setMinPercentageStr] = useState<string>('');
  const [maxPercentageStr, setMaxPercentageStr] = useState<string>('');

  /* TAGDIR branch */
  const [minAcademicGradeId, setMinAcademicGradeId] = useState<string>('');
  const [maxAcademicGradeId, setMaxAcademicGradeId] = useState<string>('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  /* ── Reset on open ──────────────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCommitteeId(editing.committeeId);
      setExamScheduleDayId(editing.examScheduleDayId);
      setCapacityStr(String(editing.capacity));
      setIsActive(editing.isActive);
      setNote(editing.note ?? '');
      if (editing.eligibility.gradeKind === 'GRADES') {
        setMinPercentageStr(String(editing.eligibility.minPercentage));
        setMaxPercentageStr(String(editing.eligibility.maxPercentage));
        setMinAcademicGradeId('');
        setMaxAcademicGradeId('');
      } else {
        setMinAcademicGradeId(editing.eligibility.minAcademicGradeId);
        setMaxAcademicGradeId(editing.eligibility.maxAcademicGradeId);
        setMinPercentageStr('');
        setMaxPercentageStr('');
      }
    } else {
      setCommitteeId(initialCommitteeId ?? '');
      setExamScheduleDayId(initialExamScheduleDayId ?? '');
      setCapacityStr('');
      setIsActive(true);
      setNote('');
      if (mode === 'GRADES') {
        setMinPercentageStr('60');
        setMaxPercentageStr('100');
        setMinAcademicGradeId('');
        setMaxAcademicGradeId('');
      } else {
        setMinAcademicGradeId('AGR-03');
        setMaxAcademicGradeId('AGR-01');
        setMinPercentageStr('');
        setMaxPercentageStr('');
      }
    }
    setErrors({});
  }, [open, editing, initialCommitteeId, initialExamScheduleDayId, mode]);

  /* ── Combobox options ───────────────────────────────────────────── */
  const committeeOptions = useMemo<ComboboxOption[]>(
    () =>
      rosterCommittees.map((c) => ({
        value: c.id,
        label: `${c.name} — ${c.head}`,
        badge: c.capacity ? `سعة كلية ${num(c.capacity)}` : undefined,
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

  const pickedMinRange = useMemo(() => {
    const row = MOCK.lookups['academic-grades'].find((g) => g.code === minAcademicGradeId);
    return row ? readPercentageRange(row) : null;
  }, [minAcademicGradeId]);
  const pickedMaxRange = useMemo(() => {
    const row = MOCK.lookups['academic-grades'].find((g) => g.code === maxAcademicGradeId);
    return row ? readPercentageRange(row) : null;
  }, [maxAcademicGradeId]);

  /* ── Submit ─────────────────────────────────────────────────────── */
  const handleSubmit = async (): Promise<void> => {
    const draft = {
      gradeKind: mode,
      committeeId,
      examScheduleDayId,
      capacity: Number(capacityStr),
      isActive,
      note,
      ...(mode === 'GRADES'
        ? {
            minPercentage: Number(minPercentageStr),
            maxPercentage: Number(maxPercentageStr),
          }
        : {
            minAcademicGradeId,
            maxAcademicGradeId,
          }),
    };

    const parsed = formSchema.safeParse(draft);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.') || 'form';
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }
      setErrors(nextErrors);
      return;
    }

    const data = parsed.data;

    /* Local inverted-range guard so the user sees the error immediately
     * — service still validates server-side. */
    if (data.gradeKind === 'GRADES') {
      if (data.minPercentage > data.maxPercentage) {
        setErrors({
          maxPercentage:
            'الحد الأدنى يجب أن يكون أقل من أو يساوي الحد الأقصى',
        });
        return;
      }
    } else {
      const minRow = MOCK.lookups['academic-grades'].find(
        (g) => g.code === data.minAcademicGradeId,
      );
      const maxRow = MOCK.lookups['academic-grades'].find(
        (g) => g.code === data.maxAcademicGradeId,
      );
      const minRange = minRow ? readPercentageRange(minRow) : null;
      const maxRange = maxRow ? readPercentageRange(maxRow) : null;
      if (minRange && maxRange && minRange.min > maxRange.min) {
        setErrors({
          maxAcademicGradeId:
            'الحد الأدنى يجب أن يكون أقل من أو يساوي الحد الأقصى',
        });
        return;
      }
    }

    setErrors({});

    const eligibility: BindingEligibility =
      data.gradeKind === 'GRADES'
        ? {
            gradeKind: 'GRADES',
            minPercentage: data.minPercentage,
            maxPercentage: data.maxPercentage,
          }
        : {
            gradeKind: 'TAGDIR',
            minAcademicGradeId: data.minAcademicGradeId,
            maxAcademicGradeId: data.maxAcademicGradeId,
          };

    try {
      if (isEdit && editing) {
        await updateMutation.mutateAsync({
          id: editing.id,
          cycleId: cycle.id,
          applicantCategoryId: categoryKey,
          patch: {
            capacity: data.capacity,
            eligibility,
            isActive,
            note: note.length === 0 ? null : note,
          },
        });
        toast('تم تحديث الربط', 'success');
      } else {
        await createMutation.mutateAsync({
          cycleId: cycle.id,
          applicantCategoryId: categoryKey,
          committeeId: data.committeeId,
          examScheduleDayId: data.examScheduleDayId,
          capacity: data.capacity,
          eligibility,
          isActive,
          note: note.length === 0 ? null : note,
        });
        toast('تم إنشاء الربط', 'success');
      }
      onOpenChange(false);
    } catch {
      /* Toast surfaced via mutation onError surfaceError(). */
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'تعديل ربط لجنة بيوم اختبار' : 'ربط لجنة بيوم اختبار جديد'}
      description={`الفئة: ${categoryLabel} · النمط: ${mode === 'GRADES' ? 'درجات' : 'تقدير'}`}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            إلغاء
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={isPending}
            isLoading={isPending}
          >
            {isEdit ? 'حفظ التعديل' : 'إضافة الربط'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 py-1">
        <Combobox
          label="اللجنة"
          options={committeeOptions}
          value={committeeId}
          onChange={(next) => setCommitteeId(next ?? '')}
          disabled={isEdit}
          required
          error={errors.committeeId}
          placeholder="ابحث عن لجنة…"
        />
        <Combobox
          label="يوم الاختبار"
          options={dayOptions}
          value={examScheduleDayId}
          onChange={(next) => setExamScheduleDayId(next ?? '')}
          disabled={isEdit}
          required
          error={errors.examScheduleDayId}
          placeholder="ابحث عن يوم عمل…"
        />
        <Input
          type="number"
          inputMode="numeric"
          label="السعة لهذا اليوم"
          required
          min={1}
          step={1}
          value={capacityStr}
          onChange={(e) => setCapacityStr(e.target.value)}
          error={errors.capacity}
          helper="عدد المتقدمين الذين يمكن للجنة استيعابهم في هذا اليوم."
        />

        {mode === 'GRADES' ? (
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              inputMode="decimal"
              label="الحد الأدنى للنسبة المئوية"
              required
              min={0}
              max={100}
              step={0.01}
              value={minPercentageStr}
              onChange={(e) => setMinPercentageStr(e.target.value)}
              error={errors.minPercentage}
              trailingIcon={<span className="text-2xs text-ink-500">%</span>}
            />
            <Input
              type="number"
              inputMode="decimal"
              label="الحد الأقصى للنسبة المئوية"
              required
              min={0}
              max={100}
              step={0.01}
              value={maxPercentageStr}
              onChange={(e) => setMaxPercentageStr(e.target.value)}
              error={errors.maxPercentage}
              trailingIcon={<span className="text-2xs text-ink-500">%</span>}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Combobox
                label="الحد الأدنى للتقدير"
                options={academicGradeOptions}
                value={minAcademicGradeId}
                onChange={(next) => setMinAcademicGradeId(next ?? '')}
                required
                error={errors.minAcademicGradeId}
                placeholder="اختر تقديرًا…"
              />
              {pickedMinRange && (
                <p className="mt-1 text-2xs text-ink-500 font-numeric tnum">
                  النطاق: {num(pickedMinRange.min)}–{num(pickedMinRange.max)}%
                </p>
              )}
            </div>
            <div>
              <Combobox
                label="الحد الأقصى للتقدير"
                options={academicGradeOptions}
                value={maxAcademicGradeId}
                onChange={(next) => setMaxAcademicGradeId(next ?? '')}
                required
                error={errors.maxAcademicGradeId}
                placeholder="اختر تقديرًا…"
              />
              {pickedMaxRange && (
                <p className="mt-1 text-2xs text-ink-500 font-numeric tnum">
                  النطاق: {num(pickedMaxRange.min)}–{num(pickedMaxRange.max)}%
                </p>
              )}
            </div>
          </div>
        )}

        <Field label="ملاحظة (اختيارية)">
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ملاحظة داخلية يراها مسؤولو الإعداد فقط…"
          />
        </Field>

        <Checkbox
          checked={isActive}
          onCheckedChange={(next) => setIsActive(Boolean(next))}
          label="مفعّل"
          helper="عند التعطيل لا يتم توزيع متقدمين على هذه الخلية."
        />
      </div>
    </Dialog>
  );
}
