/**
 * LookupRowDrawer — create/edit drawer for a single lookup row.
 *
 * Renders the three base inputs (code, name, isActive) for every key, plus
 * the per-key field set. Codes are auto-suggested from the per-lookup
 * prefix (admin can override). RHF + zod handles validation.
 *
 * Per-key form fields read register/control/watch from `useFormContext`
 * so the boundary stays free of the discriminated-union generic, which
 * RHF v7's strict generics resist.
 */

import { useEffect, useMemo } from 'react';
import {
  Controller,
  FormProvider,
  useForm,
  useFormContext,
  type FieldValues,
} from 'react-hook-form';
import { z } from 'zod';
import {
  Button,
  Drawer,
  Input,
  MultiSelect,
  Select,
  Switch,
  Textarea,
  type ComboboxGroup,
  type ComboboxOption,
} from '@/shared/components';
import { Check } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { zodResolver } from '@/shared/lib/zod-resolver';
import { MOCK } from '@/shared/mock-data';
import {
  LOOKUP_META,
  type ApplicantCategoryGenderScope,
  type ApplicantCategoryType,
  type FacultyRow,
  type LookupKey,
  type LookupRow,
  type SpecializationRow,
} from '../types';

interface LookupRowDrawerProps<K extends LookupKey> {
  open: boolean;
  lookupKey: K;
  editing: LookupRow<K> | null;
  onClose: () => void;
  onSubmit: (values: LookupRow<K>) => void;
  submitting: boolean;
}

const baseSchema = z.object({
  code: z.string().min(1, 'الكود مطلوب').max(40),
  name: z.string().min(2, 'الاسم لا يقل عن حرفين').max(120, 'الاسم طويل جدًا'),
  isActive: z.boolean(),
});

