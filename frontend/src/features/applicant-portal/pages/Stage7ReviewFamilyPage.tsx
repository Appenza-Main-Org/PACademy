/**
 * Stage 7 review — عرض واعتماد بيانات العائلة.
 *
 * Standalone wizard step that surfaces the family summary table + the
 * final اعتماد action. Reads its data from the sessionStorage snapshot
 * persisted by `Stage7FamilyPage` so the two pages stay independent.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Info, Pencil, ShieldCheck, Users } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  IconStamp,
  PageHeader,
  toast,
} from '@/shared/components';
import type { DataTableColumn } from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { useApplicantPortalStore } from '../store/applicantPortal.store';
import { useApproveParentsMutation } from '../api/applicantPortal.queries';
import { MOI_APPLICANT_SESSION } from '../lib/moi-session.mock';
import {
  buildFamilyRows,
  canApproveFamilySnapshot,
  loadFamilySnapshot,
  type FamilyDataSnapshot,
  type FamilyViewRow,
} from '../lib/familyData';

const APPLICANT_ID = MOI_APPLICANT_SESSION.applicantId;

export function Stage7ReviewFamilyPage(): JSX.Element {
  const navigate = useNavigate();
  const setParentsApproved = useApplicantPortalStore((s) => s.setParentsApproved);
  const approveMut = useApproveParentsMutation(APPLICANT_ID);

  const [snapshot, setSnapshot] = useState<FamilyDataSnapshot | null>(null);

  useEffect(() => {
    setSnapshot(loadFamilySnapshot());
  }, []);

  const rows: readonly FamilyViewRow[] = useMemo(
    () => (snapshot ? buildFamilyRows(snapshot) : []),
    [snapshot],
  );
  const canApprove = snapshot ? canApproveFamilySnapshot(snapshot) : false;

  const columns: DataTableColumn<FamilyViewRow>[] = useMemo(
    () => [
      {
        key: 'serial',
        label: 'م',
        width: '56px',
        render: (r) => <span className="font-numeric tnum">{r.serial}</span>,
      },
      { key: 'name', label: 'الإسم', render: (r) => r.name },
      { key: 'relation', label: 'درجة القرابة', render: (r) => r.relation },
      { key: 'profession', label: 'المهنة', render: (r) => r.profession },
      {
        key: 'saved',
        label: 'الحالة',
        render: (r) =>
          r.saved ? (
            <Badge tone="success">
              <Check size={11} strokeWidth={1.75} className="me-1 inline-block" />
              محفوظ
            </Badge>
          ) : (
            <Badge tone="warning">لم يُحفَظ</Badge>
          ),
      },
    ],
    [],
  );

  const onApprove = async (): Promise<void> => {
    if (!snapshot || !canApprove) return;
    await approveMut.mutateAsync();
    setParentsApproved(true);
    toast('تم اعتماد بيانات العائلة', 'success');
    navigate(ROUTES.applicantExamSchedule);
  };

  if (!snapshot) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title="عرض واعتماد بيانات العائلة"
          breadcrumbs={[
            { label: 'بوابة المتقدم', href: ROUTES.applicant },
            { label: 'بيانات العائلة', href: ROUTES.applicantFamily },
            { label: 'عرض واعتماد' },
          ]}
        />
        <Card>
          <EmptyState
            variant="generic"
            title="لا توجد بيانات للعرض"
            description="ابدأ بإدخال بيانات العائلة في الخطوة السابقة قبل عرضها هنا."
            action={
              <Button variant="primary" onClick={() => navigate(ROUTES.applicantFamily)}>
                العودة لإدخال البيانات
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="عرض واعتماد بيانات العائلة"
        breadcrumbs={[
          { label: 'بوابة المتقدم', href: ROUTES.applicant },
          { label: 'بيانات العائلة', href: ROUTES.applicantFamily },
          { label: 'عرض واعتماد' },
        ]}
      />

      <Card>
        <header className="flex items-start gap-3">
          <span
            aria-hidden
            className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-teal-50 text-teal-700"
          >
            <Users size={20} strokeWidth={1.75} />
          </span>
          <div className="flex-1">
            <h2 className="font-ar-display text-xl font-bold text-ink-900">
              مراجعة بيانات العائلة قبل الاعتماد
            </h2>
            <p className="mt-1 text-sm leading-normal text-ink-500">
              راجع الجدول أدناه بدقة. يمكنك العودة للتعديل من خلال زر «تعديل البيانات»،
              وعند التأكد اضغط «اعتماد» للانتقال إلى تحديد موعد الإختبار.
            </p>
          </div>
        </header>
      </Card>

      <Card>
        <header className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-ar-display text-md font-bold text-ink-900">
            ملخّص بيانات العائلة
          </h3>
          <Badge tone={canApprove ? 'success' : 'neutral'}>
            {canApprove ? (
              <>
                <ShieldCheck size={11} strokeWidth={1.75} className="me-1 inline-block" />
                جاهز للاعتماد
              </>
            ) : (
              <>
                <Info size={11} strokeWidth={1.75} className="me-1 inline-block" />
                أكمل البيانات المطلوبة
              </>
            )}
          </Badge>
        </header>
        <DataTable<FamilyViewRow>
          data={[...rows]}
          columns={columns}
          rowKey={(r) => `${r.relation}-${r.serial}`}
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-2xs text-ink-500">
            بعد اعتماد البيانات لا يمكن تعديل التبويبات إلا بإجراء إداري.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="lg"
              leadingIcon={<Pencil size={14} strokeWidth={1.75} />}
              onClick={() => navigate(ROUTES.applicantFamily)}
            >
              تعديل البيانات
            </Button>
            <Button
              variant="primary"
              size="lg"
              disabled={!canApprove}
              isLoading={approveMut.isPending}
              onClick={onApprove}
              leadingIcon={<IconStamp width={14} height={14} />}
              trailingIcon={<ArrowRight size={16} strokeWidth={1.75} />}
            >
              اعتماد
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
