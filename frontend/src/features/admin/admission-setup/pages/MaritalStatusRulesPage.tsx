/**
 * Step 5 — الحالة الاجتماعية.
 * Per-open-category marital-status-allowed editor — re-renders the same
 * checkbox set CategoryConditionBuilder uses, hits the same mutation.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  toast,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import {
  useCategoriesAdmin,
  useUpdateExpandedConditions,
} from '@/features/admin/api/categories.queries';
import { useLookupList } from '@/features/admin/api/lookups.queries';
import type {
  AdmissionCycle,
  ApplicantCategory,
  CategoryConditions,
} from '@/shared/types/domain';
import { AdmissionSetupShell, useAdmissionSetupCanWrite } from '../components/AdmissionSetupShell';
import { useAdmissionSetupCycle } from '../hooks/useAdmissionSetupCycle';

export function MaritalStatusRulesPage(): JSX.Element {
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
  const { data: lookups = [] } = useLookupList('maritalStatuses');
  const openKeys = useMemo(
    () =>
      Object.entries(cycle.openCategories ?? {})
        .filter(([, c]) => c?.isOpen)
        .map(([k]) => k),
    [cycle.openCategories],
  );
  const openCategories = categories.filter((c) => openKeys.includes(c.key));
  const activeMarital = lookups.filter((l) => l.isActive && !l.deletedAt);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="الحالة الاجتماعية"
        subtitle="حدد الحالات الاجتماعية المسموح بها لكل فئة قبول مفتوحة."
      />
      {openCategories.length === 0 ? (
        <EmptyState
          variant="generic"
          title="لا توجد فئات مفتوحة في هذه الدورة"
          action={
            <Link to={ROUTES.admin.admissionSetup.applicationSettings} className="inline-flex">
              <Button variant="primary">إعدادات التقديم</Button>
            </Link>
          }
        />
      ) : (
        openCategories.map((cat) => (
          <CategoryMaritalCard
            key={cat.key}
            category={cat}
            options={activeMarital.map((l) => ({ key: l.key, label: l.labelAr }))}
            canWrite={canWrite}
          />
        ))
      )}
    </div>
  );
}

function CategoryMaritalCard({
  category,
  options,
  canWrite,
}: {
  category: ApplicantCategory;
  options: { key: string; label: string }[];
  canWrite: boolean;
}): JSX.Element {
  const expanded = category.expandedConditions ?? defaultConditions();
  const [draft, setDraft] = useState<string[]>(expanded.maritalStatuses ?? []);
  const updateMut = useUpdateExpandedConditions();

  useEffect(() => {
    setDraft((category.expandedConditions ?? defaultConditions()).maritalStatuses ?? []);
  }, [category]);

  const toggle = (key: string): void => {
    setDraft((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const dirty =
    JSON.stringify([...draft].sort()) !==
    JSON.stringify([...(expanded.maritalStatuses ?? [])].sort());

  const save = (): void => {
    if (!canWrite) return;
    updateMut.mutate(
      { key: category.key, conditions: { ...expanded, maritalStatuses: draft } },
      {
        onSuccess: () => toast(`تم حفظ شروط الحالة الاجتماعية للفئة "${category.labelAr}"`, 'success'),
        onError: (err) => toast((err as Error).message ?? 'تعذر الحفظ', 'danger'),
      },
    );
  };

  return (
    <Card>
      <header className="mb-3 flex items-start justify-between gap-3">
        <h3 className="font-ar-display text-md font-bold text-ink-900">{category.labelAr}</h3>
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
      <div className="grid gap-2 sm:grid-cols-2">
        {options.length === 0 && (
          <p className="text-2xs text-ink-500">لا توجد قيم مرجعية مفعّلة للحالة الاجتماعية.</p>
        )}
        {options.map((opt) => (
          <label key={opt.key} className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={draft.includes(opt.key)}
              onChange={() => toggle(opt.key)}
              disabled={!canWrite}
              className="h-4 w-4 cursor-pointer accent-teal-500"
            />
            {opt.label}
          </label>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <Button
          variant="primary"
          leadingIcon={<Save size={14} strokeWidth={1.75} />}
          onClick={save}
          disabled={!canWrite || !dirty}
          isLoading={updateMut.isPending}
        >
          حفظ
        </Button>
      </div>
    </Card>
  );
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
