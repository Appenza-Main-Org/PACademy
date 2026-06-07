import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FilterX, Search, UserPlus } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
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
import { useActiveCycle } from '@/features/admin/api/cycles.queries';
import { useLookup } from '@/features/lookups';
import { ApplicantRowActions } from '@/features/admin/components/applicants/ApplicantRowActions';
import { buildApplicantsWorkbookSheets, fetchApplicantsForExport } from '@/features/admin/lib/applicants-export';
import { ROUTES } from '@/config/routes';
import { date as fmtDate, shortName, maskNationalId } from '@/shared/lib/format';
import type { Applicant, ApplicantStatus } from '@/shared/types/domain';

const PAGE_SIZE = 15;
const FILTER_TRIGGER_CLASS = 'h-[44px] rounded-lg text-sm';
const FILTER_CONTAINER_CLASS = 'min-w-[11rem]';
const FILTER_LABEL_CLASS = 'mb-1 block text-xs font-medium text-ink-700';

const CERT_TYPE_OPTIONS: readonly SearchSelectOption[] = [
  { value: 'ثانوية عامة', label: 'ثانوية عامة' },
  { value: 'ثانوية أزهرية', label: 'ثانوية أزهرية' },
];

const GENDER_OPTIONS = [
  { value: 'male', label: 'ذكر' },
  { value: 'female', label: 'أنثى' },
] as const;

const RELIGION_OPTIONS = [
  { value: 'مسلم', label: 'مسلم' },
  { value: 'مسيحي', label: 'مسيحي' },
] as const;

const SOURCE_OPTIONS = [
  { value: 'applicant-portal', label: 'بوابة المتقدمين' },
  { value: 'api', label: 'إدخال إداري' },
  { value: 'admin_records', label: 'ترحيل سابق' },
] as const;

function displayValue(value: string | number | null | undefined): string {
  if (value === undefined || value === null || value === '') return 'غير مسجل';
  return String(value);
}

function genderLabel(value: Applicant['gender'] | string | undefined): string {
  if (value === 'male' || value === 'ذكر') return 'ذكر';
  if (value === 'female' || value === 'أنثى') return 'أنثى';
  return displayValue(value);
}

function sourceLabel(value: string | undefined): string {
  if (value === 'applicant-portal') return 'بوابة المتقدمين';
  if (value === 'api') return 'إدخال إداري';
  if (value === 'admin_records') return 'ترحيل سابق';
  return displayValue(value);
}

function residenceGovernorate(applicant: Applicant): string {
  return applicant.currentAddress?.governorate ?? applicant.governorate;
}

function residenceCity(applicant: Applicant): string {
  return applicant.currentAddress?.city ?? applicant.city;
}

