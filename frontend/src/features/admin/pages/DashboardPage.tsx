/**
 * DashboardPage — admin operational overview backed by live APIs.
 * Source: Tasks/DESIGN_SYSTEM.md §6.1 dashboard template.
 */

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Check,
  CreditCard,
  Database,
  FileText,
  Hourglass,
  RefreshCw,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  LoadingState,
  PageHeader,
  Select,
  StatCard,
  StatusBadge,
} from '@/shared/components';
import { BarChart, DonutChart, Heatmap, LineChart } from '@/shared/components/charts';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import {
  useApplicantDistribution,
  useApplicants,
  useApplicantStats,
} from '@/features/applicants/api/applicant.queries';
import { useAuditLog } from '@/features/audit/api/audit.queries';
import { date as fmtDate, num, shortName } from '@/shared/lib/format';
import { ROUTES } from '@/config/routes';
import type {
  Applicant,
  ApplicantCategoryKey,
  ApplicantStatus,
  IntegrationHealth,
  Kpis,
} from '@/shared/types/domain';
import { useCycles } from '../api/cycles.queries';
import { resolveActiveCycle } from '../api/cycles.service';
import {
  useCycleSnapshot,
  useGovernanceReport,
  useIntegrationStatus,
  useOperationalStatus,
  useStageFunnel,
} from '../api/reports.queries';

const HEATMAP_DAY_LABELS = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
const HEATMAP_HOUR_LABELS = Array.from({ length: 24 }, (_, hour) => (hour % 4 === 0 ? String(hour) : ''));
const EMPTY_HEATMAP = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
const CATEGORY_LABELS: Record<ApplicantCategoryKey, string> = {
  officers_general: 'قسم الضباط (قسم عام)',
  law_bachelor: 'ليسانس حقوق',
  physical_education_bachelor: 'بكالوريوس تربية رياضية',
  specialized_officers: 'الضباط المتخصصون',
};
const STATUS_WEIGHT: Record<ApplicantStatus, number> = {
  pending: 1,
  'documents-required': 1,
  'on-hold': 1,
  'under-review': 2,
  under_medical_review: 2,
  passed_physical: 3,
  awaiting_board_decision: 3,
  approved: 4,
  rejected: 4,
  failed_interview: 4,
  draft: 1,
  personal_data_completed: 1,
  awaiting_payment: 1,
  fees_paid: 2,
  family_data_in_progress: 2,
  family_data_approved: 2,
  awaiting_exam_booking: 2,
  exam_scheduled: 2,
  attendance_card_available: 3,
  awaiting_exam_result: 3,
  suspended: 4,
  acquaintance_doc_opened: 4,
};

const EMPTY_KPIS: Kpis = {
  totalApplicants: 0,
  paidApplicants: 0,
  underReview: 0,
  approved: 0,
  rejected: 0,
  pending: 0,
  byGender: { male: 0, female: 0 },
  byCertType: {},
};

