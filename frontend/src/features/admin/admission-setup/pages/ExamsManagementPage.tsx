/**
 * إدارة الاختبارات — wizard step.
 *
 * Source of truth for active categories: the application_settings step's
 * `ApplicantCategoryConfig` rows (joined via `useCategoryConfigs`). A
 * category is "active" when `isActive === true` and the row is not
 * soft-deleted. Switching tabs scopes the underlying `ExamPlanEditor`
 * to a single `(cycleId, categoryId)` plan — persistence is unchanged.
 */

import { useMemo, useState } from 'react';
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
import { useAdmissionSetupCycle } from '../hooks/useAdmissionSetupCycle';
import { useCategoryConfigs } from '../api/applicationSettings.queries';

function isApplicantCategoryKey(code: string): code is ApplicantCategoryKey {
  return (APPLICANT_CATEGORY_KEYS as readonly string[]).includes(code);
}

export function ExamsManagementPage(): JSX.Element {
  const { cycle } = useAdmissionSetupCycle();
  return (
    <AdmissionSetupShell>
      {!cycle ? <NoCycle /> : <Body cycle={cycle} />}
    </AdmissionSetupShell>
  );
}

function Body({ cycle }: { cycle: AdmissionCycle }): JSX.Element {
  const configsQuery = useCategoryConfigs();

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
            <Tabs.Panel key={cat.key} value={cat.key}>
              <div className="pt-2">
                <ExamPlanEditor cycleId={cycle.id} categoryId={cat.key} />
              </div>
            </Tabs.Panel>
          ))}
        </Tabs>
      </Card>
    </div>
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