export function LookupRowDrawer<K extends LookupKey>({
  open,
  lookupKey,
  editing,
  onClose,
  onSubmit,
  submitting,
}: LookupRowDrawerProps<K>): JSX.Element {
  const meta = LOOKUP_META[lookupKey];
  const isEdit = editing !== null;

  const defaults = useMemo<FieldValues>(
    () => (editing ? { ...(editing as object) } : blankRow(lookupKey)) as FieldValues,
    [editing, lookupKey],
  );

  const methods = useForm<FieldValues>({
    resolver: zodResolver(baseSchema as unknown as z.ZodType<FieldValues>),
    defaultValues: defaults,
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = methods;

  useEffect(() => { reset(defaults); }, [defaults, reset]);

  const submit = handleSubmit((values) => {
    const next = { ...values } as Record<string, unknown>;
    if (!isEdit && (!next.code || String(next.code).trim() === '')) {
      next.code = nextCodeFor(lookupKey);
    }
    onSubmit(next as unknown as LookupRow<K>);
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="md"
      title={isEdit ? `تعديل · ${meta.label}` : `إضافة · ${meta.label}`}
    >
      <FormProvider {...methods}>
        <form onSubmit={submit} className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="الاسم بالعربية"
                required
                containerClassName="col-span-2"
                error={(errors.name as { message?: string } | undefined)?.message}
                {...register('name')}
              />

              <KeyFields lookupKey={lookupKey} />

              <div className="col-span-2">
                <Controller
                  control={methods.control}
                  name="isActive"
                  render={({ field }) => (
                    <Switch
                      checked={Boolean(field.value)}
                      onCheckedChange={field.onChange}
                      label="نشط"
                    />
                  )}
                />
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border-subtle px-5 py-3">
            <Button type="button" variant="ghost" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              {isEdit ? 'حفظ' : 'إضافة'}
            </Button>
          </div>
        </form>
      </FormProvider>
    </Drawer>
  );
}

/* ─── Per-key form fields (read via context) ─────────────────────────── */

function KeyFields({ lookupKey }: { lookupKey: LookupKey }): JSX.Element {
  const { register, control, watch } = useFormContext();
  const codeOfSelf = watch('code') as string | undefined;

  switch (lookupKey) {
    case 'relationships':
      return (
        <>
          <Controller
            control={control}
            name="parentCode"
            render={({ field }) => (
              <ParentCodeSelect lookupKey="relationships" value={field.value as string | null} onChange={field.onChange} ignoreCode={codeOfSelf} />
            )}
          />
          <Select
            label="الفرع"
            options={[
              { value: 'paternal', label: 'من جهة الأب' },
              { value: 'maternal', label: 'من جهة الأم' },
              { value: 'self',     label: 'مباشر' },
              { value: 'spouse',   label: 'الزوج/الزوجة' },
              { value: 'none',     label: '—' },
            ]}
            {...register('branch')}
          />
          <Select
            label="الجنس"
            options={[
              { value: 'male',   label: 'ذكر' },
              { value: 'female', label: 'أنثى' },
              { value: 'any',    label: 'الكل' },
            ]}
            {...register('gender')}
          />
          <Input label="الدرجة (1–4)" type="number" min={1} max={4} {...register('degree', { valueAsNumber: true })} />
        </>
      );
    case 'relationship-degree-tiers':
      return (
        <>
          <Input label="وصف الدرجة" containerClassName="col-span-2" {...register('degreeRange')} />
          <Input label="أقصى درجة" type="number" min={1} max={4} {...register('maxDegree', { valueAsNumber: true })} />
        </>
      );
    case 'tests':
      return (
        <>
          <Select
            label="نوع الاختبار"
            options={[
              { value: 'physical',  label: 'رياضي' },
              { value: 'medical',   label: 'طبي' },
              { value: 'interview', label: 'مقابلة' },
              { value: 'written',   label: 'كتابي' },
              { value: 'psych',     label: 'نفسي' },
            ]}
            {...register('kind')}
          />
          <Input label="ترتيب التنفيذ" type="number" {...register('order', { valueAsNumber: true })} />
          <Controller
            control={control}
            name="required"
            render={({ field }) => (
              <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} label="إلزامي" />
            )}
          />
        </>
      );
    case 'test-results':
      return (
        <>
          <Select
            label="النتيجة"
            options={[
              { value: 'pass',      label: 'نجاح' },
              { value: 'fail',      label: 'رسوب' },
              { value: 'defer',     label: 'تأجيل' },
              { value: 'withdrawn', label: 'انسحاب' },
            ]}
            {...register('outcome')}
          />
          <Select
            label="نغمة العرض"
            options={[
              { value: 'success', label: 'نجاح (أخضر)' },
              { value: 'warning', label: 'تحذير (ذهبي)' },
              { value: 'danger',  label: 'خطر (أحمر)' },
              { value: 'info',    label: 'إعلامية (أزرق)' },
              { value: 'neutral', label: 'محايد' },
            ]}
            {...register('tone')}
          />
        </>
      );
    case 'committees':
      return (
        <Controller
          control={control}
          name="applicantCategoryId"
          rules={{ required: true }}
          render={({ field, fieldState }) => (
            <ForeignKeySelect
              lookupKey="applicant-categories"
              label="الفئة"
              required
              value={(field.value as string | undefined) ?? ''}
              onChange={field.onChange}
              error={fieldState.error ? 'اختر فئة' : undefined}
              containerClassName="col-span-2"
            />
          )}
        />
      );
    case 'specializations':
      return (
        <Controller
          control={control}
          name="facultyCode"
          rules={{ required: true }}
          render={({ field }) => (
            <ForeignKeySelect
              lookupKey="faculties"
              label="الكلية"
              value={field.value as string}
              onChange={field.onChange}
            />
          )}
        />
      );
    case 'submission-types':
      /* The only configurable knob is `metadata.gradingMode` — drives the
       * downstream درجات/تقدير branch wherever applicant-categories points
       * here. RHF dot-paths read straight into the metadata bag. */
      return (
        <Select
          label="طريقة احتساب النتيجة"
          options={[
            { value: 'GRADES', label: 'درجات' },
            { value: 'TAGDIR', label: 'تقدير' },
          ]}
          {...register('metadata.gradingMode')}
        />
      );
    case 'applicant-categories':
      return <ApplicantCategoryFields />;
    case 'nationalities-countries':
      return (
        <>
          <Input label="رمز ISO (2 أحرف)" {...register('iso2')} />
          <Controller
            control={control}
            name="isArab"
            render={({ field }) => (
              <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} label="دولة عربية" />
            )}
          />
        </>
      );
    case 'governorates':
      return (
        <Select
          label="الإقليم"
          containerClassName="col-span-2"
          options={[
            { value: 'القاهرة الكبرى', label: 'القاهرة الكبرى' },
            { value: 'الوجه البحري',   label: 'الوجه البحري' },
            { value: 'الوجه القبلي',   label: 'الوجه القبلي' },
            { value: 'القناة',         label: 'القناة' },
            { value: 'الحدود',         label: 'الحدود' },
          ]}
          {...register('region')}
        />
      );
    case 'police-stations':
      return (
        <>
          <Controller
            control={control}
            name="governorateCode"
            render={({ field }) => (
              <ForeignKeySelect lookupKey="governorates" label="المحافظة" value={field.value as string} onChange={field.onChange} />
            )}
          />
          <Select
            label="النوع"
            options={[
              { value: 'قسم',   label: 'قسم' },
              { value: 'مركز',  label: 'مركز' },
              { value: 'بندر',  label: 'بندر' },
            ]}
            {...register('kind')}
          />
        </>
      );
    case 'jobs':
      return (
        <Controller
          control={control}
          name="parentCode"
          render={({ field }) => (
            <ParentCodeSelect lookupKey="jobs" value={field.value as string | null} onChange={field.onChange} ignoreCode={codeOfSelf} onlyParents />
          )}
        />
      );
    case 'qualifications':
      return (
        <>
          <Select
            label="المستوى"
            options={[
              { value: 'ثانوي',     label: 'ثانوي' },
              { value: 'دبلوم',     label: 'دبلوم' },
              { value: 'بكالوريوس', label: 'بكالوريوس' },
              { value: 'ماجستير',   label: 'ماجستير' },
              { value: 'دكتوراه',   label: 'دكتوراه' },
            ]}
            {...register('level')}
          />
          <Select
            label="المسار"
            options={[
              { value: 'عام',    label: 'عام' },
              { value: 'أزهري',  label: 'أزهري' },
              { value: 'وافد',   label: 'وافد' },
              { value: 'أجنبي',  label: 'أجنبي' },
              { value: 'حقوق',   label: 'حقوق' },
              { value: 'خاص',    label: 'خاص' },
            ]}
            {...register('track')}
          />
        </>
      );
    case 'announcements':
      return (
        <>
          <Controller
            control={control}
            name="categoryCode"
            render={({ field }) => (
              <ForeignKeySelect
                lookupKey="applicant-categories"
                label="الفئة"
                value={(field.value as string | null) ?? ''}
                onChange={(v) => field.onChange(v === '' ? null : v)}
                allowEmpty="الكل"
              />
            )}
          />
          <Select
            label="الجنس"
            options={[
              { value: 'any',    label: 'الكل' },
              { value: 'male',   label: 'ذكور' },
              { value: 'female', label: 'إناث' },
            ]}
            {...register('gender')}
          />
          <Controller
            control={control}
            name="divisionCode"
            render={({ field }) => (
              <ForeignKeySelect
                lookupKey="applicant-divisions"
                label="الشعبة"
                value={(field.value as string | null) ?? ''}
                onChange={(v) => field.onChange(v === '' ? null : v)}
                allowEmpty="الكل"
              />
            )}
          />
          <Input
            label="تاريخ ووقت النشر"
            type="datetime-local"
            {...register('publishAt', { setValueAs: (v: string) => (v ? new Date(v).toISOString() : '') })}
          />
          <Input
            label="تاريخ ووقت الانتهاء"
            type="datetime-local"
            {...register('expireAt', { setValueAs: (v: string) => (v ? new Date(v).toISOString() : null) })}
          />
          <Textarea
            label="نص التنبيه"
            rows={4}
            containerClassName="col-span-2"
            {...register('body')}
          />
        </>
      );
    case 'nid-missing-reasons':
      return (
        <Controller
          control={control}
          name="requiresUpload"
          render={({ field }) => (
            <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} label="يتطلب رفع مستندات" />
          )}
        />
      );
    default:
      return <></>;
  }
}