export function DashboardPage(): JSX.Element {
  const cyclesQuery = useCycles();
  const snapshotQuery = useCycleSnapshot();
  const funnelQuery = useStageFunnel();
  const operationsQuery = useOperationalStatus();
  const integrationsQuery = useIntegrationStatus();
  const governanceQuery = useGovernanceReport();
  const applicantsQuery = useApplicants({ page: 1, pageSize: 500 });
  const recentApplicantsQuery = useApplicants({ page: 1, pageSize: 8 });
  const statsQuery = useApplicantStats();
  const certDistributionQuery = useApplicantDistribution('certType');
  const governorateDistributionQuery = useApplicantDistribution('governorate');
  const auditQuery = useAuditLog({ limit: 8 });
  const [cycleId, setCycleId] = useState<string>('');

  const activeCycle = resolveActiveCycle(cyclesQuery.data) ?? cyclesQuery.data?.[0] ?? null;
  useEffect(() => {
    if (!cycleId && activeCycle) setCycleId(activeCycle.id);
  }, [activeCycle, cycleId]);

  const selectedCycle = cyclesQuery.data?.find((cycle) => cycle.id === cycleId) ?? activeCycle;
  const applicants = applicantsQuery.data?.data ?? [];
  const recentApplicants = recentApplicantsQuery.data?.data ?? applicants.slice(0, 8);
  const recentAuditEntries = (auditQuery.data ?? []).slice(0, 8);
  const kpis = useMemo(() => normalizeKpis(statsQuery.data, applicants), [applicants, statsQuery.data]);
  const cycleSnapshot = snapshotQuery.data;
  const activeCategories = useMemo(() => {
    const entries = Object.entries(selectedCycle?.openCategories ?? {})
      .filter(([, config]) => config?.isOpen === true)
      .map(([key, config]) => ({
        key: key as ApplicantCategoryKey,
        labelAr: CATEGORY_LABELS[key as ApplicantCategoryKey] ?? key,
        capacity: config.capacity ?? null,
      }));
    if (entries.length > 0) return entries;
    return (cycleSnapshot?.categoriesOpen ?? []).filter((category) => category.isOpen);
  }, [cycleSnapshot?.categoriesOpen, selectedCycle?.openCategories]);
  const registrationTrend = useMemo(() => buildRegistrationTrend(applicants), [applicants]);
  const heatmapData = useMemo(() => buildRegistrationHeatmap(applicants), [applicants]);
  const funnelData = (funnelQuery.data ?? [])
    .filter((point) => point.count > 0)
    .slice(0, 7)
    .map((point) => ({ label: point.stageLabel, value: point.count }));
  const integrationSummary = summarizeIntegrations(integrationsQuery.data ?? []);
  const paymentRate = percent(kpis.paidApplicants, kpis.totalApplicants);
  const capacityRate = percent(kpis.totalApplicants, cycleSnapshot?.capacity ?? selectedCycle?.expectedCapacity ?? 0);
  const hasBlockingError = [
    cyclesQuery,
    applicantsQuery,
    recentApplicantsQuery,
    snapshotQuery,
  ].some((query) => query.isError);
  const isInitialLoading =
    cyclesQuery.isLoading ||
    applicantsQuery.isLoading ||
    recentApplicantsQuery.isLoading ||
    snapshotQuery.isLoading;

  if (isInitialLoading) {
    return (
      <CenteredShell>
        <LoadingState variant="page" />
      </CenteredShell>
    );
  }

  if (hasBlockingError) {
    return (
      <CenteredShell>
        <ErrorState
          error={
            cyclesQuery.error ??
            applicantsQuery.error ??
            recentApplicantsQuery.error ??
            snapshotQuery.error
          }
          onRetry={() => {
            void cyclesQuery.refetch();
            void applicantsQuery.refetch();
            void recentApplicantsQuery.refetch();
            void snapshotQuery.refetch();
          }}
        />
      </CenteredShell>
    );
  }

  return (
    <CenteredShell>
      <PageHeader
        title="لوحة تحكم النظام"
        subtitle={selectedCycle ? `الدورة الحالية: ${selectedCycle.nameAr}` : 'مؤشرات التشغيل المباشرة لمنظومة القبول'}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="اختر الدورة"
              value={cycleId}
              disabled={!cyclesQuery.data?.length}
              options={
                cyclesQuery.data?.length
                  ? cyclesQuery.data.map((cycle) => ({ value: cycle.id, label: cycle.nameAr }))
                  : [{ value: '', label: 'لا توجد دورات' }]
              }
              onChange={(event) => setCycleId(event.target.value)}
            />
            <Button
              variant="secondary"
              leadingIcon={<RefreshCw size={14} strokeWidth={1.75} />}
              onClick={() => {
                void applicantsQuery.refetch();
                void recentApplicantsQuery.refetch();
                void snapshotQuery.refetch();
                void operationsQuery.refetch();
                void integrationsQuery.refetch();
              }}
            >
              تحديث
            </Button>
            <Link to={ROUTES.admin.applicantNew} className="inline-flex">
              <Button variant="primary" leadingIcon={<FileText size={14} strokeWidth={1.75} />}>
                إضافة متقدم
              </Button>
            </Link>
          </div>
        }
      />

      <section className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
        <Card className="p-5">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge tone={selectedCycle?.isActive ? 'success' : 'neutral'}>
                  {selectedCycle?.isActive ? 'دورة نشطة' : 'دورة محددة'}
                </Badge>
                <Badge tone="info">
                  {cycleSnapshot?.generatedAt ? `آخر تحديث ${fmtDate(cycleSnapshot.generatedAt, 'rel')}` : 'بيانات مباشرة'}
                </Badge>
              </div>
              <h2 className="m-0 text-lg font-semibold text-ink-900">
                {cycleSnapshot?.cycleLabelAr || selectedCycle?.nameAr || 'دورة القبول'}
              </h2>
              <p className="mt-1 max-w-[68ch] text-sm leading-normal text-ink-500">
                متابعة التسجيلات، السداد، الطاقة الاستيعابية، وحالة التكاملات من قاعدة بيانات الدورة الحالية.
              </p>
            </div>
            <div className="grid min-w-[16rem] grid-cols-2 gap-3 text-sm">
              <MiniMetric label="الطاقة" value={cycleSnapshot?.capacity ?? selectedCycle?.expectedCapacity ?? 'غير محدد'} />
              <MiniMetric label="الامتلاء" value={`${capacityRate}%`} />
              <MiniMetric label="السداد" value={`${paymentRate}%`} />
              <MiniMetric label="التكاملات" value={`${integrationSummary.healthy}/${integrationSummary.total}`} />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="m-0 text-xs text-ink-500">حالة التشغيل</p>
              <p className="m-0 mt-1 text-xl font-semibold text-ink-900">
                {integrationSummary.degraded > 0 || integrationSummary.down > 0 ? 'تحتاج متابعة' : 'مستقرة'}
              </p>
            </div>
            <span className="inline-flex size-10 items-center justify-center rounded-md bg-teal-50 text-teal-700">
              <ShieldCheck size={18} strokeWidth={1.75} />
            </span>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {(integrationsQuery.data ?? []).slice(0, 4).map((integration) => (
              <IntegrationRow key={integration.key} name={integration.nameAr} status={integration.status} />
            ))}
          </div>
        </Card>
      </section>

      <section className="mb-5 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <StatCard
          label="إجمالي المتقدمين"
          value={kpis.totalApplicants}
          icon={<Users size={16} strokeWidth={1.75} />}
          trend={{ label: `${activeCategories.length} فئات مفتوحة`, tone: 'neutral' }}
          sparkline={registrationTrend.map((point) => point.value)}
        />
        <StatCard
          label="مدفوع الرسوم"
          value={kpis.paidApplicants}
          icon={<CreditCard size={16} strokeWidth={1.75} />}
          trend={{ label: `${paymentRate}% من الإجمالي`, tone: paymentRate >= 70 ? 'success' : 'neutral' }}
        />
        <StatCard
          label="قيد المراجعة"
          value={kpis.underReview}
          icon={<Hourglass size={16} strokeWidth={1.75} />}
          iconBg="var(--gold-50)"
          iconColor="var(--gold-700)"
          trend={{ label: 'ملفات تحتاج متابعة', tone: 'neutral' }}
        />
        <StatCard
          label="تم القبول"
          value={kpis.approved}
          icon={<Check size={16} strokeWidth={1.75} />}
          iconBg="var(--success-bg)"
          iconColor="var(--success)"
          trend={{ label: `${percent(kpis.approved, kpis.totalApplicants)}%`, tone: 'success' }}
        />
        <StatCard
          label="مستبعد"
          value={kpis.rejected}
          icon={<X size={16} strokeWidth={1.75} />}
          iconBg="var(--terra-50)"
          iconColor="var(--terra-700)"
          trend={{ label: `${percent(kpis.rejected, kpis.totalApplicants)}%`, tone: 'neutral' }}
        />
      </section>

      <section className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
        <Card>
          <CardHeader
            title="حركة التسجيلات"
            subtitle="آخر 14 يوم من سجلات المتقدمين"
            actions={<Badge tone="info">{num(applicants.length)} سجل</Badge>}
          />
          <CardBody>
            <LineChart data={registrationTrend} ariaLabel="حركة تسجيل المتقدمين خلال آخر 14 يوم" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="مراحل الطلبات" subtitle="آخر حالة محفوظة لكل متقدم" />
          <CardBody>
            <BarChart
              data={funnelData.length ? funnelData : statusChartData(applicants)}
              height={220}
              color="var(--gold-500)"
              ariaLabel="توزيع المتقدمين حسب المرحلة"
            />
          </CardBody>
        </Card>
      </section>

      <section className="mb-5 grid gap-5 xl:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader title="الفئات المفتوحة" subtitle="لا تظهر الفئات المغلقة أو التجريبية" />
          <CardBody>
            <div className="flex flex-col gap-3">
              {activeCategories.length > 0 ? (
                activeCategories.map((category) => (
                  <CategoryCapacityRow
                    key={category.key}
                    label={category.labelAr}
                    value={applicants.filter((applicant) => applicantMatchesCategory(applicant, category.key)).length}
                    capacity={category.capacity}
                  />
                ))
              ) : (
                <p className="rounded-md bg-ink-50 px-3 py-4 text-sm text-ink-500">لا توجد فئات مفتوحة في الدورة المحددة.</p>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="كثافة التقديم"
            subtitle="ساعة ويوم التسجيل من بيانات المتقدمين"
            actions={<Badge tone="brand">آخر 7 أيام</Badge>}
          />
          <CardBody>
            <Heatmap
              data={heatmapData}
              rowLabels={HEATMAP_DAY_LABELS}
              colLabels={HEATMAP_HOUR_LABELS}
              cellSize={18}
              ariaLabel="كثافة التسجيل حسب الساعة واليوم"
            />
          </CardBody>
        </Card>
      </section>

      <section className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
        <Card>
          <CardHeader
            title="آخر المتقدمين"
            subtitle={`أحدث ${num(recentApplicants.length)} ملفات`}
            actions={<InlineLink to={ROUTES.admin.applicants}>عرض الكل</InlineLink>}
          />
          <ul className="flex flex-col">
            {recentApplicants.map((applicant) => (
              <li
                key={applicant.id}
                className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-3 last:border-b-0"
              >
                <Link
                  to={ROUTES.admin.applicantDetail(applicant.id)}
                  className="flex min-w-0 items-center gap-3 rounded-md focus-visible:shadow-focus-teal focus-visible:outline-none"
                >
                  <Avatar name={applicant.name} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink-900">{shortName(applicant.name, 3)}</span>
                    <span className="block truncate font-mono text-2xs text-ink-500" dir="ltr">
                      {applicant.nationalId}
                    </span>
                  </span>
                </Link>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="hidden max-w-[15rem] truncate text-xs text-ink-500 md:inline">{cleanLabel(applicant.certType)}</span>
                  <StatusBadge status={applicant.status} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="إجراءات مطلوبة" subtitle="قائمة تشغيل مختصرة للمسؤول" />
          <CardBody>
            <div className="flex flex-col gap-2">
              {actionsRequired(kpis, integrationSummary).map((action) => (
                <ActionRow key={action.label} {...action} />
              ))}
            </div>
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="توزيع المؤهلات" subtitle="حسب نوع الشهادة المسجل" />
          <CardBody>
            <DonutChart
              data={(certDistributionQuery.data ?? certDistributionFromApplicants(applicants)).slice(0, 7)}
              centerLabel="متقدم"
              size={190}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="آخر النشاط" subtitle={`${num(recentAuditEntries.length)} أحداث`} />
          <ul className="flex flex-col">
            {recentAuditEntries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-start gap-3 border-b border-border-subtle px-5 py-3 last:border-b-0"
              >
                <Badge tone={entry.actionColor} className="mt-0.5">{entry.actionLabel}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink-900">{shortName(entry.userName, 3)}</p>
                  <p className="truncate text-2xs text-ink-500">
                    {entry.details} · {fmtDate(entry.timestamp, 'rel')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="التوزيع الجغرافي" subtitle="أعلى المحافظات في قاعدة البيانات" />
          <CardBody>
            <div className="flex flex-col gap-3">
              {(governorateDistributionQuery.data ?? governorateFromApplicants(applicants)).slice(0, 7).map((row) => (
                <ProgressRow key={row.label} label={cleanLabel(row.label)} value={row.value} max={(governorateDistributionQuery.data ?? [])[0]?.value ?? row.value} />
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="تشغيل اليوم"
            subtitle={`آخر 24 ساعة: ${num(governanceQuery.data?.totalLast24h ?? 0)} حدث`}
          />
          <CardBody>
            <div className="grid gap-3 md:grid-cols-2">
              <OpsMetric
                icon={<Users size={16} strokeWidth={1.75} />}
                label="طوابير اللجان"
                value={sum(operationsQuery.data?.committees.map((row) => row.todayQueue) ?? [])}
              />
              <OpsMetric
                icon={<Activity size={16} strokeWidth={1.75} />}
                label="اختبارات جارية"
                value={operationsQuery.data?.ongoingExams.length ?? 0}
              />
              <OpsMetric
                icon={<AlertTriangle size={16} strokeWidth={1.75} />}
                label="عمليات حساسة"
                value={governanceQuery.data?.highSensitivityLast24h ?? 0}
              />
              <OpsMetric
                icon={<Database size={16} strokeWidth={1.75} />}
                label="محطات طبية"
                value={operationsQuery.data?.medicalStations.length ?? 0}
              />
            </div>
          </CardBody>
        </Card>
      </section>
    </CenteredShell>
  );
}

function normalizeKpis(stats: Kpis | undefined, applicants: readonly Applicant[]): Kpis {
  if (stats && typeof stats.totalApplicants === 'number') return stats;
  return applicants.reduce<Kpis>((acc, applicant) => {
    acc.totalApplicants += 1;
    if (applicant.paymentStatus === 'paid') acc.paidApplicants += 1;
    if (applicant.status === 'approved') acc.approved += 1;
    if (applicant.status === 'rejected' || applicant.status === 'failed_interview') acc.rejected += 1;
    if (applicant.status === 'pending' || applicant.status === 'documents-required' || applicant.status === 'on-hold') acc.pending += 1;
    if (applicant.status === 'under-review' || applicant.status === 'under_medical_review' || applicant.status === 'awaiting_board_decision') {
      acc.underReview += 1;
    }
    acc.byGender[applicant.gender] += 1;
    acc.byCertType[applicant.certType] = (acc.byCertType[applicant.certType] ?? 0) + 1;
    return acc;
  }, { ...EMPTY_KPIS, byGender: { ...EMPTY_KPIS.byGender }, byCertType: {} });
}

function applicantMatchesCategory(applicant: Applicant, categoryKey: ApplicantCategoryKey): boolean {
  const applicantCategory = (applicant as Applicant & { categoryKey?: string }).categoryKey;
  if (applicantCategory === categoryKey) return true;
  const department = applicant.department;
  if (department === 'lawyers') return categoryKey === 'law_bachelor';
  if (department === 'masters' || department === 'doctorate' || department === 'special') {
    return categoryKey === 'specialized_officers';
  }
  if (department === 'general_first' || department === 'general_second') return categoryKey === 'officers_general';
  return department === categoryKey;
}

function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function buildRegistrationTrend(applicants: readonly Applicant[]): { label: string; value: number }[] {
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (13 - index));
    return { date, label: `${date.getDate()}/${date.getMonth() + 1}`, value: 0 };
  });
  for (const applicant of applicants) {
    const registered = new Date(applicant.registeredAt);
    const match = days.find((day) => day.date.toDateString() === registered.toDateString());
    if (match) match.value += 1;
  }
  return days.map(({ label, value }) => ({ label, value }));
}

function buildRegistrationHeatmap(applicants: readonly Applicant[]): number[][] {
  const matrix = EMPTY_HEATMAP.map((row) => [...row]);
  const weekAgo = Date.now() - 7 * 86_400_000;
  for (const applicant of applicants) {
    const registered = new Date(applicant.registeredAt);
    if (Number.isNaN(registered.getTime()) || registered.getTime() < weekAgo) continue;
    const dayIndex = (registered.getDay() + 1) % 7;
    matrix[dayIndex]![registered.getHours()] += 1;
  }
  return matrix;
}

function statusChartData(applicants: readonly Applicant[]): { label: string; value: number }[] {
  const counts = new Map<string, number>();
  for (const applicant of applicants) {
    counts.set(applicant.stageLabel || applicant.status, (counts.get(applicant.stageLabel || applicant.status) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => (STATUS_WEIGHT[a as ApplicantStatus] ?? 99) - (STATUS_WEIGHT[b as ApplicantStatus] ?? 99))
    .slice(0, 6)
    .map(([label, value]) => ({ label: cleanLabel(label), value }));
}

function summarizeIntegrations(rows: readonly { status: IntegrationHealth }[]): {
  total: number;
  healthy: number;
  degraded: number;
  down: number;
} {
  return rows.reduce(
    (acc, row) => {
      acc.total += 1;
      acc[row.status] += 1;
      return acc;
    },
    { total: 0, healthy: 0, degraded: 0, down: 0 },
  );
}

function actionsRequired(
  kpis: Kpis,
  integrations: { degraded: number; down: number },
): Array<{ icon: ReactNode; label: string; detail: string; href: string; tone: 'warning' | 'danger' | 'info' }> {
  return [
    {
      icon: <CreditCard size={14} strokeWidth={1.75} />,
      label: 'متابعة السداد',
      detail: `${num(Math.max(0, kpis.totalApplicants - kpis.paidApplicants))} ملف دون سداد مكتمل`,
      href: ROUTES.admin.payments,
      tone: 'warning',
    },
    {
      icon: <Hourglass size={14} strokeWidth={1.75} />,
      label: 'مراجعة الملفات',
      detail: `${num(kpis.underReview)} ملف قيد المراجعة`,
      href: ROUTES.admin.applicants,
      tone: 'info',
    },
    {
      icon: <AlertTriangle size={14} strokeWidth={1.75} />,
      label: 'التكاملات',
      detail: `${num(integrations.degraded + integrations.down)} خدمة تحتاج متابعة`,
      href: ROUTES.admin.reports,
      tone: integrations.down > 0 ? 'danger' : 'warning',
    },
  ];
}

function certDistributionFromApplicants(applicants: readonly Applicant[]): Array<{ label: string; value: number }> {
  return countBy(applicants, (applicant) => applicant.certType);
}

function governorateFromApplicants(applicants: readonly Applicant[]): Array<{ label: string; value: number }> {
  return countBy(applicants, (applicant) => applicant.governorate);
}

function countBy(applicants: readonly Applicant[], selector: (applicant: Applicant) => string): Array<{ label: string; value: number }> {
  const counts = new Map<string, number>();
  for (const applicant of applicants) {
    const label = cleanLabel(selector(applicant));
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));
}

function cleanLabel(value: string | undefined): string {
  if (!value || value.includes('????')) return 'غير محدد';
  return value;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function MiniMetric({ label, value }: { label: string; value: number | string }): JSX.Element {
  return (
    <div className="rounded-md border border-border-subtle bg-ink-50 px-3 py-2">
      <p className="m-0 text-2xs text-ink-500">{label}</p>
      <p className="m-0 mt-1 font-numeric text-sm font-semibold text-ink-900">{typeof value === 'number' ? num(value) : value}</p>
    </div>
  );
}

function IntegrationRow({ name, status }: { name: string; status: IntegrationHealth }): JSX.Element {
  const tone = status === 'healthy' ? 'success' : status === 'degraded' ? 'warning' : 'danger';
  const label = status === 'healthy' ? 'مستقر' : status === 'degraded' ? 'متذبذب' : 'متوقف';
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-ink-50 px-3 py-2">
      <span className="truncate text-sm text-ink-700">{name}</span>
      <Badge tone={tone}>{label}</Badge>
    </div>
  );
}

function CategoryCapacityRow({ label, value, capacity }: { label: string; value: number; capacity: number | null }): JSX.Element {
  const max = capacity ?? Math.max(value, 1);
  return (
    <div className="rounded-md border border-border-subtle bg-surface-card p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-ink-900">{label}</span>
        <span className="font-numeric text-xs text-ink-500">{num(value)}{capacity ? ` / ${num(capacity)}` : ''}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
        <div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.min(100, percent(value, max))}%` }} />
      </div>
    </div>
  );
}

function ActionRow({
  icon,
  label,
  detail,
  href,
  tone,
}: {
  icon: ReactNode;
  label: string;
  detail: string;
  href: string;
  tone: 'warning' | 'danger' | 'info';
}): JSX.Element {
  const iconClass = tone === 'danger' ? 'bg-terra-50 text-terra-700' : tone === 'warning' ? 'bg-gold-50 text-gold-700' : 'bg-teal-50 text-teal-700';
  return (
    <Link
      to={href}
      className="group flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-surface-card p-3 transition-colors duration-fast ease-standard hover:border-border-strong hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none"
    >
      <span className="flex min-w-0 items-start gap-3">
        <span className={`mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md ${iconClass}`}>
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-ink-900">{label}</span>
          <span className="block truncate text-xs text-ink-500">{detail}</span>
        </span>
      </span>
      <ArrowLeft size={14} className="shrink-0 text-ink-400 transition-transform group-hover:-translate-x-0.5" />
    </Link>
  );
}

function ProgressRow({ label, value, max }: { label: string; value: number; max: number }): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink-900">{label}</span>
        <span className="font-numeric text-xs text-ink-500">{num(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
        <div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.min(100, percent(value, max))}%` }} />
      </div>
    </div>
  );
}

function OpsMetric({ icon, label, value }: { icon: ReactNode; label: string; value: number }): JSX.Element {
  return (
    <div className="rounded-md border border-border-subtle bg-ink-50 p-3">
      <div className="mb-3 inline-flex size-8 items-center justify-center rounded-md bg-surface-card text-teal-700">
        {icon}
      </div>
      <p className="m-0 text-xs text-ink-500">{label}</p>
      <p className="m-0 mt-1 font-numeric text-lg font-semibold text-ink-900">{num(value)}</p>
    </div>
  );
}

function InlineLink({ to, children }: { to: string; children: ReactNode }): JSX.Element {
  return (
    <Link
      to={to}
      className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium text-teal-700 hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none"
    >
      {children}
    </Link>
  );
}
