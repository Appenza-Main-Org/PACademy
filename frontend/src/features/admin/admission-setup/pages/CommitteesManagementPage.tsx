/**
 * إدارة مواعيد الاختبارات واللجان — wizard step.
 *
 * Renders the step's two affordances — «إضافة» and «عرض» — as horizontal
 * tabs so both are visible at once and a single click flips between them.
 * The `?sub=` search param mirrors the active tab so deep-links and the
 * browser Back button still behave (default = «عرض»).
 */

import { useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  Badge,
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

type SubPage = 'view' | 'add';

/** Cycles only declare `year`; the academic year string is `${year}-${year+1}`. */
function academicYearForCycle(cycle: AdmissionCycle): string {
  return `${cycle.year}-${cycle.year + 1}`;
}

function isApplicantCategoryKey(code: string): code is ApplicantCategoryKey {
  return (APPLICANT_CATEGORY_KEYS as readonly string[]).includes(code);
}

function readSubPage(raw: string | null): SubPage {
  return raw === 'add' ? 'add' : 'view';
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

  return <CommitteesTabs cycle={cycle} active={active} />;
}

interface CommitteesTabsProps {
  cycle: AdmissionCycle;
  active: Array<{ key: ApplicantCategoryKey; labelAr: string }>;
}

function CommitteesTabs({ cycle, active }: CommitteesTabsProps): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const sub = readSubPage(searchParams.get('sub'));
  const approvedCount = useAdmissionSetupWizardStore((s) => s.approved.length);

  /* Mutate only the `sub` param so we don't clobber other state on the
   * URL (the wizard's :stepKey lives in the path, not the search). */
  const onTabChange = useCallback(
    (next: string) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next === 'view') {
            params.delete('sub');
          } else {
            params.set('sub', next);
          }
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const academicYear = academicYearForCycle(cycle);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="إدارة مواعيد الاختبارات واللجان"
        subtitle={`العام الأكاديمي ${academicYear} · ${
          approvedCount > 0
            ? `${num(approvedCount)} قاعدة معتمدة`
            : 'لا توجد قواعد معتمدة بعد.'
        }`}
        actions={
          <div className="flex items-center gap-2">
            {approvedCount > 0 && (
              <Badge tone="info">{num(approvedCount)} قاعدة</Badge>
            )}
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
          </div>
        }
      />

      <Tabs value={sub} onValueChange={onTabChange}>
        <Tabs.List aria-label="إضافة موعد أو عرض القواعد المعتمدة">
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
