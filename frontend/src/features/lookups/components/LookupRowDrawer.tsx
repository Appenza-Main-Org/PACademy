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
  Select,
  Switch,
  Textarea,
} from '@/shared/components';
import { zodResolver } from '@/shared/lib/zod-resolver';
import { MOCK } from '@/shared/mock-data';
import {
  LOOKUP_META,
  type LookupKey,
  type LookupRow,
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
                      label="مفعّل"
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
        <>
          <Select
            label="نوع اللجنة"
            options={[
              { value: 'primary',    label: 'رئيسية' },
              { value: 'capacities', label: 'قدرات' },
              { value: 'traits',     label: 'سمات' },
              { value: 'sports',     label: 'رياضية' },
              { value: 'medical',    label: 'طبية' },
              { value: 'interview',  label: 'مقابلة' },
              { value: 'final',      label: 'نهائية' },
            ]}
            {...register('kind')}
          />
          <Input label="مسمى الرئيس" containerClassName="col-span-2" {...register('chairTitle')} />
        </>
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
      return (
        <>
          <Select
            label="نطاق النوع"
            options={[
              { value: 'male',   label: 'ذكور فقط' },
              { value: 'female', label: 'إناث فقط' },
              { value: 'any',    label: 'الكل' },
            ]}
            {...register('genderScope')}
          />
          <Select
            label="نوع التقديم"
            options={[
              { value: 'general',    label: 'تقديم عام' },
              { value: 'nomination', label: 'بالترشيح' },
            ]}
            {...register('applicationMode')}
          />
        </>
      );
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
}

interface RowMinimal {
  code: string;
  name: string;
  isActive: boolean;
}

function ForeignKeySelect({ lookupKey, label, value, onChange, allowEmpty }: ForeignKeySelectProps): JSX.Element {
  const items = MOCK.lookups[lookupKey] as unknown as RowMinimal[];
  return (
    <Select
      label={label}
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
      return { ...base, kind: 'written', order: 10, required: true };
    case 'test-results':
      return { ...base, outcome: 'pass', tone: 'success' };
    case 'committees':
      return { ...base, kind: 'primary', chairTitle: '' };
    case 'specializations':
      return { ...base, facultyCode: '' };
    case 'submission-types':
      return { ...base, metadata: { gradingMode: 'GRADES' } };
    case 'applicant-categories':
      return { ...base, genderScope: 'any', applicationMode: 'general' };
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
