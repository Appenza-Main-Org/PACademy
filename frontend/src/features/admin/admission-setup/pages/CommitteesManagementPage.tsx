/**
 * إدارة مواعيد الاختبارات واللجان — wizard step.
 *
 * Renders the step's two affordances — «إضافة» and «عرض» — as distinct
 * sub-pages under the step header instead of tabs. The `?sub=` search
 * param drives which sub-page renders so the browser Back button and
 * bookmarks behave like a real navigation. Default (no param) is the
 * «عرض» landing — the master view — with a primary action that
 * navigates to the «إضافة» sub-page.
 */

import { useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Plus } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingState,
  PageHeader,
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
import { toEasternArabicNumerals } from '@/shared/lib/arabic';
import { getStepByKey } from '../config';

type SubPage = 'view' | 'add';

/* «إضافة» = sub-step 4.1, «عرض» = sub-step 4.2 — the parent step number
 * is derived from config so a future reorder of `ADMISSION_SETUP_STEPS`
 * stays consistent without hand-editing this file. */
const COMMITTEES_STEP_ORDER = getStepByKey('committees').order;
function subStepLabel(sub: SubPage): string {
  const subIndex = sub === 'add' ? 1 : 2;
  return `الخطوة ${toEasternArabicNumerals(COMMITTEES_STEP_ORDER)}٫${toEasternArabicNumerals(subIndex)}`;
}

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

  return <SubPageRouter cycle={cycle} active={active} />;
}

interface SubPageRouterProps {
  cycle: AdmissionCycle;
  active: Array<{ key: ApplicantCategoryKey; labelAr: string }>;
}

function SubPageRouter({ cycle, active }: SubPageRouterProps): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const sub = readSubPage(searchParams.get('sub'));
  const approvedCount = useAdmissionSetupWizardStore((s) => s.approved.length);

  /* Mutate only the `sub` param so we don't clobber other state on the
   * URL (the wizard's :stepKey lives in the path, not the search). */
  const goToSub = useCallback(
    (next: SubPage) => {
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
        { replace: false },
      );
    },
    [setSearchParams],
  );

  const academicYear = academicYearForCycle(cycle);

  if (sub === 'add') {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title={
            <span className="flex flex-wrap items-center gap-2">
              <span>إضافة موعد اختبار</span>
              <Badge tone="info">
                <span className="font-numeric tnum">{subStepLabel('add')}</span>
              </Badge>
            </span>
          }
          subtitle={`العام الأكاديمي ${academicYear} · أضف موعدًا لفئة واحدة أو أكثر معًا.`}
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => goToSub('view')}
              leadingIcon={
                <ArrowRight size={14} strokeWidth={1.75} className="rtl:scale-x-[-1]" />
              }
            >
              الرجوع إلى العرض
            </Button>
          }
        />
        <Card>
          <div className="p-3">
            <CommitteeBindingsPanel cycle={cycle} active={active} />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span>إدارة مواعيد الاختبارات واللجان</span>
            <Badge tone="info">
              <span className="font-numeric tnum">{subStepLabel('view')}</span>
            </Badge>
          </span>
        }
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
            <Button
              variant="primary"
              size="sm"
              onClick={() => goToSub('add')}
              leadingIcon={<Plus size={14} strokeWidth={1.75} />}
            >
              إضافة موعد جديد
            </Button>
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
      <ApprovedRulesView />
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
