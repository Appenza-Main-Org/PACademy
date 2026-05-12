/**
 * CommitteeForm — shared create / edit form.
 *
 * Composed of five sections per the admin module spec:
 *   1. Basic information (name, academic year, status)
 *   2. Committee head (single-select, sourced from eligible officers)
 *   3. Assigned officers (multi-select; head must be one of them)
 *   4. Specializations / departments (multi-select)
 *   5. Capacity + dynamic rules (grade range, alphabet range, gender, applicant type)
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
import {
  useCommitteeEducationTypes,
  useCommitteeSpecializations,
  useEligibleOfficers,
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

const ARABIC_ALPHABET = [
  'أ', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر',
  'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف',
  'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي',
];

const CYCLE_OPTIONS = [
  { value: 'CYC-2026-M', label: 'دورة التقديم 2026' },
  { value: 'CYC-2025-M', label: 'دورة 2025 - الذكور' },
  { value: 'CYC-2025-F', label: 'دورة 2025 - الإناث' },
];

const schema = z
  .object({
    name: z.string().trim().min(2, 'أدخِل اسم اللجنة'),
    academicYearId: z.string().min(1, 'اختر العام الدراسي'),
    status: z.enum(['active', 'inactive']),
    headUserId: z.string().min(1, 'اختر رئيس اللجنة'),
    officerIds: z.array(z.string()).min(1, 'أضِف عضواً واحداً على الأقل'),
    specializationIds: z.array(z.string()).min(1, 'اختر تخصصاً واحداً على الأقل'),
    capacity: z
      .number({ invalid_type_error: 'أدخِل سعة صحيحة' })
      .int('السعة عدد صحيح')
      .positive('السعة عدد موجب'),
    cycleId: z.string().min(1, 'اختر الدورة المرتبطة'),
    rules: z.object({
      gradeFrom: z.number().nullable(),
      gradeTo: z.number().nullable(),
      alphabetFrom: z.string().nullable(),
      alphabetTo: z.string().nullable(),
      gender: z.enum(['male', 'female', 'any']),
      applicantType: z.string(),
    }),
  })
  .refine((d) => d.officerIds.includes(d.headUserId), {
    message: 'يجب أن يكون رئيس اللجنة ضمن الضباط المعيّنين',
    path: ['headUserId'],
  })
  .refine((d) => d.rules.gradeFrom == null || d.rules.gradeTo == null || d.rules.gradeFrom <= d.rules.gradeTo, {
    message: 'الحد الأدنى للدرجة أكبر من الحد الأقصى',
    path: ['rules', 'gradeFrom'],
  });

export interface CommitteeFormValues {
  name: string;
  academicYearId: string;
  status: CommitteeStatus;
  headUserId: string;
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
  const { data: officers = [] } = useEligibleOfficers();
  const { data: specializations = [] } = useCommitteeSpecializations();
  const { data: educationTypes = [] } = useCommitteeEducationTypes();

  const applicantTypeOptions = useMemo(
    () => [
      { value: 'any', label: 'الكل' },
      ...educationTypes.map((e) => ({ value: e.key, label: e.labelAr })),
    ],
    [educationTypes],
  );

  const [name, setName] = useState(initial?.name ?? '');
  const [academicYearId, setAcademicYearId] = useState<string>(
    initial?.academicYearId ?? ACADEMIC_YEARS[0].value,
  );
  const [status, setStatus] = useState<CommitteeStatus>(initial?.status ?? 'active');
  const [headUserId, setHeadUserId] = useState<string>(initial?.headUserId ?? '');
  const [officerIds, setOfficerIds] = useState<string[]>(initial?.officerIds ?? []);
  const [specializationIds, setSpecializationIds] = useState<string[]>(
    initial?.specializationIds ?? [],
  );
  const [capacity, setCapacity] = useState<number>(initial?.capacity ?? 600);
  const [cycleId, setCycleId] = useState<string>(initial?.linkedCycleId ?? CYCLE_OPTIONS[0].value);
  const [rules, setRules] = useState<CommitteeRules>(
    initial?.rules ?? {
      gradeFrom: 70,
      gradeTo: 100,
      alphabetFrom: 'أ',
      alphabetTo: 'ي',
      gender: 'any',
      applicantType: 'any',
    },
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  /* Auto-add a freshly-picked head into the officers multi-select so the
   * cross-field invariant passes without a second click. */
  useEffect(() => {
    if (headUserId && !officerIds.includes(headUserId)) {
      setOfficerIds((prev) => [...prev, headUserId]);
    }
  }, [headUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  const officerOptions = useMemo(
    () => officers.map((o) => ({ value: o.id, label: `${o.name} · ${o.unit}` })),
    [officers],
  );
  const headOptions = useMemo(
    () => officers.map((o) => ({ value: o.id, label: o.name })),
    [officers],
  );
  const specializationOptions = useMemo(
    () =>
      specializations
        .filter((s) => s.active)
        .map((s) => ({ value: s.id, label: s.nameAr, badge: s.code })),
    [specializations],
  );

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    const headUser = officers.find((o) => o.id === headUserId);
    const headName = headUser ? headUser.name : '';
    const payload: CommitteeFormValues = {
      name: name.trim(),
      academicYearId,
      status,
      headUserId,
      officerIds,
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
    /* `headName` is intentionally read so we keep the variable for the
     * eventual integration mapper that needs both id and label. */
    void headName;
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
              options={CYCLE_OPTIONS}
              error={errors.cycleId}
              containerClassName="md:col-span-2"
            />
          </div>
        </CardBody>
      </Card>

      {/* ── Section 2 — Committee head ─────────────────────────── */}
      <Card>
        <CardHeader
          title="رئيس اللجنة"
          subtitle="يُختار من قائمة الضباط ذوي صلاحية اللجنة"
        />
        <CardBody>
          <Combobox
            label="رئيس اللجنة"
            required
            value={headUserId}
            onChange={(v) => setHeadUserId(v ?? '')}
            options={headOptions}
            placeholder="اختر رئيس اللجنة"
            error={errors.headUserId}
          />
        </CardBody>
      </Card>

      {/* ── Section 3 — Assigned officers ──────────────────────── */}
      <Card>
        <CardHeader
          title="الضباط المعيّنون"
          subtitle="عضو واحد على الأقل. يجب أن يكون الرئيس ضمن القائمة."
        />
        <CardBody>
          <MultiSelect
            label="الضباط المعيّنون"
            required
            value={officerIds}
            onChange={setOfficerIds}
            options={officerOptions}
            placeholder="اختر الضباط من قائمة الموظفين بصلاحية اللجنة"
            error={errors.officerIds}
          />
        </CardBody>
      </Card>

      {/* ── Section 4 — Specializations ────────────────────────── */}
      <Card>
        <CardHeader
          title="التخصصات / الإدارات"
          subtitle="مصدر القائمة: فئات المتقدمين (/admin/categories)"
        />
        <CardBody>
          <MultiSelect
            label="التخصصات"
            required
            value={specializationIds}
            onChange={setSpecializationIds}
            options={specializationOptions}
            placeholder="اختر تخصصاً واحداً أو أكثر"
            helper="حدّد فئات المتقدمين التي ستستقبلها اللجنة"
            error={errors.specializationIds}
          />
        </CardBody>
      </Card>

      {/* ── Section 5 — Capacity + Rules ───────────────────────── */}
      <Card>
        <CardHeader
          title="السعة وشروط التوزيع"
          subtitle="نطاق الدرجات، الحروف الأبجدية، النوع، نوع المتقدم"
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

            <Select
              label="من حرف"
              value={rules.alphabetFrom ?? ''}
              onChange={(e) => setRule('alphabetFrom', e.target.value || null)}
              options={[{ value: '', label: '— لا يوجد —' }, ...ARABIC_ALPHABET.map((l) => ({ value: l, label: l }))]}
            />
            <Select
              label="إلى حرف"
              value={rules.alphabetTo ?? ''}
              onChange={(e) => setRule('alphabetTo', e.target.value || null)}
              options={[{ value: '', label: '— لا يوجد —' }, ...ARABIC_ALPHABET.map((l) => ({ value: l, label: l }))]}
            />

            <Select
              label="النوع"
              value={rules.gender ?? 'any'}
              onChange={(e) => setRule('gender', e.target.value as CommitteeRules['gender'])}
              options={[
                { value: 'any', label: 'كلاهما' },
                { value: 'male', label: 'ذكور' },
                { value: 'female', label: 'إناث' },
              ]}
            />
            <Select
              label="نوع المتقدم"
              value={rules.applicantType ?? 'any'}
              onChange={(e) => setRule('applicantType', e.target.value)}
              options={applicantTypeOptions}
              helper="مصدر القائمة: فئات المدارس (البيانات المرجعية)"
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
