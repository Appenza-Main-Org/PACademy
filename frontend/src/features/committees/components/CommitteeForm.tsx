/**
 * CommitteeForm — shared create / edit form.
 *
 * Composed of three sections per the admin module spec:
 *   1. Basic information (name, academic year, status, cycle)
 *   2. فئات المتقدمين (multi-select)
 *   3. Capacity + dynamic rules (numeric grade range, تقدير range)
 *
 * Committee head (رئيس اللجنة) and assigned officers (الضباط المعيّنون)
 * are no longer captured in the form — they're set elsewhere in the
 * admin workflow. When editing an existing committee, those fields
 * round-trip from `initial.headUserId` / `initial.officerIds` so the
 * record's data isn't lost on save.
 *
 * Validates with zod and surfaces field-level errors. Submitting calls
 * the supplied `onSubmit` with the typed payload.
 */

import { useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { z } from 'zod';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Combobox,
  Input,
  MultiSelect,
  Select,
} from '@/shared/components';
import type { Committee, CommitteeRules, CommitteeStatus } from '@/shared/types/domain';
import { readPercentageRange, useLookup } from '@/features/lookups';
import { useCycles } from '@/features/admin/api/cycles.queries';
import { num } from '@/shared/lib/format';
import {
  useCommitteeSpecializations,
} from '../api/committee.queries';

const STATUS_OPTIONS: { value: CommitteeStatus; label: string }[] = [
  { value: 'active', label: 'مفعّلة' },
  { value: 'inactive', label: 'موقوفة' },
];

const ACADEMIC_YEARS = [
  { value: '2026-2027', label: 'العام الدراسي 2026 / 2027' },
  { value: '2025-2026', label: 'العام الدراسي 2025 / 2026' },
  { value: '2024-2025', label: 'العام الدراسي 2024 / 2025' },
];

const schema = z
  .object({
    name: z.string().trim().min(2, 'أدخِل اسم اللجنة'),
    academicYearId: z.string().min(1, 'اختر العام الدراسي'),
    status: z.enum(['active', 'inactive']),
    specializationIds: z.array(z.string()).min(1, 'اختر فئة واحدة على الأقل'),
    capacity: z
      .number({ invalid_type_error: 'أدخِل سعة صحيحة' })
      .int('السعة عدد صحيح')
      .positive('السعة عدد موجب'),
    cycleId: z.string().min(1, 'اختر الدورة المرتبطة'),
    rules: z.object({
      gradeFrom: z.number().nullable(),
      gradeTo: z.number().nullable(),
      academicGradeFromId: z.string().nullable(),
      academicGradeToId: z.string().nullable(),
    }),
  })
  .refine((d) => d.rules.gradeFrom == null || d.rules.gradeTo == null || d.rules.gradeFrom <= d.rules.gradeTo, {
    message: 'الحد الأدنى للدرجة أكبر من الحد الأقصى',
    path: ['rules', 'gradeFrom'],
  });

export interface CommitteeFormValues {
  name: string;
  academicYearId: string;
  status: CommitteeStatus;
  /** Pass-through from `initial.headUserId` on edit; `undefined` on create. */
  headUserId?: string;
  /** Pass-through from `initial.officerIds` on edit; `[]` on create. */
  officerIds: string[];
  specializationIds: string[];
  capacity: number;
  cycleId: string;
  rules: CommitteeRules;
}

interface CommitteeFormProps {
  initial?: Committee;
  submittingLabel?: string;
  isSubmitting?: boolean;
  onSubmit: (values: CommitteeFormValues) => void;
  onCancel?: () => void;
}

