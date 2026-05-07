import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Download, UserPlus } from 'lucide-react';
import { PageHeader, Card, Avatar, Button, EmptyState, Badge, DataTable, SearchSelect } from '@/shared/components';
import type { DataTableColumn, SearchSelectOption } from '@/shared/components';
import { StatusBadge, PaymentBadge } from '@/shared/components/StatusBadge';
import { useApplicants } from '@/features/applicants/api/applicant.queries';
import { ROUTES } from '@/config/routes';
import { MOCK } from '@/shared/mock-data';
import { date as fmtDate, shortName, maskNationalId } from '@/shared/lib/format';
import { STATUS_LABELS } from '@/shared/mock-data/dictionaries';
import type { Applicant, ApplicantStatus } from '@/shared/types/domain';

const PAGE_SIZE = 15;

const GOVERNORATE_OPTIONS: readonly SearchSelectOption[] = MOCK.governorates.map((g) => ({
  value: g,
  label: g,
}));

const APPLICANT_COLUMNS: DataTableColumn<Applicant>[] = [
  {
    key: 'name',
    label: 'المتقدم',
    render: (a) => (
      <Link to={ROUTES.admin.applicantDetail(a.id)} className="flex items-center gap-3">
        <Avatar name={a.name} size="sm" />
        <div className="flex flex-col">
          <span className="text-sm font-medium text-ink-900">{shortName(a.name, 3)}</span>
          <span className="font-mono text-2xs text-ink-500" dir="ltr">{a.id}</span>
        </div>
      </Link>
    ),
  },
  { key: 'nationalId', label: 'الرقم القومي', render: (a) => <span className="font-mono" dir="ltr">{maskNationalId(a.nationalId)}</span>, hideOn: 'sm' },
  { key: 'governorate', label: 'المحافظة', render: (a) => a.governorate, hideOn: 'sm' },
  {
    key: 'certType',
    label: 'الشهادة',
    render: (a) => (
      <div className="text-2xs">
        <p className="text-ink-700">{a.certType}</p>
        <p className="text-ink-500">{a.certSection}</p>
      </div>
    ),
    hideOn: 'md',
  },
  { key: 'paymentStatus', label: 'الدفع', render: (a) => <PaymentBadge status={a.paymentStatus} /> },
  { key: 'stageLabel', label: 'المرحلة', render: (a) => <Badge tone="info">{a.stageLabel}</Badge>, hideOn: 'md' },
  { key: 'status', label: 'الحالة', render: (a) => <StatusBadge status={a.status} /> },
  { key: 'registeredAt', label: 'التسجيل', render: (a) => <span className="text-2xs text-ink-500">{fmtDate(a.registeredAt, 'short')}</span>, hideOn: 'sm' },
];

export function ApplicantsPage(): JSX.Element {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ApplicantStatus | 'all'>('all');
  const [governorate, setGovernorate] = useState<string>('all');
  const [certType, setCertType] = useState<string>('all');

  const { data, isLoading } = useApplicants({
    page,
    pageSize: PAGE_SIZE,
    search,
    status,
    governorate,
    certType,
  });

  return (
    <>
      <PageHeader
        title="إدارة المتقدمين"
        subtitle="بحث وتصفية وإدارة طلبات التقدم"
        actions={
          <>
            <Link
              to={ROUTES.admin.applicantNew}
              className="btn btn-primary"
            >
              <UserPlus size={14} strokeWidth={1.75} className="me-1.5" />
              متقدم جديد
            </Link>
            <Button variant="secondary" leadingIcon={<Download size={16} />}>
              تصدير CSV
            </Button>
          </>
        }
      />

      <Card>
        <div className="card-body">
          <div className="filters">
            <div className="search flex-1">
              <input className="input" type="search" placeholder="بحث بالاسم / الرقم القومي / كود التقدم" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
              <Search size={18} />
            </div>
            <select className="select" value={status} onChange={(e) => { setStatus(e.target.value as ApplicantStatus | 'all'); setPage(1); }}>
              <option value="all">كل الحالات</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <div className="min-w-[180px] flex-[0_1_200px]">
              <SearchSelect
                value={governorate === 'all' ? null : governorate}
                onChange={(next) => {
                  setGovernorate(next ?? 'all');
                  setPage(1);
                }}
                options={GOVERNORATE_OPTIONS}
                ariaLabel="تصفية حسب المحافظة"
                placeholder="كل المحافظات"
                className="h-[38px]"
              />
            </div>
            <select className="select" value={certType} onChange={(e) => { setCertType(e.target.value); setPage(1); }}>
              <option value="all">كل الشهادات</option>
              <option value="ثانوية عامة">ثانوية عامة</option>
              <option value="ثانوية أزهرية">ثانوية أزهرية</option>
            </select>
          </div>

          <DataTable<Applicant>
            data={data?.data ?? []}
            columns={APPLICANT_COLUMNS}
            rowKey={(a) => a.id}
            loading={isLoading}
            empty={<EmptyState title="لا توجد نتائج" description="جرّب تعديل عوامل التصفية" />}
            zebraStripes
            stickyHeader
            density="compact"
            pagination={data ? { page: data.page, pageSize: PAGE_SIZE, total: data.total, onPageChange: setPage } : undefined}
          />
        </div>
      </Card>
    </>
  );
}