/* ─── applicant-categories: bespoke form section ─────────────────────── */

const GENDER_SCOPE_OPTIONS: { value: ApplicantCategoryGenderScope; label: string }[] = [
  { value: 'male',   label: 'ذكور' },
  { value: 'female', label: 'إناث' },
];

const STAGE_OPTIONS: { value: ApplicantCategoryType; label: string }[] = [
  { value: 'pre_university', label: 'ثانوي' },
  { value: 'university',     label: 'جامعي' },
];

function ApplicantCategoryFields(): JSX.Element {
  const { control } = useFormContext();
  return (
    <>
      <Controller
        control={control}
        name="genderScope"
        rules={{ validate: (v: unknown) => Array.isArray(v) && v.length > 0 }}
        render={({ field, fieldState }) => (
          <MultiSelect
            label="نطاق النوع"
            required
            value={(field.value as string[] | undefined) ?? []}
            onChange={field.onChange}
            options={GENDER_SCOPE_OPTIONS}
            placeholder="اختر النوع"
            ariaLabel="نطاق النوع"
            error={fieldState.error ? 'اختر نوعًا واحدًا على الأقل' : undefined}
          />
        )}
      />

      <Controller
        control={control}
        name="type"
        render={({ field }) => (
          <StageToggle
            value={(field.value as ApplicantCategoryType | undefined) ?? 'pre_university'}
            onChange={field.onChange}
          />
        )}
      />

      <FacultyAndSpecializationFields />
    </>
  );
}

