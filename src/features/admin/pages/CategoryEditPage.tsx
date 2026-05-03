/**
 * CategoryEditPage — Bucket D2.
 *
 * Edits a single category (spec or custom). Three sections:
 *  1. Identity (label, description, freeText)
 *  2. Conditions (age, score, qualification, gender, height, marital, etc.)
 *  3. Required tests + procedures (orderable lists)
 *
 * Spec departments (the 7 from the brief) keep their labelAr and
 * nominationOnly read-only. Custom departments allow full edit.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Select,
  Textarea,
  toast,
} from '@/shared/components';
import type {
  ApplicantCategory,
  ApplicantCategoryKey,
  CategoryCondition,
  RequiredTest,
  RequiredTestKind,
  RequiredQualification,
} from '@/shared/types/domain';
import { ROUTES } from '@/config/routes';
import { TEST_KIND_LABEL_AR } from '@/features/applicant-portal/lib/category-test-labels';
import {
  useCategoryAdmin,
  useUpdateCategoryMutation,
} from '../api/categories.queries';
import { categoriesAdminService } from '../api/categories.service';

const TEST_KIND_OPTIONS: RequiredTestKind[] = [
  'aptitude',
  'posture',
  'medical',
  'physical',
  'psychological',
  'interview',
  'drug',
  'security_review',
  'tactical_training',
  'security_training',
  'specialized_courses',
];

const QUALIFICATION_OPTIONS: { value: RequiredQualification; label: string }[] = [
  { value: 'any', label: 'بدون اشتراط' },
  { value: 'thanaweya_amma', label: 'الثانوية العامة' },
  { value: 'azhar', label: 'الثانوية الأزهرية' },
  { value: 'bachelor', label: 'مؤهل عالي' },
  { value: 'bachelor_law', label: 'بكالوريوس حقوق' },
  { value: 'bachelor_medicine', label: 'بكالوريوس طب' },
  { value: 'bachelor_engineering', label: 'بكالوريوس هندسة' },
  { value: 'bachelor_media', label: 'بكالوريوس إعلام' },
  { value: 'police_academy_grad', label: 'خريج كلية الشرطة' },
  { value: 'serving_officer', label: 'ضابط شرطة' },
];

export function CategoryEditPage(): JSX.Element {
  const { key = '' } = useParams<{ key: string }>();
  const categoryKey = key as ApplicantCategoryKey;
  const navigate = useNavigate();
  const detailQuery = useCategoryAdmin(categoryKey);
  const updateMut = useUpdateCategoryMutation();
  const [draft, setDraft] = useState<ApplicantCategory | null>(null);

  useEffect(() => {
    if (detailQuery.data) setDraft(detailQuery.data);
  }, [detailQuery.data]);

  const isSpec = useMemo(() => categoriesAdminService.isSpecCategory(categoryKey), [categoryKey]);

  if (detailQuery.isLoading) return <LoadingState variant="page" />;
  if (detailQuery.error) {
    return <ErrorState error={detailQuery.error as Error} onRetry={() => detailQuery.refetch()} />;
  }
  if (!detailQuery.data || !draft) {
    return <ErrorState error={new Error('الفئة غير موجودة')} />;
  }

  const onSave = (): void => {
    updateMut.mutate(
      { key: categoryKey, patch: draft },
      {
        onSuccess: () => {
          toast(`تم حفظ "${draft.labelAr}"`, 'success');
          navigate(ROUTES.admin.categories);
        },
        onError: (err) => toast((err as Error).message, 'danger'),
      },
    );
  };

  const updateConditions = (patch: Partial<CategoryCondition>): void => {
    setDraft({ ...draft, conditions: { ...draft.conditions, ...patch } });
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`تعديل فئة: ${draft.labelAr}`}
        subtitle={isSpec ? 'فئة معتمدة من المواصفات — التسمية وحالة الترشيح ثابتة' : 'فئة مخصصة'}
        breadcrumbs={[
          { label: 'إدارة الفئات', href: ROUTES.admin.categories },
          { label: 'تعديل' },
        ]}
        actions={
          <Button
            variant="primary"
            leadingIcon={<Save size={14} strokeWidth={1.75} />}
            onClick={onSave}
            isLoading={updateMut.isPending}
          >
            حفظ التغييرات
          </Button>
        }
      />

      <Card>
        <h3 className="mb-3 font-ar-display text-md font-bold text-ink-900">بيانات الفئة</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="الاسم بالعربية"
            value={draft.labelAr}
            disabled={isSpec}
            onChange={(e) => setDraft({ ...draft, labelAr: e.target.value })}
          />
          <Input
            label="Label (English)"
            dir="ltr"
            value={draft.labelEn}
            onChange={(e) => setDraft({ ...draft, labelEn: e.target.value })}
          />
          <Textarea
            label="الوصف"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            containerClassName="md:col-span-2"
          />
        </div>

        <FreeTextEditor
          values={draft.conditions.freeText}
          onChange={(freeText) => updateConditions({ freeText })}
        />

        <label className="mt-4 flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={draft.conditions.nominationOnly}
            disabled={isSpec}
            onChange={(e) => updateConditions({ nominationOnly: e.target.checked })}
            className="h-4 w-4 cursor-pointer accent-teal-500"
          />
          بالترشيح فقط (لا يظهر في التقديم العام)
        </label>
      </Card>

      <Card>
        <h3 className="mb-3 font-ar-display text-md font-bold text-ink-900">شروط الأهلية</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="السن الأدنى (سنة)"
            type="number"
            value={draft.conditions.ageMin ?? ''}
            onChange={(e) => updateConditions({ ageMin: e.target.value ? Number(e.target.value) : null })}
          />
          <Input
            label="السن الأقصى (سنة)"
            type="number"
            value={draft.conditions.ageMax ?? ''}
            onChange={(e) => updateConditions({ ageMax: e.target.value ? Number(e.target.value) : null })}
          />
          <Input
            label="الحد الأدنى للمجموع (%)"
            type="number"
            value={draft.conditions.minScorePercent ?? ''}
            onChange={(e) =>
              updateConditions({ minScorePercent: e.target.value ? Number(e.target.value) : null })
            }
          />
          <Input
            label="الطول الأدنى (سم)"
            type="number"
            value={draft.conditions.minHeightCm ?? ''}
            onChange={(e) => updateConditions({ minHeightCm: e.target.value ? Number(e.target.value) : null })}
          />
          <Select
            label="المؤهل المطلوب"
            value={draft.conditions.requiredQualification}
            onChange={(e) => updateConditions({ requiredQualification: e.target.value as RequiredQualification })}
            options={QUALIFICATION_OPTIONS}
          />
          <Select
            label="النوع"
            value={draft.conditions.gender}
            onChange={(e) => updateConditions({ gender: e.target.value as 'male' | 'female' | 'any' })}
            options={[
              { value: 'any', label: 'أي' },
              { value: 'male', label: 'ذكر' },
              { value: 'female', label: 'أنثى' },
            ]}
          />
          <Select
            label="الحالة الاجتماعية"
            value={draft.conditions.maritalStatus}
            onChange={(e) => updateConditions({ maritalStatus: e.target.value as 'single' | 'any' })}
            options={[
              { value: 'any', label: 'أي' },
              { value: 'single', label: 'غير متزوج' },
            ]}
          />
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <ToggleRow
            label="مصري الجنسية"
            checked={draft.conditions.egyptianNationalityRequired}
            onChange={(v) => updateConditions({ egyptianNationalityRequired: v })}
          />
          <ToggleRow
            label="حسن السير والسلوك"
            checked={draft.conditions.conductCheck}
            onChange={(v) => updateConditions({ conductCheck: v })}
          />
          <ToggleRow
            label="لائق طبياً"
            checked={draft.conditions.medicalRequired}
            onChange={(v) => updateConditions({ medicalRequired: v })}
          />
          <ToggleRow
            label="موافقة جهة العمل"
            checked={draft.conditions.employerApprovalRequired}
            onChange={(v) => updateConditions({ employerApprovalRequired: v })}
          />
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 font-ar-display text-md font-bold text-ink-900">الاختبارات والإجراءات</h3>
        <RequiredTestsEditor
          tests={draft.requiredTests}
          onChange={(requiredTests) => setDraft({ ...draft, requiredTests })}
        />
        <ProceduresEditor
          procedures={draft.procedures}
          onChange={(procedures) => setDraft({ ...draft, procedures })}
        />
      </Card>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}): JSX.Element {
  return (
    <label className="flex items-center gap-2 text-sm text-ink-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 cursor-pointer accent-teal-500"
      />
      {label}
    </label>
  );
}

function FreeTextEditor({
  values,
  onChange,
}: {
  values: readonly string[];
  onChange: (next: string[]) => void;
}): JSX.Element {
  const update = (i: number, val: string): void => {
    const next = [...values];
    next[i] = val;
    onChange(next);
  };
  const remove = (i: number): void => onChange(values.filter((_, idx) => idx !== i));
  const add = (): void => onChange([...values, '']);
  return (
    <section className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-2xs font-bold uppercase tracking-wide text-ink-500">ملاحظات إضافية</h4>
        <Button variant="ghost" size="sm" leadingIcon={<Plus size={12} strokeWidth={1.75} />} onClick={add}>
          إضافة سطر
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {values.length === 0 && <p className="text-2xs text-ink-500">لا توجد ملاحظات</p>}
        {values.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={v}
              onChange={(e) => update(i, e.target.value)}
              containerClassName="flex-1"
              aria-label={`ملاحظة ${i + 1}`}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label="حذف"
              onClick={() => remove(i)}
            >
              <Trash2 size={14} strokeWidth={1.75} />
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

function RequiredTestsEditor({
  tests,
  onChange,
}: {
  tests: RequiredTest[];
  onChange: (next: RequiredTest[]) => void;
}): JSX.Element {
  const update = (i: number, patch: Partial<RequiredTest>): void => {
    const next = [...tests];
    next[i] = { ...next[i]!, ...patch };
    onChange(reorder(next));
  };
  const remove = (i: number): void => onChange(reorder(tests.filter((_, idx) => idx !== i)));
  const move = (i: number, dir: -1 | 1): void => {
    const j = i + dir;
    if (j < 0 || j >= tests.length) return;
    const next = [...tests];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(reorder(next));
  };
  const add = (): void => {
    onChange(reorder([...tests, { kind: 'aptitude', order: tests.length + 1, passingCriteria: '' }]));
  };
  function reorder(arr: RequiredTest[]): RequiredTest[] {
    return arr.map((t, idx) => ({ ...t, order: idx + 1 }));
  }
  return (
    <section className="mt-2">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-2xs font-bold uppercase tracking-wide text-ink-500">الاختبارات المطلوبة</h4>
        <Button variant="ghost" size="sm" leadingIcon={<Plus size={12} strokeWidth={1.75} />} onClick={add}>
          إضافة اختبار
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {tests.length === 0 && <p className="text-2xs text-ink-500">لا توجد اختبارات</p>}
        {tests.map((test, i) => (
          <div key={`${test.kind}-${i}`} className="grid gap-2 md:grid-cols-[40px_220px_1fr_auto]">
            <span className="self-center text-2xs font-bold text-ink-500">{test.order}.</span>
            <Select
              value={test.kind}
              onChange={(e) => update(i, { kind: e.target.value as RequiredTestKind })}
              options={TEST_KIND_OPTIONS.map((k) => ({ value: k, label: TEST_KIND_LABEL_AR[k] }))}
            />
            <Input
              value={test.passingCriteria}
              placeholder="معايير النجاح (اختياري)"
              onChange={(e) => update(i, { passingCriteria: e.target.value })}
            />
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" aria-label="رفع" onClick={() => move(i, -1)} disabled={i === 0}>
                <ArrowUp size={14} strokeWidth={1.75} />
              </Button>
              <Button variant="ghost" size="icon" aria-label="إنزال" onClick={() => move(i, 1)} disabled={i === tests.length - 1}>
                <ArrowDown size={14} strokeWidth={1.75} />
              </Button>
              <Button variant="ghost" size="icon" aria-label="حذف" onClick={() => remove(i)}>
                <Trash2 size={14} strokeWidth={1.75} />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProceduresEditor({
  procedures,
  onChange,
}: {
  procedures: string[];
  onChange: (next: string[]) => void;
}): JSX.Element {
  const update = (i: number, val: string): void => {
    const next = [...procedures];
    next[i] = val;
    onChange(next);
  };
  const remove = (i: number): void => onChange(procedures.filter((_, idx) => idx !== i));
  const add = (): void => onChange([...procedures, '']);
  return (
    <section className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-2xs font-bold uppercase tracking-wide text-ink-500">الإجراءات</h4>
        <Button variant="ghost" size="sm" leadingIcon={<Plus size={12} strokeWidth={1.75} />} onClick={add}>
          إضافة إجراء
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {procedures.length === 0 && <p className="text-2xs text-ink-500">لا توجد إجراءات</p>}
        {procedures.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={p}
              onChange={(e) => update(i, e.target.value)}
              containerClassName="flex-1"
              aria-label={`إجراء ${i + 1}`}
            />
            <Button variant="ghost" size="icon" aria-label="حذف" onClick={() => remove(i)}>
              <Trash2 size={14} strokeWidth={1.75} />
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
