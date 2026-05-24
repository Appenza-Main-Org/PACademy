/**
 * StatusPulseStrip — top of /admin/reports.
 * Five inline tiles separated by vertical dividers. Reads from
 * CycleSnapshot + IntegrationStatus[] and gives the page its live pulse.
 */

import { Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { date as fmtDate, num } from '@/shared/lib/format';
import { Card, LogoMark } from '@/shared/components';
import type { CycleSnapshot, IntegrationStatus } from '@/shared/types/domain';

interface StatusPulseStripProps {
  snapshot: CycleSnapshot;
  integrations: readonly IntegrationStatus[];
}

const INTEGRATION_TONE: Record<IntegrationStatus['status'], string> = {
  healthy: 'var(--success)',
  degraded: 'var(--gold-500)',
  down: 'var(--terra-500)',
};

export function StatusPulseStrip({ snapshot, integrations }: StatusPulseStripProps): JSX.Element {
  const degradedCount = integrations.filter((item) => item.status !== 'healthy').length;
  const StatusIcon = degradedCount > 0 ? AlertTriangle : CheckCircle2;
  const generatedTime = fmtDate(snapshot.generatedAt, 'time');
  const daysTone =
    snapshot.daysRemaining > 30
      ? 'text-success'
      : snapshot.daysRemaining > 14
        ? 'text-gold-700'
        : 'text-terra-700';

  return (
    <Card className="mb-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3">
        <div>
          <p className="text-2xs uppercase tracking-wide text-gold-700">Live Command Pulse</p>
          <h2 className="font-ar-display text-lg font-bold text-ink-900">المؤشرات التي لا تنتظر التقرير الكامل</h2>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-2xs ${
            degradedCount > 0 ? 'bg-gold-50 text-gold-700' : 'bg-success-bg text-success'
          }`}
        >
          <StatusIcon size={12} strokeWidth={1.75} aria-hidden />
          آخر قراءة {generatedTime}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-5 md:gap-x-6">
        <Tile
          label="الدورة النشطة"
          value={snapshot.cycleLabelAr}
          icon={<LogoMark size={22} />}
        />
        <Tile
          label="الأيام المتبقية للإغلاق"
          value={
            <span className={daysTone}>
              {num(snapshot.daysRemaining)} <span className="text-xs font-normal text-ink-500">يوم</span>
            </span>
          }
          divider
        />
        <Tile
          label="إجمالي المتقدمين"
          value={num(snapshot.totalApplicants)}
          divider
        />
        <Tile
          label="المعتمدون نهائياً"
          value={
            <span>
              {num(snapshot.finalApproved)}
              <span className="ms-2 text-xs font-normal text-ink-500">
                ({snapshot.acceptanceRate}%)
              </span>
            </span>
          }
          divider
        />
        <Tile
          label="حالة التكامل"
          value={
            <span className="flex items-center gap-2">
              <Activity size={14} strokeWidth={1.75} aria-hidden className="text-ink-500" />
              <span className="text-md">
                {snapshot.integrationsHealthy}/{snapshot.integrationsTotal}
              </span>
              <span className="flex items-center gap-1">
                {integrations.map((i) => (
                  <span
                    key={i.key}
                    aria-label={`${i.nameAr} · ${i.status}`}
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: INTEGRATION_TONE[i.status] }}
                  />
                ))}
              </span>
            </span>
          }
          divider
        />
      </dl>
    </Card>
  );
}

interface TileProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  divider?: boolean;
}

function Tile({ label, value, icon, divider }: TileProps): JSX.Element {
  return (
    <div
      className={
        divider
          ? 'border-t border-border-subtle pt-4 md:border-t-0 md:border-s md:ps-6 md:pt-0'
          : ''
      }
    >
      <dt className="flex items-center gap-2 text-2xs uppercase tracking-wide text-ink-500">
        {icon}
        <span>{label}</span>
      </dt>
      <dd className="mt-1 font-ar-display text-md font-bold text-ink-900">{value}</dd>
    </div>
  );
}
