import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, UserPlus } from 'lucide-react';
import {
  Avatar,
  Badge,
  Card,
  DataTable,
  EmptyState,
  PageHeader,
  SearchSelect,
  Select,
  buttonClassName,
} from '@/shared/components';
import type { DataTableColumn, ListActionsConfig, SearchSelectOption } from '@/shared/components';
import { PaymentBadge } from '@/shared/components/StatusBadge';
import { useApplicants, useApplicantStatusOptions } from '@/features/applicants/api/applicant.queries';
import { useLookup } from '@/features/lookups';
import { ROUTES } from '@/config/routes';
import { date as fmtDate, shortName, maskNationalId } from '@/shared/lib/format';
import type { Applicant, ApplicantStatus } from '@/shared/types/domain';

const PAGE_SIZE = 15;

const CERT_TYPE_OPTIONS: readonly SearchSelectOption[] = [
  { value: 'ثانوية عامة', label: 'ثانوية عامة' },
  { value: 'ثانوية أزهرية', label: 'ثانوية أزهرية' },
];

export function ApplicantsPage(): JSX.Element {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ApplicantStatus | 'all'>('all');
  const [governorate, setGovernorate] = useState<string>('all');
  const [certType, setCertType] = useState<string>('all');
  const governoratesQuery = useLookup('governorates');
  const statusOptionsQuery = useApplicantStatusOptions();
  const statusOptions = useMemo(
    () => (statusOptionsQuery.data ?? []).map((item) => ({ value: item.value, label: item.label })),
    [statusOptionsQuery.data],
  );
  const statusByValue = useMemo(
    () => new Map((statusOptionsQuery.data ?? []).map((item) => [item.value, item])),
    [statusOptionsQuery.data],
  );
  const governorateOptions = useMemo<readonly SearchSelectOption[]>(
    () =>
      (governoratesQuery.data ?? [])
        .filter((row) => row.isActive)
        .map((row) => ({ value: row.name, label: row.name })),
    [governoratesQuery.data],
  );

  const { data, isLoading } = useApplicants({
    page,
    pageSize: PAGE_SIZE,
    search,
    status,
    governorate,
    certType,
  });

  const columns: DataTableColumn<Applicant>[] = useMemo(
    () => [
      {
        key: 'name',
        label: 'المتقدم',
        sortable: true,
        getSortValue: (a) => a.name,
        filter: { kind: 'text', getValue: (a) => a.name },
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
      {
        key: 'nationalId',
        label: 'الرقم القومي',
        hideOn: 'sm',
        sortable: true,
        getSortValue: (a) => a.nationalId,
        filter: { kind: 'text', getValue: (a) => a.nationalId },
        render: (a) => <span className="font-mono" dir="ltr">{maskNationalId(a.nationalId)}</span>,
      },
      {
        key: 'governorate',
        label: 'المحافظة',
        hideOn: 'sm',
        sortable: true,
        getSortValue: (a) => a.governorate,
        filter: { kind: 'text', getValue: (a) => a.governorate },
        render: (a) => a.governorate,
      },
      {
        key: 'certType',
        label: 'الشهادة',
        hideOn: 'md',
        sortable: true,
        getSortValue: (a) => a.certType,
        filter: { kind: 'text', getValue: (a) => a.certType },
        render: (a) => (
          <div className="text-2xs">
            <p className="text-ink-700">{a.certType}</p>
            <p className="text-ink-500">{a.certSection}</p>
          </div>
        ),
      },
      {
        key: 'paymentStatus',
        label: 'الدفع',
        sortable: true,
        getSortValue: (a) => a.paymentStatus,
        filter: {
          kind: 'enum',
          getValue: (a) => a.paymentStatus,
          options: [
            { value: 'paid', label: 'مدفوع' },
            { value: 'pending', label: 'معلّق' },
          ],
        },
        render: (a) => <PaymentBadge status={a.paymentStatus} />,
      },
      {
        key: 'stageLabel',
        label: 'المرحلة',
        hideOn: 'md',
        sortable: true,
        getSortValue: (a) => a.stageLabel,
        filter: { kind: 'text', getValue: (a) => a.stageLabel },
        render: (a) => <Badge tone="info">{a.stageLabel}</Badge>,
      },
      {
        key: 'status',
        label: 'الحالة',
        sortable: true,
        getSortValue: (a) => a.status,
        filter: {
          kind: 'enum',
          getValue: (a) => a.status,
          options: statusOptions,
        },
        render: (a) => {
          const def = statusByValue.get(a.status);
          const live = a.status === 'pending' || a.status === 'under-review';
          return <Badge tone={def?.color ?? 'neutral'} dot={live}>{def?.label ?? a.status}</Badge>;
        },
      },
      {
        key: 'registeredAt',
        label: 'التسجيل',
        hideOn: 'sm',
        sortable: true,
        getSortValue: (a) => a.registeredAt,
        filter: { kind: 'date', getValue: (a) => a.registeredAt },
        render: (a) => <span className="text-2xs text-ink-500">{fmtDate(a.registeredAt, 'short')}</span>,
      },
    ],
    [statusByValue, statusOptions],
  );

  const listActions: ListActionsConfig<Applicant> = useMemo(
    () => ({
      entityKey: 'admin.applicants',
      entityLabelAr: 'قائمة المتقدمين',
      auditModule: 'applicants',
      export: {
        enabled: true,
        formats: ['csv', 'xlsx'],
        filenamePrefix: 'متقدمين-',
        columns: [
          { key: 'id', labelAr: 'كود التقدم' },
          { key: 'nationalId', labelAr: 'الرقم القومي' },
          { key: 'name', labelAr: 'الاسم' },
          {
            key: 'gender',
            labelAr: 'النوع',
            format: (v) => (v === 'male' ? 'ذكر' : 'أنثى'),
          },
          { key: 'governorate', labelAr: 'المحافظة' },
          { key: 'certType', labelAr: 'نوع الشهادة' },
          { key: 'certPercent', labelAr: 'النسبة المئوية' },
          {
            key: 'paymentStatus',
            labelAr: 'حالة الدفع',
            format: (v) => (v === 'paid' ? 'مدفوع' : 'معلّق'),
          },
          { key: 'stageLabel', labelAr: 'المرحلة الحالية' },
          {
            key: 'status',
            labelAr: 'الحالة',
            format: (v) => statusByValue.get(v as ApplicantStatus)?.label ?? String(v ?? ''),
          },
          {
            key: 'registeredAt',
            labelAr: 'تاريخ التسجيل',
            format: (v) => fmtDate(String(v), 'short'),
          },
        ],
      },
    }),
    [statusByValue],
  );

  return (
    <>
      <PageHeader
        title="إدارة المتقدمين"
        subtitle="بحث وتصفية وإدارة طلبات التقدم"
        actions={
          <Link
            to={ROUTES.admin.applicantNew}
            className={buttonClassName({ variant: 'primary' })}
          >
            <UserPlus size={14} strokeWidth={1.75} />
            إضافة متقدم
          </Link>
        }
      />

      <Card>
        <div className="card-body">
          <div className="filters">
            <div className="search flex-1">
              <input className="input" type="search" placeholder="بحث بالاسم / الرقم القومي / كود التقدم" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
              <Search size={18} />
            </div>
            <Select
              aria-label="تصفية حسب الحالة"
              value={status}
              onChange={(e) => { setStatus(e.target.value as ApplicantStatus | 'all'); setPage(1); }}
              disabled={statusOptionsQuery.isLoading}
              helper={statusOptionsQuery.isError ? 'تعذر تحميل الحالات من الخادم' : undefined}
              options={[
                { value: 'all', label: 'كل الحالات' },
                ...statusOptions,
              ]}
              containerClassName="min-w-[150px]"
            />
            <div className="min-w-[180px] flex-[0_1_200px]">
              <SearchSelect
                value={governorate === 'all' ? null : governorate}
                onChange={(next) => {
                  setGovernorate(next ?? 'all');
                  setPage(1);
                }}
                options={governorateOptions}
                ariaLabel="تصفية حسب المحافظة"
                placeholder="كل المحافظات"
                className="h-[38px]"
              />
            </div>
            <div className="min-w-[180px] flex-[0_1_200px]">
              <SearchSelect
                value={certType === 'all' ? null : certType}
                onChange={(next) => {
                  setCertType(next ?? 'all');
                  setPage(1);
                }}
                options={CERT_TYPE_OPTIONS}
                ariaLabel="تصفية حسب نوع الشهادة"
                placeholder="كل الشهادات"
                className="h-[38px]"
              />
            </div>
          </div>

          <DataTable<Applicant>
            data={data?.data ?? []}
            columns={columns}
            rowKey={(a) => a.id}
            loading={isLoading}
            empty={<EmptyState title="لا توجد نتائج" description="جرّب تعديل عوامل التصفية" />}
            zebraStripes
            stickyHeader
            density="compact"
            pagination={data ? { page: data.page, pageSize: PAGE_SIZE, total: data.total, onPageChange: setPage } : undefined}
            listActions={listActions}
          />
        </div>
      </Card>
    </>
  );
}
