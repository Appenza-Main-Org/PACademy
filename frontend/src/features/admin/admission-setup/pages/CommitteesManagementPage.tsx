/**
 * إدارة مواعيد الاختبارات واللجان — wizard step.
 *
 * Renders `CommitteeBindingsPanel` once with the cycle's active
 * categories surfaced as a multi-select inside the panel's form (no
 * per-category tabs at the page level any more).
 *
 * Active-category source is `useCategoryConfigs()` filtered by
 * `isActive === true`, surfaced via the shared `useActiveCategoriesForCycle`
 * helper.
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  Button,
  Card,
  EmptyState,
  LoadingState,
  PageHeader,
  Tabs,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import {
  APPLICANT_CATEGORY_KEYS,
  type AdmissionCycle,
  type ApplicantCategoryKey,
} from '@/shared/types/domain';
import { AdmissionSetupShell } from '../components/AdmissionSetupShell';
import { useAdmissionSetupCycle } from '../hooks/useAdmissionSetupCycle';
import { useActiveCategoriesForCycle } from '../lib/activeCategories';
import { CommitteeBindingsPanel } from '../components/committeeBinding/CommitteeBindingsPanel';
import { ApprovedRulesView } from '../components/committeeBinding/ApprovedRulesView';
import { useAdmissionSetupWizardStore } from '../store/wizardSharedState';
import { num } from '@/shared/lib/format';

/** Cycles only declare `year`; the academic year string is `${year}-${year+1}`. */
function academicYearForCycle(cycle: AdmissionCycle): string {
  return `${cycle.year}-${cycle.year + 1}`;
}

function isApplicantCategoryKey(code: string): code is ApplicantCategoryKey {
  return (APPLICANT_CATEGORY_KEYS as readonly string[]).includes(code);
}

export function CommitteesManagementPage(): JSX.Element {
  const { cycle } = useAdmissionSetupCycle();
  return (
    <AdmissionSetupShell>
      {!cycle ? <NoCycle /> : <Body cycle={cycle} />}
    </AdmissionSetupShell>
  );
}

interface BodyProps {
  cycle: AdmissionCycle;
}

function Body({ cycle }: BodyProps): JSX.Element {
  const activeQuery = useActiveCategoriesForCycle(cycle.id);
  const active = useMemo(
    () =>
      (activeQuery.data ?? [])
        .filter((c) => isApplicantCategoryKey(c.code))
        .map((c) => ({
          key: c.code as ApplicantCategoryKey,
          labelAr: c.nameAr,
        })),
    [activeQuery.data],
  );

  if (activeQuery.isLoading) {
    return <LoadingState variant="card-grid" />;
  }

  if (active.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title="إدارة مواعيد الاختبارات واللجان"
          subtitle="اختر اللجان التي ستستقبل المتقدمين في هذه الدورة."
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
        title="إدارة مواعيد الاختبارات واللجان"
        subtitle={`العام الأكاديمي ${academicYearForCycle(cycle)} · أضف موعد اختبار لفئة واحدة أو أكثر معًا.`}
        actions={
          <Link to={ROUTES.committee.list} className="inline-flex">
            <Button
              variant="ghost"
              size="sm"
              trailingIcon={
                <ArrowLeft size={14} strokeWidth={1.75} className="rtl:scale-x-[-1]" />
              }
            >
              إدارة اللجان الكاملة
            </Button>
          </Link>
        }
      />
      <CommitteesTabs cycle={cycle} active={active} />
    </div>
  );
}

interface CommitteesTabsProps {
  cycle: AdmissionCycle;
  active: Array<{ key: ApplicantCategoryKey; labelAr: string }>;
}

function CommitteesTabs({ cycle, active }: CommitteesTabsProps): JSX.Element {
  const approvedCount = useAdmissionSetupWizardStore((s) => s.approved.length);
  return (
    <Tabs defaultValue="add">
      <Tabs.List>
        <Tabs.Tab value="add">إضافة</Tabs.Tab>
        <Tabs.Tab value="view" badge={approvedCount > 0 ? num(approvedCount) : undefined}>
          عرض
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="add">
        <Card>
          <div className="p-3">
            <CommitteeBindingsPanel cycle={cycle} active={active} />
          </div>
        </Card>
      </Tabs.Panel>
      <Tabs.Panel value="view">
        <ApprovedRulesView />
      </Tabs.Panel>
    </Tabs>
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
