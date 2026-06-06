/**
 * إدارة الاختبارات — wizard step.
 *
 * Source of truth for active categories: the application_settings step's
 * `ApplicantCategoryConfig` rows (joined via `useCategoryConfigs`). A
 * category is "active" when `isActive === true` and the row is not
 * soft-deleted. Switching tabs scopes the underlying `ExamPlanEditor`
 * to a single `(cycleId, categoryId)` plan — persistence is unchanged.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  Tabs,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { ExamPlanEditor } from '@/features/admin/components/exams/ExamPlanEditor';
import { APPLICANT_CATEGORY_KEYS, type AdmissionCycle, type ApplicantCategoryKey } from '@/shared/types/domain';
import { AdmissionSetupShell } from '../components/AdmissionSetupShell';
import { useIsInWizardMode } from '../components/WizardModeContext';
import { useAdmissionSetupCycle } from '../hooks/useAdmissionSetupCycle';
import { useCategoryConfigs } from '../api/applicationSettings.queries';
import type {
  ExamPlanCategoryDraft,
  ExamPlanDraftsByCategory,
  ExamPlanStepDraftState,
} from '../lib/exam-plan-step';

function isApplicantCategoryKey(code: string): code is ApplicantCategoryKey {
  return (APPLICANT_CATEGORY_KEYS as readonly string[]).includes(code);
}

export interface ExamsManagementPageProps {
  onWizardDraftsChange?: (state: ExamPlanStepDraftState | null) => void;
}

export function ExamsManagementPage({
  onWizardDraftsChange,
}: ExamsManagementPageProps): JSX.Element {
  const { cycle } = useAdmissionSetupCycle();
  return (
    <AdmissionSetupShell>
      {!cycle ? <NoCycle /> : <Body cycle={cycle} onWizardDraftsChange={onWizardDraftsChange} />}
    </AdmissionSetupShell>
  );
}

function Body({
  cycle,
  onWizardDraftsChange,
}: {
  cycle: AdmissionCycle;
  onWizardDraftsChange?: (state: ExamPlanStepDraftState | null) => void;
}): JSX.Element {
  const configsQuery = useCategoryConfigs(true, cycle.id);
  const inWizard = useIsInWizardMode();
  const [draftsByCategory, setDraftsByCategory] = useState<ExamPlanDraftsByCategory>({});

  const activeCategories = useMemo(
    () =>
      (configsQuery.data ?? [])
        .filter((c) => c.isActive && isApplicantCategoryKey(c.categoryCode))
        .map((c) => ({
          key: c.categoryCode as ApplicantCategoryKey,
          labelAr: c.categoryNameAr,
        })),
    [configsQuery.data],
  );

  const handleCategoryDraftChange = useCallback(
    (categoryId: ApplicantCategoryKey, draft: ExamPlanCategoryDraft | null): void => {
      setDraftsByCategory((prev) => {
        if (!draft) {
          const next = { ...prev };
          delete next[categoryId];
          return next;
        }
        return { ...prev, [categoryId]: draft };
      });
    },
    [],
  );

  useEffect(() => {
    onWizardDraftsChange?.({ activeCategories, draftsByCategory });
  }, [activeCategories, draftsByCategory, onWizardDraftsChange]);

  const [active, setActive] = useState<ApplicantCategoryKey | null>(null);
  const resolvedActive: ApplicantCategoryKey | null =
    active && activeCategories.some((c) => c.key === active)
      ? active
      : (activeCategories[0]?.key ?? null);

  if (activeCategories.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title="إدارة الاختبارات"
          subtitle="حدّد ترتيب الاختبارات وإلزاميتها لكل فئة."
        />
        <EmptyState
          variant="generic"
          title="يرجى تفعيل فئة واحدة على الأقل من إعدادات التقديم"
          action={
            <Link to={ROUTES.admin.admissionSetup.applicationSettings} className="inline-flex">
              <Button variant="primary">إعدادات التقديم</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="إدارة الاختبارات"
        subtitle="حدّد ترتيب الاختبارات وإلزاميتها لكل فئة."
      />
      <Card>
        <Tabs
          value={resolvedActive ?? activeCategories[0]!.key}
          onValueChange={(next) => setActive(next as ApplicantCategoryKey)}
        >
          <Tabs.List aria-label="فئات التقديم النشطة">
            {activeCategories.map((cat) => (
              <Tabs.Tab key={cat.key} value={cat.key}>
                {cat.labelAr}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {activeCategories.map((cat) => (
            <Tabs.Panel key={cat.key} value={cat.key} forceMount={inWizard ? true : undefined}>
              <div className="pt-2">
                <CategoryExamPlanPanel
                  cycleId={cycle.id}
                  category={cat}
                  showSaveButton={!inWizard}
                  onDraftChange={handleCategoryDraftChange}
                />
              </div>
            </Tabs.Panel>
          ))}
        </Tabs>
      </Card>
    </div>
  );
}

function CategoryExamPlanPanel({
  cycleId,
  category,
  showSaveButton,
  onDraftChange,
}: {
  cycleId: string;
  category: { key: ApplicantCategoryKey; labelAr: string };
  showSaveButton: boolean;
  onDraftChange: (categoryId: ApplicantCategoryKey, draft: ExamPlanCategoryDraft | null) => void;
}): JSX.Element {
  const handleDraftChange = useCallback(
    (draft: ExamPlanCategoryDraft | null) => onDraftChange(category.key, draft),
    [category.key, onDraftChange],
  );

  return (
    <ExamPlanEditor
      cycleId={cycleId}
      categoryId={category.key}
      showSaveButton={showSaveButton}
      onDraftChange={handleDraftChange}
    />
  );
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