function StageToggle({
  value,
  onChange,
}: {
  value: ApplicantCategoryType;
  onChange: (next: ApplicantCategoryType) => void;
}): JSX.Element {
  const { setValue } = useFormContext();
  return (
    <div className="col-span-2 flex flex-col gap-1">
      <span className="text-sm font-medium text-ink-700">
        مرحلة الالتحاق
        <span className="ms-1 text-terra-500">*</span>
      </span>
      <div
        role="radiogroup"
        aria-label="مرحلة الالتحاق"
        className="inline-flex w-fit overflow-hidden rounded-md border border-border-default bg-surface-card"
      >
        {STAGE_OPTIONS.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                if (selected) return;
                onChange(opt.value);
                /* Pre-University categories don't carry faculties or
                 * specializations — clear them so a re-shown row stays
                 * consistent with the type. */
                if (opt.value === 'pre_university') {
                  setValue('facultyCodes', []);
                  setValue('specializationCodes', []);
                }
              }}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium',
                'transition-colors duration-fast ease-standard',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1',
                selected ? 'bg-teal-500 text-white' : 'text-ink-700 hover:bg-ink-50',
              )}
            >
              {selected && <Check size={12} strokeWidth={2.4} aria-hidden />}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FacultyAndSpecializationFields(): JSX.Element | null {
  const { control, watch, setValue } = useFormContext();
  const stage = watch('type') as ApplicantCategoryType | undefined;
  const selectedFaculties = (watch('facultyCodes') as string[] | undefined) ?? [];
  const selectedSpecs = (watch('specializationCodes') as string[] | undefined) ?? [];

  /* Active rows from the live lookups — no useEffect for fetching, just
   * straight reads off MOCK like the rest of this drawer. */
  const facultyOptions = useMemo<ComboboxOption[]>(
    () =>
      (MOCK.lookups.faculties as FacultyRow[])
        .filter((f) => f.isActive)
        .map((f) => ({ value: f.code, label: f.name })),
    [],
  );

  const facultyById = useMemo(() => {
    const map = new Map<string, FacultyRow>();
    for (const f of MOCK.lookups.faculties as FacultyRow[]) map.set(f.code, f);
    return map;
  }, []);

  /* Spec options + groups derived from the currently picked faculties. */
  const specOptions = useMemo<ComboboxOption[]>(() => {
    if (selectedFaculties.length === 0) return [];
    const allowed = new Set(selectedFaculties);
    return (MOCK.lookups.specializations as SpecializationRow[])
      .filter((s) => s.isActive && allowed.has(s.facultyCode))
      .map((s) => ({
        value: s.code,
        label: s.name,
        groupId: s.facultyCode,
      }));
  }, [selectedFaculties]);

  const specGroups = useMemo<ComboboxGroup[]>(
    () =>
      selectedFaculties.map((code) => ({
        id: code,
        label: facultyById.get(code)?.name ?? code,
      })),
    [selectedFaculties, facultyById],
  );

  /* When the picked faculties shrink, drop any selected spec that no
   * longer belongs to a chosen faculty. Derived at render time — no
   * effect, since RHF's setValue is safe inside render via a guarded
   * compare. */
  const reconciledSpecs = useMemo(() => {
    if (selectedSpecs.length === 0) return selectedSpecs;
    if (selectedFaculties.length === 0) return [];
    const allowed = new Set(selectedFaculties);
    const next = selectedSpecs.filter((code) => {
      const row = (MOCK.lookups.specializations as SpecializationRow[]).find(
        (s) => s.code === code,
      );
      return row != null && allowed.has(row.facultyCode);
    });
    return next.length === selectedSpecs.length ? selectedSpecs : next;
  }, [selectedSpecs, selectedFaculties]);

  if (reconciledSpecs !== selectedSpecs) {
    /* RHF tolerates setValue during render as long as the value changed.
     * The guarded compare above keeps this idempotent. */
    setValue('specializationCodes', reconciledSpecs, { shouldDirty: true });
  }

  if (stage !== 'university') return null;

  return (
    <>
      <Controller
        control={control}
        name="facultyCodes"
        rules={{ validate: (v: unknown) => Array.isArray(v) && v.length > 0 }}
        render={({ field, fieldState }) => (
          <MultiSelect
            label="الكليات"
            required
            value={(field.value as string[] | undefined) ?? []}
            onChange={field.onChange}
            options={facultyOptions}
            placeholder="اختر الكليات"
            ariaLabel="الكليات"
            enableSelectAll
            className="col-span-2"
            error={fieldState.error ? 'اختر كلية واحدة على الأقل' : undefined}
          />
        )}
      />

      {selectedFaculties.length > 0 && (
        <Controller
          control={control}
          name="specializationCodes"
          render={({ field }) => (
            <MultiSelect
              label="التخصصات"
              helper="اتركه فارغًا لقبول كل تخصصات الكليات المختارة"
              value={(field.value as string[] | undefined) ?? []}
              onChange={field.onChange}
              options={specOptions}
              groups={specGroups}
              placeholder="اختر التخصصات"
              ariaLabel="التخصصات"
              enableSelectAll
              className="col-span-2"
              selectionSummary={(selected) =>
                `${selected.length.toLocaleString('ar-EG')} تخصصات مختارة`
              }
            />
          )}
        />
      )}
    </>
  );
}