export function ApplicantsPage(): JSX.Element {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ApplicantStatus | 'all'>('all');
  const [governorate, setGovernorate] = useState<string>('all');
  const [birthGovernorate, setBirthGovernorate] = useState<string>('all');
  const [certType, setCertType] = useState<string>('all');
  const [gender, setGender] = useState<'male' | 'female' | 'all'>('all');
  const [religion, setReligion] = useState<string>('all');
  const [source, setSource] = useState<string>('all');
  const governoratesQuery = useLookup('governorates');
  const activeCycleQuery = useActiveCycle();
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
    birthGovernorate,
    certType,
    gender,
    religion,
    source,
  });

  const hasActiveFilters =
    search.trim() !== ''
    || status !== 'all'
    || governorate !== 'all'
    || birthGovernorate !== 'all'
    || certType !== 'all'
    || gender !== 'all'
    || religion !== 'all'
    || source !== 'all';

  const resetFilters = (): void => {
    setSearch('');
    setStatus('all');
    setGovernorate('all');
    setBirthGovernorate('all');
    setCertType('all');
    setGender('all');
    setReligion('all');
    setSource('all');
    setPage(1);
  };

  const columns: DataTableColumn<Applicant>[] = useMemo(
    () => [
      {
        key: 'name',
        label: 'المتقدم',
        width: '22%',
        sortable: true,
        getSortValue: (a) => a.name,
        filter: { kind: 'text', getValue: (a) => a.name },
        render: (a) => (
          <Link to={ROUTES.admin.applicantDetail(a.id)} className="flex min-w-0 items-center gap-3">
            <Avatar name={a.name} size="sm" />
            <div className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-sm font-medium text-ink-900">{shortName(a.name, 3)}</span>
              <span className="block truncate font-mono text-2xs text-ink-500" dir="ltr">{displayValue(a.adminRecordId ?? a.id)}</span>
              <Badge tone="neutral" className="w-fit">{sourceLabel(a.source)}</Badge>
            </div>
          </Link>
        ),
      },
      {
        key: 'identity',
        label: 'الهوية',
        width: '18%',
        sortable: true,
        getSortValue: (a) => a.nationalId,
        filter: { kind: 'text', getValue: (a) => `${a.nationalId} ${genderLabel(a.gender)} ${a.religion ?? ''}` },
        render: (a) => (
          <div className="min-w-0 space-y-1 text-start">
            <span className="block text-end font-mono text-sm text-ink-900" dir="ltr">{maskNationalId(a.nationalId)}</span>
            <span className="text-2xs text-ink-600">{genderLabel(a.gender)} · {displayValue(a.religion)}</span>
            <span className="text-2xs text-ink-500">{a.birthDate ? fmtDate(a.birthDate, 'short') : 'تاريخ الميلاد غير مسجل'}</span>
          </div>
        ),
      },
      {
        key: 'contact',
        label: 'الاتصال',
        width: '18%',
        hideOn: 'md',
        sortable: true,
        getSortValue: (a) => a.phoneNumber ?? a.contact?.mobilePhone,
        filter: { kind: 'text', getValue: (a) => `${a.phoneNumber ?? a.contact?.mobilePhone ?? ''} ${a.email ?? a.contact?.email ?? ''}` },
        render: (a) => (
          <div className="min-w-0 space-y-1 text-start">
            <span className="block text-end font-mono text-sm text-ink-900" dir="ltr">{displayValue(a.phoneNumber ?? a.contact?.mobilePhone)}</span>
            <span className="block truncate text-end text-2xs text-ink-500" dir="ltr">
              {displayValue(a.email ?? a.contact?.email)}
            </span>
          </div>
        ),
      },
      {
        key: 'birthGovernorate',
        label: 'محافظة الميلاد',
        width: '12%',
        hideOn: 'md',
        sortable: true,
        getSortValue: (a) => a.birthGovernorate ?? '',
        filter: {
          kind: 'text',
          getValue: (a) => `${a.birthGovernorate ?? ''} ${a.birthDistrict ?? ''}`,
        },
        render: (a) => (
          <div className="min-w-0 space-y-1 text-start">
            <span className="block truncate text-sm text-ink-900">{displayValue(a.birthGovernorate)}</span>
            <span className="block truncate text-2xs text-ink-500">{displayValue(a.birthDistrict)}</span>
          </div>
        ),
      },
      {
        key: 'residenceGovernorate',
        label: 'محافظة الإقامة',
        width: '12%',
        hideOn: 'md',
        sortable: true,
        getSortValue: (a) => residenceGovernorate(a),
        filter: {
          kind: 'text',
          getValue: (a) => `${residenceGovernorate(a)} ${residenceCity(a)}`,
        },
        render: (a) => (
          <div className="min-w-0 space-y-1 text-start">
            <span className="block truncate text-sm text-ink-900">{displayValue(residenceGovernorate(a))}</span>
            <span className="block truncate text-2xs text-ink-500">{displayValue(residenceCity(a))}</span>
          </div>
        ),
      },
      {
        key: 'certType',
        label: 'الشهادة',
        width: '13%',
        hideOn: 'md',
        sortable: true,
        getSortValue: (a) => a.certType,
        filter: { kind: 'text', getValue: (a) => a.certType },
        render: (a) => (
          <div className="min-w-0 space-y-1 text-start text-2xs">
            <span className="block truncate text-ink-700">{a.certType}</span>
            <span className="block truncate text-ink-500">{a.certSection}</span>
            <span className="block text-end font-mono text-ink-500" dir="ltr">{displayValue(a.certPercent)}</span>
          </div>
        ),
      },
      {
        key: 'progress',
        label: 'الحالة',
        width: '13%',
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
          return (
            <div className="flex min-w-0 flex-col items-start gap-1">
              <Badge tone={def?.color ?? 'neutral'} dot={live}>{def?.label ?? a.status}</Badge>
              <Badge tone="info">{a.stageLabel}</Badge>
              <PaymentBadge status={a.paymentStatus} />
            </div>
          );
        },
      },
      {
        key: 'registeredAt',
        label: 'التسجيل',
        width: '10%',
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
        defaultScope: 'all',
        allSupplier: () => fetchApplicantsForExport(),
        filteredSupplier: () =>
          fetchApplicantsForExport({
            search,
            status,
            governorate,
            birthGovernorate,
            certType,
            gender,
            religion,
            source,
          }),
        xlsxSheets: buildApplicantsWorkbookSheets,
        columns: [
          { key: 'id', labelAr: 'كود التقدم' },
          { key: 'applicantTableId', labelAr: 'معرف جدول المتقدمين' },
          { key: 'adminRecordId', labelAr: 'معرف سجل الإدارة' },
          { key: 'nationalId', labelAr: 'الرقم القومي' },
          { key: 'name', labelAr: 'الاسم' },
          {
            key: 'gender',
            labelAr: 'النوع',
            format: (v) => genderLabel(v as Applicant['gender'] | string | undefined),
          },
          { key: 'religion', labelAr: 'الديانة' },
          { key: 'birthDate', labelAr: 'تاريخ الميلاد' },
          { key: 'birthGovernorate', labelAr: 'محافظة الميلاد' },
          { key: 'birthDistrict', labelAr: 'قسم الميلاد' },
          { key: 'phoneNumber', labelAr: 'رقم الهاتف' },
          { key: 'email', labelAr: 'البريد الإلكتروني' },
          { key: 'governorate', labelAr: 'محافظة الإقامة' },
          { key: 'certType', labelAr: 'نوع الشهادة' },
          { key: 'source', labelAr: 'مصدر السجل' },
          { key: 'certPercent', labelAr: 'النسبة المئوية' },
          {
            key: 'paymentStatus',
            labelAr: 'حالة الدفع',
            format: (v) => {
              if (v === 'paid') return 'تم السداد';
              if (v === 'failed') return 'فشل السداد';
              if (v === 'refunded') return 'تم رد المبلغ';
              return 'في انتظار السداد';
            },
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
      rowActions: {
        labelAr: 'إجراءات',
        width: 72,
        render: (applicant) => (
          <ApplicantRowActions
            applicant={applicant}
            activeCycleId={activeCycleQuery.data?.id ?? null}
          />
        ),
      },
    }),
    [
      activeCycleQuery.data?.id,
      birthGovernorate,
      certType,
      gender,
      governorate,
      religion,
      search,
      source,
      status,
      statusByValue,
    ],
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
          <div className="grid items-end gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <div className="min-w-[18rem] md:col-span-2">
              <label htmlFor="applicants-search" className={FILTER_LABEL_CLASS}>بحث</label>
              <div className="search min-w-0">
                <input
                  id="applicants-search"
                  className="input"
                  type="search"
                  placeholder="بحث بالاسم / الرقم القومي / كود التقدم"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
                <Search size={18} />
              </div>
            </div>
            <Select
              label="الحالة"
              aria-label="تصفية حسب الحالة"
              value={status}
              onChange={(e) => { setStatus(e.target.value as ApplicantStatus | 'all'); setPage(1); }}
              disabled={statusOptionsQuery.isLoading}
              helper={statusOptionsQuery.isError ? 'تعذر تحميل الحالات من الخادم' : undefined}
              options={[
                { value: 'all', label: 'كل الحالات' },
                ...statusOptions,
              ]}
              className={FILTER_TRIGGER_CLASS}
              containerClassName={FILTER_CONTAINER_CLASS}
            />
            <Select
              label="النوع"
              aria-label="تصفية حسب النوع"
              value={gender}
              onChange={(e) => { setGender(e.target.value as 'male' | 'female' | 'all'); setPage(1); }}
              options={[
                { value: 'all', label: 'كل الأنواع' },
                ...GENDER_OPTIONS,
              ]}
              className={FILTER_TRIGGER_CLASS}
              containerClassName={FILTER_CONTAINER_CLASS}
            />
            <Select
              label="الديانة"
              aria-label="تصفية حسب الديانة"
              value={religion}
              onChange={(e) => { setReligion(e.target.value); setPage(1); }}
              options={[
                { value: 'all', label: 'كل الديانات' },
                ...RELIGION_OPTIONS,
              ]}
              className={FILTER_TRIGGER_CLASS}
              containerClassName={FILTER_CONTAINER_CLASS}
            />
            <div className={FILTER_CONTAINER_CLASS}>
              <span className={FILTER_LABEL_CLASS}>محافظة الإقامة</span>
              <SearchSelect
                value={governorate === 'all' ? null : governorate}
                onChange={(next) => {
                  setGovernorate(next ?? 'all');
                  setPage(1);
                }}
                options={governorateOptions}
                ariaLabel="تصفية حسب محافظة الإقامة"
                placeholder="كل محافظات الإقامة"
                className={FILTER_TRIGGER_CLASS}
              />
            </div>
            <div className={FILTER_CONTAINER_CLASS}>
              <span className={FILTER_LABEL_CLASS}>محافظة الميلاد</span>
              <SearchSelect
                value={birthGovernorate === 'all' ? null : birthGovernorate}
                onChange={(next) => {
                  setBirthGovernorate(next ?? 'all');
                  setPage(1);
                }}
                options={governorateOptions}
                ariaLabel="تصفية حسب محافظة الميلاد"
                placeholder="كل محافظات الميلاد"
                className={FILTER_TRIGGER_CLASS}
              />
            </div>
            <div className={FILTER_CONTAINER_CLASS}>
              <span className={FILTER_LABEL_CLASS}>الشهادة</span>
              <SearchSelect
                value={certType === 'all' ? null : certType}
                onChange={(next) => {
                  setCertType(next ?? 'all');
                  setPage(1);
                }}
                options={CERT_TYPE_OPTIONS}
                ariaLabel="تصفية حسب نوع الشهادة"
                placeholder="كل الشهادات"
                className={FILTER_TRIGGER_CLASS}
              />
            </div>
            <Select
              label="مصدر السجل"
              aria-label="تصفية حسب مصدر السجل"
              value={source}
              onChange={(e) => { setSource(e.target.value); setPage(1); }}
              options={[
                { value: 'all', label: 'كل المصادر' },
                ...SOURCE_OPTIONS,
              ]}
              className={FILTER_TRIGGER_CLASS}
              containerClassName={FILTER_CONTAINER_CLASS}
            />
            {hasActiveFilters && (
              <Button
                variant="secondary"
                size="md"
                leadingIcon={<FilterX size={14} strokeWidth={1.75} />}
                onClick={resetFilters}
                className="h-[44px] w-full rounded-lg"
              >
                مسح التصفية
              </Button>
            )}
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
