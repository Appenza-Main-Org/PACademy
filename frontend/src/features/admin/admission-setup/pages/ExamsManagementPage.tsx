/**
 * Step 7 — إدارة الاختبارات.
 * Per-open-category exam plan editor — embeds ExamPlanEditor (Gap J)
 * with a category tab strip filtered to the cycle's open categories.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { ExamPlanEditor } from '@/features/admin/components/exams/ExamPlanEditor';
import { useCategoriesAdmin } from '@/features/admin/api/categories.queries';
import type { AdmissionCycle, ApplicantCategoryKey } from '@/shared/types/domain';
import { AdmissionSetupShell } from '../components/AdmissionSetupShell';
import { useAdmissionSetupCycle } from '../hooks/useAdmissionSetupCycle';

export function ExamsManagementPage(): JSX.Element {
  const { cycle } = useAdmissionSetupCycle();
  return (
    <AdmissionSetupShell>
      {!cycle ? <NoCycle /> : <Body cycle={cycle} />}
    </AdmissionSetupShell>
  );
}

function Body({ cycle }: { cycle: AdmissionCycle }): JSX.Element {
  const { data: categories = [] } = useCategoriesAdmin();
  const openKeys = useMemo(
    () =>
      Object.entries(cycle.openCategories ?? {})
        .filter(([, c]) => c?.isOpen)
        .map(([k]) => k as ApplicantCategoryKey),
    [cycle.openCategories],
  );
  const openCategories = categories.filter((c) => openKeys.includes(c.key));
  const [active, setActive] = useState<ApplicantCategoryKey | null>(openKeys[0] ?? null);

  /* Re-anchor when the cycle changes its open set. */
  useEffect(() => {
    if (active && openKeys.includes(active)) return;
    setActive(openKeys[0] ?? null);
  }, [openKeys, active]);

  if (openCategories.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="إدارة الاختبارات" subtitle="ترتيب الاختبارات وإلزاميتها لكل فئة." />
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
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="إدارة الاختبارات" subtitle="حدّد ترتيب الاختبارات وإلزاميتها ورسومها لكل فئة." />
      <Card>
        <div className="grid gap-2 md:grid-cols-3">
          {openCategories.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setActive(cat.key)}
              className={
                'rounded-md border px-3 py-2 text-start text-sm transition-colors duration-fast ease-standard ' +
                (active === cat.key
                  ? 'border-teal-500 bg-teal-50 text-teal-700'
                  : 'border-border-default bg-surface-card text-ink-700 hover:bg-ink-50')
              }
            >
              {cat.labelAr}
            </button>
          ))}
        </div>
        {active && (
          <div className="mt-4">
            <ExamPlanEditor cycleId={cycle.id} categoryId={active} />
          </div>
        )}
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