/* ─── FK selects ─────────────────────────────────────────────────────── */

interface ParentCodeSelectProps {
  lookupKey: LookupKey;
  value: string | null;
  onChange: (v: string | null) => void;
  ignoreCode: string | undefined;
  onlyParents?: boolean;
}

interface RowWithParent {
  code: string;
  name: string;
  parentCode?: string | null;
}

function ParentCodeSelect({ lookupKey, value, onChange, ignoreCode, onlyParents }: ParentCodeSelectProps): JSX.Element {
  const items = MOCK.lookups[lookupKey] as unknown as RowWithParent[];
  const filtered = items.filter(
    (i) => i.code !== ignoreCode && (!onlyParents || (i.parentCode ?? null) === null),
  );
  return (
    <Select
      label="العنصر الأب"
      containerClassName="col-span-2"
      value={value ?? ''}
      onChange={(e) => onChange(e.currentTarget.value === '' ? null : e.currentTarget.value)}
      options={[
        { value: '', label: '— (جذر)' },
        ...filtered.map((r) => ({ value: r.code, label: r.name })),
      ]}
    />
  );
}

interface ForeignKeySelectProps {
  lookupKey: LookupKey;
  label: string;
  value: string;
  onChange: (v: string) => void;
  allowEmpty?: string;
  required?: boolean;
  error?: string;
  containerClassName?: string;
}

