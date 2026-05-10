/**
 * Step 4 — شروط السن.
 * Per-open-category age min/max editor that hits the same
 * `useUpdateExpandedConditions` mutation `CategoryConditionBuilder` uses.
 * No fork; impact preview is skipped here because age changes the most
 * narrowly-scoped slice of the condition set, and admins can still edit
 * the full matrix at /admin/categories/:key.
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
        title="شروط السن"
        subtitle="حدد الحد الأدنى والأقصى للسن لكل فئة قبول مفتوحة في هذه الدورة."
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
  const [draft, setDraft] = useState<CategoryConditions>(expanded);
  const updateMut = useUpdateExpandedConditions();

  useEffect(() => setDraft(category.expandedConditions ?? defaultConditions()), [category]);

  const dirty = draft.minAge !== expanded.minAge || draft.maxAge !== expanded.maxAge;

  const save = (): void => {
    if (!canWrite) return;
    if (draft.minAge !== null && draft.maxAge !== null && draft.minAge > draft.maxAge) {
      toast('السن الأدنى يجب أن يكون أقل من أو يساوي السن الأقصى', 'danger');
      return;
    }
    updateMut.mutate(
      { key: category.key, conditions: draft },
      {
        onSuccess: () => toast(`تم حفظ شروط السن للفئة "${category.labelAr}"`, 'success'),
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
      <div className="grid gap-3 md:grid-cols-3">
        <Input
          label="السن الأدنى (سنة)"
          type="number"
          dir="ltr"
          value={draft.minAge ?? ''}
          onChange={(e) =>
            setDraft({ ...draft, minAge: e.target.value ? Number(e.target.value) : null })
          }
          disabled={!canWrite}
        />
        <Input
          label="السن الأقصى (سنة)"
          type="number"
          dir="ltr"
          value={draft.maxAge ?? ''}
          onChange={(e) =>
            setDraft({ ...draft, maxAge: e.target.value ? Number(e.target.value) : null })
          }
          disabled={!canWrite}
        />
        <div className="self-end">
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
