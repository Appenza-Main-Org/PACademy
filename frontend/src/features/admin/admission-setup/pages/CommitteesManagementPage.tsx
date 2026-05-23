/**
 * إدارة مواعيد الاختبارات واللجان — wizard step.
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
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
  type AdmissionCycle,
} from '@/shared/types/domain';
import { AdmissionSetupShell } from '../components/AdmissionSetupShell';
import { useAdmissionSetupCycle } from '../hooks/useAdmissionSetupCycle';
import { useActiveCategoriesForCycle } from '../lib/activeCategories';
import { CommitteeBindingsPanel } from '../components/committeeBinding/CommitteeBindingsPanel';
import { useAdmissionSetupWizardStore } from '../store/wizardSharedState';
import { num } from '@/shared/lib/format';

/** Cycles only declare `year`; the academic year string is `${year}-${year+1}`. */
function academicYearForCycle(cycle: AdmissionCycle): string {
  return `${cycle.year}-${cycle.year + 1}`;
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
        .map((c) => ({
          key: c.code,
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

  return <CommitteesContent cycle={cycle} active={active} />;
}

interface CommitteesContentProps {
  cycle: AdmissionCycle;
  active: Array<{ key: string; labelAr: string }>;
}

function CommitteesContent({ cycle, active }: CommitteesContentProps): JSX.Element {
  const approvedCount = useAdmissionSetupWizardStore((s) => s.approved.length);
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
            <Link to={ROUTES.admin.adminLookupsType('committees')} className="inline-flex">
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

      <Card>
        <div className="p-3">
          <CommitteeBindingsPanel cycle={cycle} active={active} />
        </div>
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
