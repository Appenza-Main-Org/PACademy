/**
 * DashboardPage — admin overview with cycle selector, KPIs, charts,
 * activity ticker, "إجراءات مطلوبة" panel, and hour×day heatmap.
 * Source: Tasks/KARASA_GAPS.md §1.2.H.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Check,
  CreditCard,
  Hourglass,
  Layers,
  ListChecks,
  Plus,
  Users,
  Users2,
  X,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  Select,
  StatCard,
  StatusBadge,
} from '@/shared/components';
import { DonutChart, Heatmap, LineChart } from '@/shared/components/charts';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import {
  useApplicantDistribution,
  useApplicantStats,
} from '@/features/applicants/api/applicant.queries';
import { useAuditLog } from '@/features/audit/api/audit.queries';
import { MOCK } from '@/shared/mock-data';
import { date as fmtDate, num, shortName } from '@/shared/lib/format';
import { ROUTES } from '@/config/routes';
import { useCycles } from '../api/cycles.queries';

const HEATMAP_DAY_LABELS = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
const HEATMAP_HOUR_LABELS = Array.from({ length: 24 }, (_, h) => (h % 4 === 0 ? String(h) : ''));

const TICKER_DOT: Record<'success' | 'warning' | 'danger' | 'info' | 'neutral', string> = {
  success: 'var(--success)',
  warning: 'var(--gold-500)',
  danger: 'var(--terra-500)',
  info: 'var(--teal-500)',
  neutral: 'var(--ink-400)',
};

export function DashboardPage(): JSX.Element {
  const { data: cycles } = useCycles();
  const [cycleId, setCycleId] = useState<string>('');
  useEffect(() => {
    if (!cycleId && cycles?.length) {
      const candidate = cycles.find((c) => c.status === 'open' || c.status === 'processing') ?? cycles[0];
      if (candidate) setCycleId(candidate.id);
    }
  }, [cycles, cycleId]);

  const { data: stats } = useApplicantStats();
  const { data: certDist } = useApplicantDistribution('certType');
  const { data: govDist } = useApplicantDistribution('governorate');
  const { data: ticker } = useAuditLog({ limit: 6 });
  const { data: recentAudit } = useAuditLog({ limit: 8 });

  const k = stats ?? MOCK.kpis;
  const recent = MOCK.applicants
    .slice()
    .sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime())
    .slice(0, 8);

  const actionsRequired = computeActionsRequired();

  return (
    <CenteredShell>
      <PageHeader
        title="لوحة تحكم النظام"
        subtitle="نظرة شاملة على حالة المتقدمين، النشاط، والمؤشرات الحيوية"
        actions={
          <div className="flex items-center gap-2">
            <Select
              aria-label="اختر الدورة"
              value={cycleId}
              onChange={(e) => setCycleId(e.target.value)}
              options={(cycles ?? []).map((c) => ({ value: c.id, label: c.nameAr }))}
            />
            <Button variant="primary" leadingIcon={<Plus size={14} strokeWidth={1.75} />}>
              متقدم جديد
            </Button>
          </div>
        }
      />

      <div
        className="mb-6 grid gap-5"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
      >
        <StatCard
          label="إجمالي المتقدمين"
          value={k.totalApplicants}
          icon={<Users size={16} strokeWidth={1.75} />}
          trend={{ label: '+12% عن دورة 2025', tone: 'success' }}
          sparkline={MOCK.last14Days.map((d) => d.registrations)}
        />
        <StatCard
          label="مدفوع الرسوم"
          value={k.paidApplicants}
          icon={<CreditCard size={16} strokeWidth={1.75} />}
          trend={{
            label: `${Math.round((k.paidApplicants / Math.max(1, k.totalApplicants)) * 100)}% من الإجمالي`,
            tone: 'success',
          }}
          sparkline={MOCK.last14Days.map((d) => d.payments)}
        />
        <StatCard
          label="قيد المراجعة"
          value={k.underReview}
          icon={<Hourglass size={16} strokeWidth={1.75} />}
          iconBg="var(--gold-50)"
          iconColor="var(--gold-700)"
          trend={{ label: 'بفترة الفحص الطبي', tone: 'neutral' }}
        />
        <StatCard
          label="تم القبول"
          value={k.approved}
          icon={<Check size={16} strokeWidth={1.75} />}
          iconBg="var(--success-bg)"
          iconColor="var(--success)"
          trend={{ label: 'بانتظار قرار الهيئة', tone: 'neutral' }}
        />
        <StatCard
          label="مستبعد طبياً/أمنياً"
          value={k.rejected}
          icon={<X size={16} strokeWidth={1.75} />}
          iconBg="var(--terra-50)"
          iconColor="var(--terra-700)"
          trend={{ label: 'وفقاً للوائح القبول', tone: 'neutral' }}
        />
      </div>

      {/* Quick actions — direct entries to the most-used admin flows. */}
      <div className="mb-6">
        <Card>
          <CardHeader
            title="إجراءات سريعة"
            subtitle="بداية مختصرة لأكثر إجراءات الإدارة استخداماً"
          />
          <CardBody>
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}
            >
              <QuickAction
                to={ROUTES.admin.cycleNew}
                icon={<CalendarDays size={18} strokeWidth={1.75} />}
                label="إنشاء دورة قبول"
              />
              <QuickAction
                to={ROUTES.admin.categories}
                icon={<Layers size={18} strokeWidth={1.75} />}
                label="إدارة فئات القبول"
              />
              <QuickAction
                to={ROUTES.admin.adminLookupsType('committees')}
                icon={<Users2 size={18} strokeWidth={1.75} />}
                label="إدارة اللجان"
              />
              <QuickAction
                to={ROUTES.admin.workflows}
                icon={<ListChecks size={18} strokeWidth={1.75} />}
                label="ضبط مسار الاختبارات"
              />
              <QuickAction
                to={ROUTES.admin.payments}
                icon={<CreditCard size={18} strokeWidth={1.75} />}
                label="مراجعة المدفوعات"
              />
              <QuickAction
                to={ROUTES.admin.notifications}
                icon={<Bell size={18} strokeWidth={1.75} />}
                label="إرسال إشعار"
              />
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Actions required + activity ticker */}
      <div className="mb-6 grid gap-5 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader
            title="إجراءات مطلوبة"
            subtitle="عناصر تستدعي تدخّل المسؤول"
            actions={<Badge tone="warning">{actionsRequired.length}</Badge>}
          />
          <CardBody>
            <ul className="flex flex-col">
              {actionsRequired.map((a) => (
                <li
                  key={a.label}
                  className="flex items-start justify-between gap-3 border-b border-border-subtle py-3 last:border-b-0"
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="mt-0.5 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-gold-50 text-gold-700"
                    >
                      <AlertTriangle size={14} strokeWidth={1.75} />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-ink-900">{a.label}</p>
                      <p className="text-xs text-ink-500">{a.detail}</p>
                    </div>
                  </div>
                  <Link to={a.href} className="text-xs font-medium text-teal-700 hover:underline">
                    افتح ←
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="مؤشر النشاط الحيّ" subtitle="آخر العمليات في المنظومة" />
          <CardBody>
            <ol className="flex flex-col gap-2" aria-live="polite">
              {(ticker ?? []).map((e) => (
                <li
                  key={e.id}
                  className="flex items-start gap-2 rounded-md border border-border-subtle bg-surface-card px-3 py-2 text-xs transition-colors duration-fast ease-standard hover:border-ink-300"
                >
                  <span
                    aria-hidden
                    className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full"
                    style={{ background: TICKER_DOT[e.actionColor] }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-ink-900">
                      <span className="font-medium">{shortName(e.userName, 3)}</span>{' '}
                      <span className="text-ink-500">{e.actionLabel}</span>
                    </p>
                    <p className="truncate text-2xs text-ink-500">{e.details}</p>
                  </div>
                  <span className="flex-shrink-0 text-2xs text-ink-500">
                    {fmtDate(e.timestamp, 'rel')}
                  </span>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      </div>

      {/* Charts */}
      <div className="mb-6 grid gap-5 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader
            title="حركة التسجيلات — آخر 14 يوم"
            subtitle="عدد المتقدمين المسجلين يومياً"
            actions={<Badge tone="info">+18% أسبوعياً</Badge>}
          />
          <CardBody>
            <LineChart
              data={MOCK.last14Days.map((d) => ({ label: d.label, value: d.registrations }))}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="توزيع نوع الشهادة" subtitle="نسبة كل نوع شهادة" />
          <CardBody>
            <DonutChart
              data={(certDist ?? []).map((d) => ({ label: d.label, value: d.value }))}
              centerLabel="متقدم"
              size={200}
            />
          </CardBody>
        </Card>
      </div>

      {/* Heatmap */}
      <Card className="mb-6">
        <CardHeader
          title="كثافة التقديم — ساعة × يوم"
          subtitle="ذروة الاستخدام لتحسين سعة الخوادم"
          actions={<Badge tone="brand">آخر 7 أيام</Badge>}
        />
        <CardBody>
          <Heatmap
            data={MOCK.heatmapHourDay}
            rowLabels={HEATMAP_DAY_LABELS}
            colLabels={HEATMAP_HOUR_LABELS}
            cellSize={20}
          />
        </CardBody>
      </Card>

      {/* Recent applicants + audit feed */}
      <div className="mb-6 grid gap-5 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader
            title="آخر المتقدمين"
            subtitle={`أحدث ${recent.length} طلبات تقديم`}
            actions={
              <Link
                to={ROUTES.admin.applicants}
                className="inline-flex items-center rounded-md px-2 py-1 text-xs text-teal-700 hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none"
              >
                عرض الكل
              </Link>
            }
          />
          <ul className="flex flex-col">
            {recent.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 border-b border-border-subtle py-3 last:border-b-0"
              >
                <Link
                  to={ROUTES.admin.applicantDetail(a.id)}
                  className="flex items-center gap-3 hover:underline"
                >
                  <Avatar name={a.name} size="sm" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-ink-900">{shortName(a.name, 3)}</span>
                    <span className="text-2xs text-ink-500 font-mono" dir="ltr">
                      {a.id}
                    </span>
                  </div>
                </Link>
                <div className="flex items-center gap-3">
                  <span className="hidden text-xs text-ink-500 md:inline">
                    {a.certType} — {a.certSection}
                  </span>
                  <StatusBadge status={a.status} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="آخر النشاط" subtitle={`${num(recentAudit?.length ?? 0)} حدث`} />
          <ul className="flex flex-col">
            {(recentAudit ?? []).map((e) => (
              <li
                key={e.id}
                className="flex items-start gap-2 border-b border-border-subtle py-2 last:border-b-0"
              >
                <Badge tone={e.actionColor} className="mt-0.5">{e.actionLabel}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink-900">{shortName(e.userName, 3)}</p>
                  <p className="truncate text-2xs text-ink-500">
                    {e.details} · {fmtDate(e.timestamp, 'rel')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Geographic strip */}
      <Card>
        <CardHeader title="التوزيع الجغرافي" subtitle="عدد المتقدمين حسب المحافظة" />
        <CardBody>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {(govDist ?? []).slice(0, 9).map((g) => {
              const max = govDist?.[0]?.value ?? 1;
              const pct = (g.value / max) * 100;
              return (
                <div key={g.label} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-ink-900">{g.label}</span>
                    <span className="text-xs text-ink-500 font-numeric tnum">{num(g.value)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--accent-500)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>
    </CenteredShell>
  );
}

function computeActionsRequired(): { label: string; detail: string; href: string }[] {
  const pendingPayments = MOCK.applicants.filter((a) => a.paymentStatus === 'pending').length;
  const flaggedInvest = MOCK.applicants.filter((a) => a.investigation === 'flagged').length;
  const stuck = MOCK.applicants.filter((a) => a.status === 'on-hold').length;
  return [
    {
      label: 'متقدمون لم يسددوا الرسوم',
      detail: `${pendingPayments} طلب يحتاج لمتابعة سداد`,
      href: ROUTES.admin.applicants,
    },
    {
      label: 'تحريات مُحالة بعلامة خطر',
      detail: `${flaggedInvest} حالة لمراجعة الهيئة`,
      href: ROUTES.investigations.overview,
    },
    {
      label: 'طلبات معلّقة',
      detail: `${stuck} طلب موقوف بانتظار قرار`,
      href: ROUTES.admin.applicants,
    },
  ];
}

function QuickAction({
  to,
  icon,
  label,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
}): JSX.Element {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-lg border border-border-default bg-surface-card p-3 text-sm font-medium text-ink-900 transition-all duration-fast ease-standard hover:-translate-y-px hover:border-teal-500 hover:bg-teal-50 hover:text-teal-700 focus-visible:shadow-focus-teal focus-visible:outline-none"
    >
      <span
        aria-hidden
        className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-700 transition-colors group-hover:bg-teal-500 group-hover:text-white"
      >
        {icon}
      </span>
      <span>{label}</span>
    </Link>
  );
}
