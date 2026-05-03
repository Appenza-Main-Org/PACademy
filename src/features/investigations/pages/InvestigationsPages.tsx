/**
 * InvestigationsCasesPage — primary `/investigations` landing.
 * Source: AUD-001 (P0 fix — link list rows to /investigations/cases/:id).
 *
 * Uses the new InvestigationCase shape (`CASE-XXXXX` ids) and the shared
 * DataTable so every row is clickable and navigates to the detail page.
 *
 * IncomingPage / OutgoingPage are kept as thin filtered views for the
 * older sidebar entries.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Briefcase, Hourglass, Plus, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  CardBody,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  Select,
  StatCard,
} from '@/shared/components';
import type { DataTableColumn } from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { investigationsService } from '../api/investigations.service';
import { date as fmtDate, num, shortName } from '@/shared/lib/format';
import { ROUTES } from '@/config/routes';
import type { CasePriority, CaseStatus, InvestigationCase } from '@/shared/types/domain';

const STATUS_LABEL: Record<CaseStatus, string> = {
  open: 'مفتوحة',
  'in-review': 'قيد المراجعة',
  pass: 'إفراج',
  fail: 'إيقاف',
  'defer-conditional': 'تأجيل بشرط',
};

const STATUS_TONE: Record<CaseStatus, 'warning' | 'info' | 'success' | 'danger'> = {
  open: 'warning',
  'in-review': 'info',
  pass: 'success',
  fail: 'danger',
  'defer-conditional': 'warning',
};

const PRIORITY_LABEL: Record<CasePriority, string> = {
  low: 'منخفضة',
  medium: 'متوسطة',
  high: 'مرتفعة',
  critical: 'حرجة',
};

const PRIORITY_TONE: Record<CasePriority, 'neutral' | 'info' | 'warning' | 'danger'> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  critical: 'danger',
};

export function InvestigationsCasesPage(): JSX.Element {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<CaseStatus | 'all'>('all');

  const { data: cases, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['investigations', 'cases-v2', statusFilter],
    queryFn: () => investigationsService.list({ status: statusFilter }),
  });
  const { data: stats } = useQuery({
    queryKey: ['investigations', 'stats-v2'],
    queryFn: () => investigationsService.stats(),
  });

  const columns: DataTableColumn<InvestigationCase>[] = [
    {
      key: 'id',
      label: 'القضية',
      width: 110,
      render: (c) => (
        <Link to={ROUTES.investigations.detail(c.id)} className="font-mono font-medium text-terra-700 hover:underline" dir="ltr">
          {c.id}
        </Link>
      ),
    },
    {
      key: 'applicant',
      label: 'المتقدم',
      render: (c) => (
        <div>
          <p className="text-sm font-medium text-ink-900">{shortName(c.applicantName, 3)}</p>
          <p className="text-2xs text-ink-500 font-mono" dir="ltr">{c.applicantId}</p>
        </div>
      ),
    },
    { key: 'caseType', label: 'النوع', render: (c) => CASE_TYPE_LABEL[c.caseType], hideOn: 'sm' },
    {
      key: 'assignedTo',
      label: 'المحقّق',
      render: (c) => <span className="text-2xs text-ink-700 font-mono" dir="ltr">{c.assignedTo}</span>,
      hideOn: 'sm',
    },
    {
      key: 'priority',
      label: 'الأولوية',
      render: (c) => <Badge tone={PRIORITY_TONE[c.priority]}>{PRIORITY_LABEL[c.priority]}</Badge>,
    },
    {
      key: 'dueDate',
      label: 'الاستحقاق',
      render: (c) => <span className="text-2xs text-ink-500">{fmtDate(c.dueDate, 'short')}</span>,
      hideOn: 'md',
    },
    {
      key: 'status',
      label: 'الحالة',
      render: (c) => <Badge tone={STATUS_TONE[c.status]} dot={c.status === 'open' || c.status === 'in-review'}>{STATUS_LABEL[c.status]}</Badge>,
    },
  ];

  return (
    <CenteredShell>
      <PageHeader
        title="ملفات التحريات"
        subtitle="جميع القضايا الجارية والمنتهية · انقر صفّاً لفتح ملف القضية"
        actions={
          <Link to={ROUTES.investigations.create}>
            <Button variant="primary" leadingIcon={<Plus size={14} strokeWidth={1.75} />}>
              فتح قضية جديدة
            </Button>
          </Link>
        }
      />

      <div
        className="mb-6 grid gap-5"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
      >
        <StatCard label="إجمالي القضايا" value={stats?.total ?? 0} icon={<Briefcase size={16} strokeWidth={1.75} />} />
        <StatCard label="مفتوحة"          value={stats?.open ?? 0}  icon={<Hourglass size={16} strokeWidth={1.75} />} />
        <StatCard label="قيد المراجعة"     value={stats?.inReview ?? 0} icon={<ShieldAlert size={16} strokeWidth={1.75} />} />
        <StatCard label="تم الإفراج"      value={stats?.pass ?? 0}  icon={<ShieldCheck size={16} strokeWidth={1.75} />} />
        <StatCard label="تم الإيقاف"      value={stats?.fail ?? 0}  icon={<AlertTriangle size={16} strokeWidth={1.75} />} />
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <Select
            aria-label="فلتر الحالة"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CaseStatus | 'all')}
            options={[
              { value: 'all', label: 'كل الحالات' },
              ...Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l })),
            ]}
            containerClassName="max-w-xs"
          />
          <span className="text-2xs text-ink-500">
            <span className="font-numeric tnum">{num(cases?.length ?? 0)}</span> قضية
          </span>
        </div>
        <DataTable
          data={cases ?? []}
          columns={columns}
          rowKey={(c) => c.id}
          loading={isLoading}
          error={isError ? <ErrorState error={error} onRetry={() => refetch()} /> : undefined}
          empty={<EmptyState variant="no-cases" />}
          onRowClick={(c) => navigate(ROUTES.investigations.detail(c.id))}
          zebraStripes
          stickyHeader
          density="compact"
        />
      </Card>
    </CenteredShell>
  );
}

const CASE_TYPE_LABEL: Record<InvestigationCase['caseType'], string> = {
  'committee-A': 'لجنة (أ)',
  'committee-C': 'لجنة (ج)',
  'data-review': 'مراجعة',
};

/* Sub-page filtered views — kept for sidebar parity. */
export function IncomingPage(): JSX.Element {
  return (
    <CenteredShell>
      <PageHeader title="الوارد" subtitle="ملفات تم استلامها من قطاع الأمن العام" />
      <Card>
        <CardBody>
          <p className="text-sm text-ink-500">
            استخدم صفحة "كل القضايا" مع فلتر «قيد المراجعة» لعرض القضايا الواردة.
          </p>
        </CardBody>
      </Card>
    </CenteredShell>
  );
}

export function OutgoingPage(): JSX.Element {
  return (
    <CenteredShell>
      <PageHeader title="الصادر — Legacy" subtitle="موجَّهة لـ /investigations/outgoing الجديدة (الكتب الرسمية)" />
      <Card>
        <CardBody>
          <p className="text-sm text-ink-500">
            انتقل إلى <Link to={ROUTES.investigations.outgoing} className="font-medium text-teal-700 hover:underline">صفحة الصادر</Link> لإدارة الكتب الرسمية.
          </p>
        </CardBody>
      </Card>
    </CenteredShell>
  );
}
