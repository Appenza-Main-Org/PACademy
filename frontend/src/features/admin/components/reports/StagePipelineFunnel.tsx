/**
 * Section 2 — قمع المراحل الإحدى عشر (11-stage pipeline funnel).
 * Headline visual: horizontal rounded-rect funnel + drop-off table +
 * average-time-at-stage horizontal bar chart.
 */

import { Card, CardBody, CardHeader } from '@/shared/components';
import { num } from '@/shared/lib/format';
import { prefersReducedMotion } from '@/shared/lib/motion';
import type { StageFunnelPoint } from '@/shared/types/domain';
import { SectionHeading } from './SectionHeading';

interface StagePipelineFunnelProps {
  funnel: readonly StageFunnelPoint[];
}

export function StagePipelineFunnel({ funnel }: StagePipelineFunnelProps): JSX.Element {
  const maxCount = Math.max(1, ...funnel.map((p) => p.count));
  const bottlenecks = funnel.filter((p) => p.isBottleneck);
  const worstDrop = funnel
    .slice(1)
    .reduce<StageFunnelPoint | null>(
      (current, point) =>
        current === null || point.dropOffFromPrevPercent > current.dropOffFromPrevPercent ? point : current,
      null,
    );

  return (
    <section className="mb-8">
      <SectionHeading
        title="قمع المراحل الإحدى عشر"
        eyebrow="Application Pipeline"
        trailing={
          <div className="flex flex-wrap items-center gap-2 text-2xs">
            <span className="rounded-pill bg-terra-50 px-2.5 py-1 text-terra-700">
              اختناقات: <span className="font-numeric tnum font-bold">{num(bottlenecks.length)}</span>
            </span>
            <span className="rounded-pill bg-gold-50 px-2.5 py-1 text-gold-700">
              أعلى فاقد: <span className="font-numeric tnum font-bold">{worstDrop?.dropOffFromPrevPercent ?? 0}%</span>
            </span>
          </div>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader
            title="عدد المتقدمين الحاليين بكل مرحلة"
            subtitle={worstDrop ? `أكثر نقطة فقد عند الانتقال إلى ${worstDrop.stageLabel}` : 'لا يوجد فقد واضح بين المراحل'}
          />
          <CardBody>
            <FunnelSvg points={funnel} maxCount={maxCount} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="متوسط الزمن بكل مرحلة" subtitle="بالأيام · يحدد الاختناقات" />
          <CardBody>
            <ul className="flex flex-col gap-2">
              {funnel.map((p) => {
                const widthPct = (p.avgDaysAtStage / 7) * 100;
                return (
                  <li key={p.stageIndex} className="flex items-center gap-3 text-xs">
                    <span className="w-32 shrink-0 truncate text-ink-700">{p.stageLabel}</span>
                    <span className="relative flex-1 overflow-hidden rounded-pill bg-ink-100" style={{ height: 8 }}>
                      <span
                        className="absolute inset-y-0 start-0 rounded-pill"
                        style={{
                          width: `${Math.min(100, Math.max(2, widthPct))}%`,
                          background: p.isBottleneck ? 'var(--terra-500)' : 'var(--accent-500)',
                        }}
                      />
                    </span>
                    <span className="w-14 shrink-0 text-end font-numeric tnum text-ink-700">
                      {p.avgDaysAtStage} يوم
                    </span>
                    {p.isBottleneck && (
                      <span className="rounded-pill bg-terra-50 px-2 py-0.5 text-2xs text-terra-700">
                        اختناق
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader title="نسبة الانسحاب بين المراحل المتتالية" />
        <CardBody>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-2xs uppercase tracking-wide text-ink-500">
                <th className="py-2 text-start font-medium">من</th>
                <th className="py-2 text-start font-medium">إلى</th>
                <th className="py-2 text-end font-medium">انسحاب</th>
              </tr>
            </thead>
            <tbody>
              {funnel.slice(1).map((p, idx) => {
                const prev = funnel[idx]!;
                const worst = Math.max(...funnel.slice(1).map((q) => q.dropOffFromPrevPercent));
                const isWorst = p.dropOffFromPrevPercent === worst && worst > 0;
                return (
                  <tr key={p.stageIndex} className="border-t border-border-subtle">
                    <td className="py-2 text-ink-700">{prev.stageLabel}</td>
                    <td className="py-2 text-ink-700">{p.stageLabel}</td>
                    <td
                      className={`py-2 text-end font-numeric tnum ${
                        isWorst ? 'font-bold text-terra-700' : 'text-ink-700'
                      }`}
                    >
                      {p.dropOffFromPrevPercent}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </section>
  );
}

interface FunnelSvgProps {
  points: readonly StageFunnelPoint[];
  maxCount: number;
}

function FunnelSvg({ points, maxCount }: FunnelSvgProps): JSX.Element {
  const animate = !prefersReducedMotion();
  const w = 760;
  const padding = { top: 12, end: 8, start: 8 };
  const rowHeight = 32;
  const gap = 6;
  const h = padding.top + points.length * (rowHeight + gap);
  const plotW = w - padding.start - padding.end;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="قمع المتقدمين عبر المراحل" style={{ width: '100%', height: 'auto' }}>
      <defs>
        <linearGradient id="funnel-grad" x1="0%" x2="100%">
          <stop offset="0%" stopColor="var(--teal-500)" />
          <stop offset="100%" stopColor="var(--gold-500)" />
        </linearGradient>
      </defs>
      {points.map((p, i) => {
        const ratio = p.count / maxCount;
        const barW = Math.max(180, ratio * plotW);
        const y = padding.top + i * (rowHeight + gap);
        const intensity = i / Math.max(1, points.length - 1);
        const x = padding.start;
        return (
          <g key={p.stageIndex}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={rowHeight}
              rx={6}
              fill="url(#funnel-grad)"
              fillOpacity={0.55 + intensity * 0.4}
            >
              {animate && (
                <animate attributeName="width" from={0} to={barW} dur="0.45s" begin={`${i * 0.04}s`} fill="freeze" />
              )}
            </rect>
            <text
              x={x + 12}
              y={y + rowHeight / 2 + 4}
              fontSize={12}
              fontWeight={600}
              fill="var(--ink-50)"
              style={{ paintOrder: 'stroke', stroke: 'var(--ink-900)', strokeWidth: 0.6, strokeOpacity: 0.4 }}
            >
              {p.stageIndex + 1}. {p.stageLabel}
            </text>
            <text
              x={x + barW + 8}
              y={y + rowHeight / 2 + 4}
              fontSize={11}
              fontFamily="Inter"
              style={{ fontFeatureSettings: '"tnum"' }}
              fill="var(--ink-700)"
            >
              {num(p.count)} · {p.percentOfTotal}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}
