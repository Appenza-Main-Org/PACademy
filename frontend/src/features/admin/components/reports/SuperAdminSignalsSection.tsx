/**
 * SuperAdminSignalsSection — cross-platform risk signals for /admin/reports.
 * Derives SLA breaches, stalled applicants, reviewer load imbalance, and
 * audit anomalies from the command-center datasets already available to admin.
 */

import { Link } from 'react-router-dom';
import { AlertTriangle, Activity, ArrowUpRight, ClipboardList, Scale, ShieldAlert } from 'lucide-react';
import { Card } from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { num } from '@/shared/lib/format';
import type { GovernanceReport, OperationalStatus, StageFunnelPoint } from '@/shared/types/domain';

interface SuperAdminSignalsSectionProps {
  funnel: readonly StageFunnelPoint[];
  operational: OperationalStatus;
  governance: GovernanceReport;
}

interface Signal {
  key: string;
  title: string;
  value: string;
  detail: string;
  actionLabel: string;
  href: string;
  tone: 'danger' | 'warning' | 'info';
  icon: JSX.Element;
}

const TONE_CLASS: Record<Signal['tone'], string> = {
  danger: 'border-terra-200 bg-terra-50 text-terra-700',
  warning: 'border-gold-200 bg-gold-50 text-gold-700',
  info: 'border-teal-100 bg-teal-50 text-teal-700',
};

const ACTION_CLASS: Record<Signal['tone'], string> = {
  danger: 'text-terra-700 hover:bg-terra-100',
  warning: 'text-gold-700 hover:bg-gold-100',
  info: 'text-teal-700 hover:bg-teal-100',
};

export function SuperAdminSignalsSection({
  funnel,
  operational,
  governance,
}: SuperAdminSignalsSectionProps): JSX.Element {
  const bottlenecks = funnel.filter((point) => point.isBottleneck);
  const stalledApplicants = bottlenecks.reduce((sum, point) => sum + point.count, 0);
  const committeeLoads = operational.committees.map((committee) => committee.todayQueue);
  const maxLoad = Math.max(...committeeLoads, 0);
  const minLoad = Math.min(...committeeLoads, maxLoad);
  const loadSpread = maxLoad - minLoad;
  const unsignedCommittees = operational.committees.filter((committee) => !committee.signedOffToday).length;
  const longMedicalQueues = operational.medicalStations.filter((station) => station.avgWaitMinutes >= 35).length;
  const highSensitivity = governance.highSensitivityLast24h;

  const signals: Signal[] = [
    {
      key: 'sla',
      title: 'خرق مؤشرات الزمن',
      value: num(bottlenecks.length),
      detail: bottlenecks.length > 0
        ? `أعلى اختناق: ${bottlenecks[0]?.stageLabel ?? 'مرحلة غير محددة'}`
        : 'لا توجد مراحل تتجاوز حد المتابعة',
      actionLabel: 'فتح المتقدمين',
      href: ROUTES.admin.applicants,
      tone: bottlenecks.length > 0 ? 'danger' : 'info',
      icon: <AlertTriangle size={16} strokeWidth={1.75} />,
    },
    {
      key: 'stalled',
      title: 'متقدمون عالقون',
      value: num(stalledApplicants),
      detail: 'إجمالي المتقدمين داخل مراحل تتجاوز ٥ أيام متوسط انتظار',
      actionLabel: 'مراجعة سير العمل',
      href: ROUTES.admin.workflows,
      tone: stalledApplicants > 0 ? 'warning' : 'info',
      icon: <Activity size={16} strokeWidth={1.75} />,
    },
    {
      key: 'load',
      title: 'اختلال توزيع اللجان',
      value: num(loadSpread),
      detail: `الفارق بين أكبر وأصغر طابور اليوم. لجان بلا اعتماد: ${num(unsignedCommittees)}`,
      actionLabel: 'توزيع اللجان',
      href: ROUTES.committee.overview,
      tone: loadSpread >= 45 || unsignedCommittees > 0 ? 'warning' : 'info',
      icon: <Scale size={16} strokeWidth={1.75} />,
    },
    {
      key: 'medical',
      title: 'ضغط القومسيون الطبي',
      value: num(longMedicalQueues),
      detail: 'محطات يتجاوز متوسط انتظارها ٣٥ دقيقة',
      actionLabel: 'فتح القومسيون',
      href: ROUTES.medical.queue,
      tone: longMedicalQueues > 0 ? 'warning' : 'info',
      icon: <ClipboardList size={16} strokeWidth={1.75} />,
    },
    {
      key: 'audit',
      title: 'عمليات حساسة',
      value: num(highSensitivity),
      detail: `${num(governance.anomalies.length)} إشارات شذوذ مفتوحة للمراجعة`,
      actionLabel: 'فتح التدقيق',
      href: ROUTES.admin.audit,
      tone: governance.anomalies.length > 0 ? 'danger' : 'info',
      icon: <ShieldAlert size={16} strokeWidth={1.75} />,
    },
  ];

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-2xs uppercase tracking-wide text-gold-700">Decision Signals</p>
          <h2 className="font-ar-display text-lg font-bold text-ink-900">إشارات تحتاج قرارًا إداريًا</h2>
        </div>
        <p className="max-w-2xl text-xs leading-6 text-ink-500">
          هذه القراءة تجمع بين مسار المتقدمين، التشغيل الفوري، وسجل التدقيق حتى لا يرى المدير العام أرقامًا جميلة
          بينما توجد اختناقات عملية تحت السطح.
        </p>
      </div>
      <Card>
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {signals.map((signal) => (
            <li key={signal.key} className={`rounded-md border px-3 py-3 ${TONE_CLASS[signal.tone]}`}>
              <div className="flex items-center gap-2">
                <span aria-hidden className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-card">
                  {signal.icon}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{signal.title}</p>
                  <p className="font-numeric tnum text-2xl font-bold leading-tight">{signal.value}</p>
                </div>
              </div>
              <p className="mt-2 min-h-10 text-2xs leading-5 text-ink-700">{signal.detail}</p>
              <Link
                to={signal.href}
                className={`mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-2xs font-medium transition-colors focus-visible:outline-none focus-visible:shadow-focus-teal ${ACTION_CLASS[signal.tone]}`}
              >
                {signal.actionLabel}
                <ArrowUpRight size={12} strokeWidth={1.75} aria-hidden className="rtl:scale-x-[-1]" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