export function CommitteeForm({
  initial,
  submittingLabel = 'حفظ',
  isSubmitting,
  onSubmit,
  onCancel,
}: CommitteeFormProps): JSX.Element {
  const { data: specializations = [] } = useCommitteeSpecializations();
  const { data: cycles = [] } = useCycles();
  const academicGradesQuery = useLookup('academic-grades');

  /* Academic-grade picker options, sourced from
   * the admin lookup at /admin/lookups/academic-grades. Ordered by band floor descending
   * (امتياز → مقبول) so the picker reads top-down like a report card.
   * Each option's band hint is rendered as a Combobox badge so admins
   * can verify e.g. "جيد" maps to "65–74%" at pick time. */
  const academicGradeOptions = useMemo(
    () =>
      (academicGradesQuery.data ?? [])
        .filter((g) => g.isActive)
        .slice()
        .sort((a, b) => {
          const ra = readPercentageRange(a)?.min ?? 0;
          const rb = readPercentageRange(b)?.min ?? 0;
          return rb - ra;
        })
        .map((g) => {
          const r = readPercentageRange(g);
          return {
            value: g.code,
            label: g.name,
            badge: r ? `${num(r.min)}–${num(r.max)}%` : undefined,
          };
        }),
    [academicGradesQuery.data],
  );

  const [name, setName] = useState(initial?.name ?? '');
  const [academicYearId, setAcademicYearId] = useState<string>(
    initial?.academicYearId ?? ACADEMIC_YEARS[0]!.value,
  );
  const [status, setStatus] = useState<CommitteeStatus>(initial?.status ?? 'active');
  const [specializationIds, setSpecializationIds] = useState<string[]>(
    initial?.specializationIds ?? [],
  );
  const [capacity, setCapacity] = useState<number>(initial?.capacity ?? 600);
  const [cycleId, setCycleId] = useState<string>(initial?.linkedCycleId ?? '');
  const [rules, setRules] = useState<CommitteeRules>(
    initial?.rules ?? {
      gradeFrom: 70,
      gradeTo: 100,
      academicGradeFromId: null,
      academicGradeToId: null,
    },
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (cycleId || cycles.length === 0) return;
    setCycleId(cycles[0]!.id);
  }, [cycleId, cycles]);

  const specializationOptions = useMemo(
    () =>
      specializations
        .filter((s) => s.active)
        .map((s) => ({ value: s.id, label: s.nameAr, badge: s.code })),
    [specializations],
  );

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    const payload: CommitteeFormValues = {
      name: name.trim(),
      academicYearId,
      status,
      /* Head + officers are no longer surfaced in the form. Round-trip
       * whatever the existing committee had so edits don't wipe them. */
      ...(initial?.headUserId !== undefined ? { headUserId: initial.headUserId } : {}),
      officerIds: initial?.officerIds ?? [],
      specializationIds,
      capacity,
      cycleId,
      rules,
    };
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      const map: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        map[issue.path.join('.')] = issue.message;
      }
      setErrors(map);
      return;
    }
    setErrors({});
    onSubmit({ ...payload, name: parsed.data.name });
  };

  const setRule = <K extends keyof CommitteeRules>(key: K, value: CommitteeRules[K]): void => {
    setRules((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      {/* ── Section 1 — Basic information ──────────────────────── */}
      <Card>
        <CardHeader title="المعلومات الأساسية" subtitle="اسم اللجنة، العام الدراسي، الحالة" />
        <CardBody>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="اسم اللجنة"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
              containerClassName="md:col-span-2"
            />
            <Select
              label="العام الدراسي"
              required
              value={academicYearId}
              onChange={(e) => setAcademicYearId(e.target.value)}
              options={ACADEMIC_YEARS}
              error={errors.academicYearId}
            />
            <Select
              label="الحالة"
              value={status}
              onChange={(e) => setStatus(e.target.value as CommitteeStatus)}
              options={STATUS_OPTIONS}
            />
            <Select
              label="الدورة المرتبطة"
              required
              value={cycleId}
              onChange={(e) => setCycleId(e.target.value)}
              options={cycles.map((cycle) => ({ value: cycle.id, label: cycle.nameAr }))}
              error={errors.cycleId}
              containerClassName="md:col-span-2"
            />
          </div>
        </CardBody>
      </Card>

      {/* ── Section 2 — فئات المتقدمين ──────────────────────────── */}
      <Card>
        <CardHeader
          title="فئات المتقدمين"
          subtitle="مصدر القائمة: فئات المتقدمين (/admin/categories)"
        />
        <CardBody>
          <MultiSelect
            label="فئات المتقدمين"
            required
            value={specializationIds}
            onChange={setSpecializationIds}
            options={specializationOptions}
            placeholder="اختر فئة واحدة أو أكثر"
            helper="حدّد فئات المتقدمين التي ستستقبلها اللجنة"
            error={errors.specializationIds}
          />
        </CardBody>
      </Card>

      {/* ── Section 3 — Capacity + Rules ───────────────────────── */}
      <Card>
        <CardHeader
          title="السعة وشروط التوزيع"
          subtitle="نطاق الدرجات الرقمية، نطاق التقدير"
        />
        <CardBody>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="السعة الإجمالية للجنة"
              type="number"
              min={1}
              required
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              error={errors.capacity}
            />
            <div className="hidden md:block" />

            <Input
              label="الحد الأدنى للدرجة"
              type="number"
              min={0}
              max={100}
              value={rules.gradeFrom ?? ''}
              onChange={(e) => setRule('gradeFrom', e.target.value === '' ? null : Number(e.target.value))}
              helper="٪"
              error={errors['rules.gradeFrom']}
            />
            <Input
              label="الحد الأقصى للدرجة"
              type="number"
              min={0}
              max={100}
              value={rules.gradeTo ?? ''}
              onChange={(e) => setRule('gradeTo', e.target.value === '' ? null : Number(e.target.value))}
              helper="٪"
            />

            <Combobox
              label="الحد الأدنى للتقدير"
              value={rules.academicGradeFromId ?? ''}
              onChange={(v) => setRule('academicGradeFromId', v || null)}
              options={academicGradeOptions}
              placeholder="اختر تقديراً…"
              helper="مصدر القائمة: التقدير الأكاديمي (/admin/lookups/academic-grades)"
            />
            <Combobox
              label="الحد الأقصى للتقدير"
              value={rules.academicGradeToId ?? ''}
              onChange={(v) => setRule('academicGradeToId', v || null)}
              options={academicGradeOptions}
              placeholder="اختر تقديراً…"
            />
          </div>
        </CardBody>
      </Card>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            إلغاء
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isSubmitting}
          leadingIcon={<Save size={14} strokeWidth={1.75} />}
        >
          {submittingLabel}
        </Button>
      </div>
    </form>
  );
}
