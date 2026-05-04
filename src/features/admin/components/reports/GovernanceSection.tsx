/**
 * Section 6 — الحوكمة والامتثال (Governance & compliance).
 * 3-column grid: audited-activity hourly chart, anomaly signals,
 * external integration health.
 */

import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Card, CardBody, CardHeader, EmptyState } from '@/shared/components';
import { num, relativeTime } from '@/shared/lib/format';
import { ROUTES } from '@/config/routes';
import type { GovernanceReport, IntegrationStatus } from '@/shared/types/domain';
import { SectionHeading } from './SectionHeading';
import type { TimeRange } from './RangeChips';

interface GovernanceSectionProps {
  governance: GovernanceReport;
  integrations: readonly IntegrationStatus[];
  range: TimeRange;
}

const HOURLY_WINDOW: Record<TimeRange, number> = {
  today: 12,
  '7d': 24,
  '30d': 24,
  cycle: 24,
  compare: 24,
};

const ACTIVITY_SUBTITLE: Record<TimeRange, string> = {
  today: 'النشاط المُدقَّق · آخر ١٢ ساعة',
  '7d': 'النشاط المُدقَّق · آخر ٢٤ ساعة',
  '30d': 'النشاط المُدقَّق · آخر ٢٤ ساعة',
  cycle: 'النشاط المُدقَّق · آخر ٢٤ ساعة',
  compare: 'النشاط المُدقَّق · آخر ٢٤ ساعة',
};

const STATUS_TONE: Record<IntegrationStatus['status'], { dot: string; label: string }> = {
  healthy: { dot: 'var(--success)', label: 'سليم' },
  degraded: { dot: 'var(--gold-500)', label: 'بطيء' },
  down: { dot: 'var(--terra-500)', label: 'متوقف' },
};

export function GovernanceSection({ governance, integrations, range }: GovernanceSectionProps): JSX.Element {
  const window = HOURLY_WINDOW[range];
  const hourly = governance.hourly.slice(governance.hourly.length - window);
  const total = hourly.reduce((s, b) => s + b.total, 0);
  const highSens = hourly.reduce((s, b) => s + b.highSensitivity, 0);

  return (
    <section className="mb-8">
      <SectionHeading
        title="الحوكمة والامتثال"
        eyebrow="RFP Scope Document §3 · Audit Log + Integration Monitoring"
      />
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Tile A — Audited activity */}
        <Card>
          <CardHeader
            title={ACTIVITY_SUBTITLE[range]}
            subtitle="الإجمالي مقابل العمليات حساسة الأثر"
          />
          <CardBody>
            <DualLineChart hourly={hourly} />
            <dl className="mt-3 grid grid-cols-2 gap-3 text-2xs">
              <div>
                <dt className="text-ink-500">إجمالي العمليات</dt>
                <dd className="mt-0.5 font-numeric tnum text-md font-bold text-ink-900">
                  {num(total)}
                </dd>
              </div>
              <div>
                <dt className="text-ink-500">حساسة الأثر</dt>
                <dd className="mt-0.5 font-numeric tnum text-md font-bold text-terra-700">
                  {num(highSens)}
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        {/* Tile B — Anomaly signals */}
        <Card>
          <CardHeader title="إشارات شذوذ" subtitle="عمليات تستحق المراجعة" />
          <CardBody>
            {governance.anomalies.length === 0 ? (
              <EmptyState variant="generic" title="لم تُرصد إشارات شذوذ" description="كل العمليات ضمن المعتاد." />
            ) : (
              <ul className="flex flex-col gap-2 text-2xs">
                {governance.anomalies.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-md border border-border-subtle px-3 py-2 transition-colors hover:bg-ink-50"
                  >
                    <Link
                      to={ROUTES.admin.audit}
                      className="flex flex-col gap-1 focus-visible:outline-none focus-visible:shadow-focus-teal"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-terra-700">
                          <AlertTriangle size={12} strokeWidth={2} />
                          <span className="font-medium">{a.reason}</span>
                        </span>
                        <span className="font-numeric tnum text-ink-500">{relativeTime(a.timestamp)}</span>
                      </div>
                      <p className="truncate text-ink-700">{a.actor} · {a.actionLabel}</p>
                      {a.applicantId && (
                        <p className="font-numeric tnum text-ink-500">{a.applicantId}</p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Tile C — Integration health */}
        <Card>
          <CardHeader title="حالة التكامل الخارجي" subtitle="ملخص آخر استدعاءات الأنظمة الخارجية" />
          <CardBody>
            <ul className="flex flex-col gap-2 text-2xs">
              {integrations.map((i) => {
                const tone = STATUS_TONE[i.status];
                return (
                  <li
                    key={i.key}
                    className="flex items-center justify-between gap-3 rounded-md border border-border-subtle px-3 py-2"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: tone.dot }} />
                      <span className="truncate text-ink-700">{i.nameAr}</span>
                    </span>
                    <span className="flex items-center gap-3 shrink-0 text-ink-500">
                      <span>{tone.label}</span>
                      <span>{i.lastCallRelative}</span>
                      <span className="font-numeric tnum">{num(i.callsToday)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      </div>
    </section>
  );
}

interface DualLineChartProps {
  hourly: readonly GovernanceReport['hourly'][number][];
}

function DualLineChart({ hourly }: DualLineChartProps): JSX.Element {
  const w = 600;
  const h = 180;
  const padding = { top: 12, right: 12, bottom: 24, left: 12 };
  const plotW = w - padding.left - padding.right;
  const plotH = h - padding.top - padding.bottom;
  const max = Math.max(1, ...hourly.map((p) => p.total));
  const len = hourly.length;
  if (len === 0) return <p className="px-4 py-9 text-center text-sm text-ink-500">لا توجد بيانات</p>;

  const path = (key: 'total' | 'highSensitivity'): string =>
    hourly
      .map((d, i) => {
        const x = padding.left + (i / Math.max(1, len - 1)) * plotW;
        const y = padding.top + plotH - (d[key] / max) * plotH;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label="نشاط مُدقَّق آخر ٢٤ ساعة"
      style={{ width: '100%', height: h }}
    >
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = padding.top + plotH * (1 - t);
        return (
          <line
            key={t}
            x1={padding.left}
            x2={w - padding.right}
            y1={y}
            y2={y}
            stroke="var(--ink-100)"
            strokeDasharray="3 4"
          />
        );
      })}
      <path d={path('total')} fill="none" stroke="var(--gold-500)" strokeWidth={2} />
      <path d={path('highSensitivity')} fill="none" stroke="var(--terra-500)" strokeWidth={2} />
      {/* Hour labels every 4h */}
      {hourly.map((p, i) => {
        if (i % 4 !== 0) return null;
        const x = padding.left + (i / Math.max(1, len - 1)) * plotW;
        return (
          <text key={i} x={x} y={h - 6} textAnchor="middle" fontSize={10} fill="var(--ink-500)">
            {p.label}
          </text>
        );
      })}
    </svg>
  );
}
