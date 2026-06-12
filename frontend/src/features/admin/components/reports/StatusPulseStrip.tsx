/**
 * StatusPulseStrip — top of /admin/reports.
 * Five hero KPI tiles on sunken surfaces. Reads from CycleSnapshot +
 * IntegrationStatus[] and gives the page its live pulse — the numbers
 * here are the largest on the page by design (command-center scale).
 */

import { Activity, AlertTriangle, CalendarClock, CheckCircle2, Stamp, Users } from 'lucide-react';
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
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Tile
          label="الدورة النشطة"
          icon={<LogoMark size={20} />}
          value={
            <span className="font-ar-display text-xl font-bold leading-snug text-ink-900">
              {snapshot.cycleLabelAr}
            </span>
          }
        />
        <Tile
          label="الأيام المتبقية للإغلاق"
          icon={<CalendarClock size={16} strokeWidth={1.75} />}
          value={
            <span className={`font-numeric tnum text-3xl font-bold leading-none ${daysTone}`}>
              {num(snapshot.daysRemaining)}
              <span className="ms-1 font-ar text-xs font-normal text-ink-500">يوم</span>
            </span>
          }
        />
        <Tile
          label="إجمالي المتقدمين"
          icon={<Users size={16} strokeWidth={1.75} />}
          value={
            <span className="font-numeric tnum text-3xl font-bold leading-none text-ink-900">
              {num(snapshot.totalApplicants)}
            </span>
          }
        />
        <Tile
          label="المعتمدون نهائياً"
          icon={<Stamp size={16} strokeWidth={1.75} />}
          value={
            <span className="font-numeric tnum text-3xl font-bold leading-none text-ink-900">
              {num(snapshot.finalApproved)}
              <span className="ms-1 text-xs font-normal text-ink-500">({snapshot.acceptanceRate}%)</span>
            </span>
          }
        />
        <Tile
          label="حالة التكامل"
          icon={<Activity size={16} strokeWidth={1.75} />}
          value={
            <span className="flex items-baseline gap-2">
              <span className="font-numeric tnum text-3xl font-bold leading-none text-ink-900">
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
        />
      </dl>
    </Card>
  );
}

interface TileProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}

function Tile({ label, value, icon }: TileProps): JSX.Element {
  return (
    <div className="flex min-h-12 flex-col justify-between rounded-lg border border-border-subtle bg-ink-50 px-4 py-3">
      <dt className="flex items-center gap-2 text-2xs text-ink-500">
        {icon && (
          <span
            aria-hidden
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-card"
            style={{ color: 'var(--accent-600)' }}
          >
            {icon}
          </span>
        )}
        <span>{label}</span>
      </dt>
      <dd className="m-0 mt-2">{value}</dd>
    </div>
  );
}
