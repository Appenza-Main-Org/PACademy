/**
 * DecisionBriefSection — executive decision layer for /admin/reports.
 * Converts the report datasets into the three questions a super admin
 * asks first: what needs a decision, where to look, and what action opens
 * the right operational surface.
 */

import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Radio,
  ShieldAlert,
  Target,
} from 'lucide-react';
import { Card, CardBody } from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { num } from '@/shared/lib/format';
import type {
  CycleSnapshot,
  GovernanceReport,
  IntegrationStatus,
  OperationalStatus,
  StageFunnelPoint,
} from '@/shared/types/domain';
import type { TimeRange } from './RangeChips';

interface DecisionBriefSectionProps {
  snapshot: CycleSnapshot;
  funnel: readonly StageFunnelPoint[];
  operational: OperationalStatus;
  governance: GovernanceReport;
  integrations: readonly IntegrationStatus[];
  range: TimeRange;
}

interface DecisionItem {
  key: string;
  title: string;
  value: string;
  detail: string;
  actionLabel: string;
  href: string;
  tone: 'danger' | 'warning' | 'success';
  icon: JSX.Element;
}

const RANGE_LABEL: Record<TimeRange, string> = {
  today: 'اليوم',
  '7d': 'آخر ٧ أيام',
  '30d': 'آخر ٣٠ يوم',
  cycle: 'الدورة الكاملة',
  compare: 'مقارنة تنفيذية',
};

const TONE_CLASS: Record<DecisionItem['tone'], string> = {
  danger: 'border-terra-200 bg-terra-50 text-terra-700',
  warning: 'border-gold-200 bg-gold-50 text-gold-700',
  success: 'border-teal-100 bg-teal-50 text-teal-700',
};

const ACTION_CLASS: Record<DecisionItem['tone'], string> = {
  danger: 'text-terra-700 hover:bg-terra-100',
  warning: 'text-gold-700 hover:bg-gold-100',
  success: 'text-teal-700 hover:bg-teal-100',
};