interface RowMinimal {
  code: string;
  name: string;
  isActive: boolean;
}

function ForeignKeySelect({
  lookupKey,
  label,
  value,
  onChange,
  allowEmpty,
  required,
  error,
  containerClassName,
}: ForeignKeySelectProps): JSX.Element {
  const items = MOCK.lookups[lookupKey] as unknown as RowMinimal[];
  return (
    <Select
      label={label}
      required={required}
      error={error}
      containerClassName={containerClassName}
      value={value ?? ''}
      onChange={(e) => onChange(e.currentTarget.value)}
      options={[
        ...(allowEmpty ? [{ value: '', label: allowEmpty }] : []),
        ...items.filter((i) => i.isActive).map((r) => ({ value: r.code, label: r.name })),
      ]}
    />
  );
}

/* ─── Blank-row factory + next-code helper ───────────────────────────── */

function blankRow(key: LookupKey): Record<string, unknown> {
  const base: Record<string, unknown> = { code: '', name: '', isActive: true };
  switch (key) {
    case 'relationships':
      return { ...base, parentCode: null, branch: 'self', gender: 'male', degree: 1 };
    case 'relationship-degree-tiers':
      return { ...base, degreeRange: '', maxDegree: 1 };
    case 'tests':
      return { ...base, kind: 'written', order: 1, required: true };
    case 'test-results':
      return { ...base, outcome: 'pass', tone: 'success' };
    case 'committees':
      return { ...base, applicantCategoryId: '' };
    case 'specializations':
      return { ...base, facultyCode: '' };
    case 'submission-types':
      return { ...base, metadata: { gradingMode: 'GRADES' } };
    case 'applicant-categories':
      return {
        ...base,
        genderScope: ['male', 'female'],
        /* New rows default to "جامعي" so the faculty + specialization
         * pickers are revealed on first open (admins more often configure
         * university-stage categories; the toggle still works either way). */
        type: 'university',
        facultyCodes: [],
        specializationCodes: [],
      };
    case 'nationalities-countries':
      return { ...base, iso2: '', isArab: false };
    case 'governorates':
      return { ...base, region: 'الوجه البحري' };
    case 'police-stations':
      return { ...base, governorateCode: '', kind: 'قسم' };
    case 'jobs':
      return { ...base, parentCode: null };
    case 'qualifications':
      return { ...base, level: 'ثانوي', track: 'عام' };
    case 'announcements':
      return {
        ...base,
        categoryCode: null,
        gender: 'any',
        divisionCode: null,
        publishAt: new Date().toISOString(),
        expireAt: null,
        body: '',
      };
    case 'nid-missing-reasons':
      return { ...base, requiresUpload: false };
    default:
      return base;
  }
}

function nextCodeFor(key: LookupKey): string {
  const meta = LOOKUP_META[key];
  const items = MOCK.lookups[key] as unknown as Array<{ code: string }>;
  let max = 0;
  for (const r of items) {
    const m = r.code.match(/-(\d+)$/);
    if (m) {
      const n = Number.parseInt(m[1] ?? '0', 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return `${meta.codePrefix}-${String(max + 1).padStart(meta.padding, '0')}`;
}
