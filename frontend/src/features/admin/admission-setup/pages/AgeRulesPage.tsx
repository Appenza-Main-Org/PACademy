/**
 * الحد الأقصى للسن — per-open-category editor for the cycle.
 * Persists into `category.expandedConditions.maxAge` via the same
 * `useUpdateExpandedConditions` mutation the full condition builder uses.
 * The minimum-age input was dropped in 2026-05; the wizard now only
 * captures `maxAge` and leaves `minAge` set to null on save.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import {
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  toast,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import {
  useCategoriesAdmin,
  useUpdateExpandedConditions,
} from '@/features/admin/api/categories.queries';
import type {
  AdmissionCycle,
  ApplicantCategory,
  CategoryConditions,
} from '@/shared/types/domain';
import { AdmissionSetupShell, useAdmissionSetupCanWrite } from '../components/AdmissionSetupShell';
import { useAdmissionSetupCycle } from '../hooks/useAdmissionSetupCycle';

const MIN_AGE_LIMIT = 18;
const MAX_AGE_LIMIT = 99;

export function AgeRulesPage(): JSX.Element {
  const { cycle } = useAdmissionSetupCycle();
  const canWrite = useAdmissionSetupCanWrite();
  return (
    <AdmissionSetupShell>
      {!cycle ? <NoCycle /> : <Body cycle={cycle} canWrite={canWrite} />}
    </AdmissionSetupShell>
  );
}

function Body({ cycle, canWrite }: { cycle: AdmissionCycle; canWrite: boolean }): JSX.Element {
  const { data: categories = [] } = useCategoriesAdmin();
  const openCategoryKeys = useMemo(
    () =>
      Object.entries(cycle.openCategories ?? {})
        .filter(([, c]) => c?.isOpen)
        .map(([k]) => k),
    [cycle.openCategories],
  );

  const openCategories = categories.filter((c) => openCategoryKeys.includes(c.key));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="الحد الأقصى للسن"
        subtitle="حدد الحد الأقصى للسن المسموح به لكل فئة قبول مفتوحة في هذه الدورة."
      />

      {openCategories.length === 0 ? (
        <EmptyState
          variant="generic"
          title="لا توجد فئات مفتوحة في هذه الدورة"
          description="افتح فئات من خطوة إعدادات التقديم أولاً."
          action={
            <Link to={ROUTES.admin.admissionSetup.applicationSettings} className="inline-flex">
              <Button variant="primary">إعدادات التقديم</Button>
            </Link>
          }
        />
      ) : (
        openCategories.map((cat) => (
          <CategoryAgeCard key={cat.key} category={cat} canWrite={canWrite} />
        ))
      )}
    </div>
  );
}

function CategoryAgeCard({
  category,
  canWrite,
}: {
  category: ApplicantCategory;
  canWrite: boolean;
}): JSX.Element {
  const expanded = category.expandedConditions ?? defaultConditions();
  const [maxAge, setMaxAge] = useState<number | null>(expanded.maxAge);
  const updateMut = useUpdateExpandedConditions();

  useEffect(() => {
    setMaxAge((category.expandedConditions ?? defaultConditions()).maxAge);
  }, [category]);

  const dirty = maxAge !== expanded.maxAge;
  const error = validateMaxAge(maxAge);

  const save = (): void => {
    if (!canWrite) return;
    if (maxAge === null || error) {
      toast(error ?? 'يجب إدخال الحد الأقصى للسن', 'danger');
      return;
    }
    const next: CategoryConditions = {
      ...expanded,
      minAge: null,
      maxAge,
    };
    updateMut.mutate(
      { key: category.key, conditions: next },
      {
        onSuccess: () => toast(`تم حفظ الحد الأقصى للسن للفئة "${category.labelAr}"`, 'success'),
        onError: (err) => toast((err as Error).message ?? 'تعذر الحفظ', 'danger'),
      },
    );
  };

  return (
    <Card>
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-ar-display text-md font-bold text-ink-900">{category.labelAr}</h3>
          <p className="mt-0.5 text-2xs text-ink-500">
            تاريخ احتساب السن يتبع إعدادات الدورة. لتعديل المصفوفة الكاملة استخدم تفاصيل الفئة.
          </p>
        </div>
        <Link to={ROUTES.admin.categoryEdit(category.key)} className="inline-flex">
          <Button
            variant="ghost"
            size="sm"
            trailingIcon={<ArrowLeft size={14} strokeWidth={1.75} className="rtl:scale-x-[-1]" />}
          >
            تفاصيل الفئة
          </Button>
        </Link>
      </header>
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <Input
          label="الحد الأقصى للسن (سنة)"
          type="number"
          dir="ltr"
          inputMode="numeric"
          min={MIN_AGE_LIMIT}
          max={MAX_AGE_LIMIT}
          step={1}
          value={maxAge ?? ''}
          onChange={(e) => setMaxAge(parseAge(e.target.value))}
          disabled={!canWrite}
          required
          error={error ?? undefined}
          helper={error ? undefined : `يجب أن يكون عدداً صحيحاً بين ${MIN_AGE_LIMIT} و${MAX_AGE_LIMIT} سنة.`}
        />
        <Button
          variant="primary"
          leadingIcon={<Save size={14} strokeWidth={1.75} />}
          onClick={save}
          disabled={!canWrite || !dirty || Boolean(error) || maxAge === null}
          isLoading={updateMut.isPending}
        >
          حفظ
        </Button>
      </div>
    </Card>
  );
}

function parseAge(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function validateMaxAge(value: number | null): string | null {
  if (value === null) return 'يجب إدخال الحد الأقصى للسن';
  if (!Number.isInteger(value)) return 'يجب أن يكون السن عدداً صحيحاً';
  if (value < MIN_AGE_LIMIT) return `الحد الأدنى المسموح به هو ${MIN_AGE_LIMIT} سنة`;
  if (value > MAX_AGE_LIMIT) return `الحد الأقصى المسموح به هو ${MAX_AGE_LIMIT} سنة`;
  return null;
}

function defaultConditions(): CategoryConditions {
  return {
    gender: 'any',
    minAge: null,
    maxAge: null,
    educationTypes: [],
    graduationYear: null,
    maritalStatuses: [],
    minScore: null,
    requiredDocuments: [],
    requiredExamIds: [],
    examOrder: [],
  };
}

function NoCycle(): JSX.Element {
  return (
    <EmptyState
      variant="generic"
      title="يجب إنشاء دورة قبول أولاً"
      action={
        <Link to={ROUTES.admin.cycleNew} className="inline-flex">
          <Button variant="primary">إنشاء دورة جديدة</Button>
        </Link>
      }
    />
  );
}