export function DecisionBriefSection({
  snapshot,
  funnel,
  operational,
  governance,
  integrations,
  range,
}: DecisionBriefSectionProps): JSX.Element {
  const worstDrop = funnel
    .slice(1)
    .reduce<StageFunnelPoint | null>(
      (current, point) =>
        current === null || point.dropOffFromPrevPercent > current.dropOffFromPrevPercent ? point : current,
      null,
    );
  const bottleneck = funnel
    .filter((point) => point.isBottleneck)
    .sort((a, b) => b.avgDaysAtStage - a.avgDaysAtStage)[0];
  const longMedicalQueues = operational.medicalStations.filter((station) => station.avgWaitMinutes >= 35);
  const unsignedCommittees = operational.committees.filter((committee) => !committee.signedOffToday);
  const unhealthyIntegrations = integrations.filter((integration) => integration.status !== 'healthy');
  const capacityRatio = snapshot.capacity ? snapshot.totalApplicants / snapshot.capacity : 0;

  const decisions: DecisionItem[] = [
    bottleneck
      ? {
          key: 'bottleneck',
          title: 'اختناق يبطئ الدورة',
          value: `${bottleneck.avgDaysAtStage} يوم`,
          detail: `${bottleneck.stageLabel} تحتفظ بـ ${num(bottleneck.count)} متقدم، وهي أعلى مرحلة زمن انتظار.`,
          actionLabel: 'فتح مسار المتقدمين',
          href: ROUTES.admin.applicants,
          tone: 'danger',
          icon: <Clock3 size={16} strokeWidth={1.75} />,
        }
      : {
          key: 'bottleneck',
          title: 'زمن المراحل تحت السيطرة',
          value: 'سليم',
          detail: 'لا توجد مرحلة تتجاوز حد المتابعة الحالي، راقب الانسحاب بين المراحل.',
          actionLabel: 'مراجعة القمع',
          href: ROUTES.admin.reports,
          tone: 'success',
          icon: <CheckCircle2 size={16} strokeWidth={1.75} />,
        },
    {
      key: 'dropoff',
      title: 'أكبر فاقد بين المراحل',
      value: worstDrop ? `${worstDrop.dropOffFromPrevPercent}%` : '0%',
      detail: worstDrop
        ? `الانتقال إلى ${worstDrop.stageLabel} يحتاج تفسيرًا، خصوصًا لو ارتفع مع تغيير النطاق الزمني.`
        : 'لا توجد بيانات انسحاب كافية داخل النطاق الحالي.',
      actionLabel: 'تحليل المراحل',
      href: ROUTES.admin.workflows,
      tone: worstDrop && worstDrop.dropOffFromPrevPercent >= 18 ? 'warning' : 'success',
      icon: <Target size={16} strokeWidth={1.75} />,
    },
    {
      key: 'operations',
      title: 'ضغط تشغيلي اليوم',
      value: num(longMedicalQueues.length + unsignedCommittees.length),
      detail:
        longMedicalQueues.length > 0 || unsignedCommittees.length > 0
          ? `محطات طبية مزدحمة: ${num(longMedicalQueues.length)}، لجان بلا اعتماد يومي: ${num(unsignedCommittees.length)}.`
          : 'اللجان والمحطات الطبية لا تظهر ضغطًا يتطلب تدخلًا فوريًا.',
      actionLabel: 'فتح لوحة اللجان',
      href: ROUTES.committee.overview,
      tone: longMedicalQueues.length + unsignedCommittees.length > 0 ? 'warning' : 'success',
      icon: <Radio size={16} strokeWidth={1.75} />,
    },
    {
      key: 'risk',
      title: 'مخاطر الحوكمة والتكامل',
      value: num(governance.anomalies.length + unhealthyIntegrations.length),
      detail:
        governance.anomalies.length + unhealthyIntegrations.length > 0
          ? `إشارات شذوذ: ${num(governance.anomalies.length)}، تكاملات تحتاج متابعة: ${num(unhealthyIntegrations.length)}.`
          : 'لا توجد إشارات شذوذ أو أعطال تكامل مفتوحة في القراءة الحالية.',
      actionLabel: 'مراجعة سجل التدقيق',
      href: ROUTES.admin.audit,
      tone: governance.anomalies.length + unhealthyIntegrations.length > 0 ? 'danger' : 'success',
      icon: <ShieldAlert size={16} strokeWidth={1.75} />,
    },
  ];

  const executiveScore = Math.max(
    0,
    100
      - (bottleneck ? 14 : 0)
      - Math.min(18, governance.anomalies.length * 4)
      - Math.min(18, unhealthyIntegrations.length * 6)
      - Math.min(12, unsignedCommittees.length * 3)
      - Math.min(10, longMedicalQueues.length * 2),
  );

  return (
    <section className="mb-8">
      <Card className="overflow-hidden">
        <CardBody>
          <div className="grid gap-5 xl:grid-cols-[0.85fr_2.15fr]">
            <div className="border-b border-border-subtle pb-4 xl:border-b-0 xl:border-e xl:pe-5 xl:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-2xs uppercase tracking-wide text-gold-700">Executive Brief</p>
                  <h2 className="mt-1 font-ar-display text-xl font-bold text-ink-900">ملخص القرار الآن</h2>
                </div>
                <span className="rounded-pill bg-ink-100 px-3 py-1 text-2xs text-ink-700">
                  {RANGE_LABEL[range]}
                </span>
              </div>
              <p className="mt-3 text-sm leading-7 text-ink-600">
                هذه القراءة تدمج القبول، التشغيل، الحوكمة، والتكاملات في مؤشر واحد يساعد الإدارة على ترتيب التدخلات
                قبل أن تتحول الأرقام إلى اختناق داخل الدورة.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <BriefMetric label="جاهزية التشغيل" value={`${executiveScore}%`} tone={executiveScore >= 80 ? 'success' : 'warning'} />
                <BriefMetric
                  label="استخدام الطاقة"
                  value={snapshot.capacity ? `${Math.round(capacityRatio * 100)}%` : 'غير محدد'}
                  tone={capacityRatio >= 0.85 ? 'warning' : 'success'}
                />
                <BriefMetric label="تكاملات سليمة" value={`${snapshot.integrationsHealthy}/${snapshot.integrationsTotal}`} tone={unhealthyIntegrations.length === 0 ? 'success' : 'warning'} />
                <BriefMetric label="أيام متبقية" value={num(snapshot.daysRemaining)} tone={snapshot.daysRemaining <= 14 ? 'warning' : 'success'} />
              </div>
            </div>

            <ul className="grid gap-3 md:grid-cols-2">
              {decisions.map((decision) => (
                <li key={decision.key} className={`rounded-md border px-4 py-3 ${TONE_CLASS[decision.tone]}`}>
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-card"
                    >
                      {decision.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="truncate text-sm font-bold">{decision.title}</h3>
                        <span className="font-numeric tnum shrink-0 text-xl font-bold leading-none">
                          {decision.value}
                        </span>
                      </div>
                      <p className="mt-2 min-h-10 text-xs leading-6 text-ink-700">{decision.detail}</p>
                      <Link
                        to={decision.href}
                        className={`mt-3 inline-flex items-center gap-1 rounded-md px-2 py-1 text-2xs font-medium transition-colors focus-visible:outline-none focus-visible:shadow-focus-teal ${ACTION_CLASS[decision.tone]}`}
                      >
                        {decision.actionLabel}
                        <ArrowUpRight size={12} strokeWidth={1.75} aria-hidden className="rtl:scale-x-[-1]" />
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </CardBody>
      </Card>
    </section>
  );
}

function BriefMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'success' | 'warning';
}): JSX.Element {
  return (
    <div className="rounded-md border border-border-subtle bg-ink-50 px-3 py-2">
      <p className="text-2xs text-ink-500">{label}</p>
      <p className={`mt-1 font-numeric tnum text-lg font-bold ${tone === 'success' ? 'text-success' : 'text-gold-700'}`}>
        {value}
      </p>
    </div>
  );
}
