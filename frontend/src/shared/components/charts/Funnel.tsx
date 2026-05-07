/**
 * Funnel — 4-stage funnel for applicant pipeline visualisation.
 * Source: Tasks/DESIGN_SYSTEM.md §4.13.
 *
 * Each stage rendered as a horizontal trapezoid; width proportional to the
 * stage value vs. the largest. Colour fades from teal-500 (inflow) to
 * teal-700 (final). Drop-off between stages annotated as a percentage.
 *
 * Usage:
 *   <Funnel
 *     stages={[
 *       { label: 'تسجيل أولي', value: 4200 },
 *       { label: 'سداد', value: 3850 },
 *       { label: 'لياقة', value: 2900 },
 *       { label: 'مقابلة', value: 1750 },
 *       { label: 'قبول نهائي', value: 980 },
 *     ]}
 *   />
 */

import { num } from '@/shared/lib/format';
import { prefersReducedMotion } from '@/shared/lib/motion';

interface FunnelStage {
  label: string;
  value: number;
}

interface FunnelProps {
  stages: readonly FunnelStage[];
  height?: number;
  ariaLabel?: string;
}

export function Funnel({
  stages,
  height = 36,
  ariaLabel = 'مخطط قمعي',
}: FunnelProps): JSX.Element {
  if (stages.length === 0) {
    return <p className="px-4 py-9 text-center text-sm text-ink-500">لا توجد بيانات</p>;
  }
  const max = Math.max(1, ...stages.map((s) => s.value));
  const animate = !prefersReducedMotion();

  return (
    <div role="img" aria-label={ariaLabel} className="flex w-full flex-col gap-2">
      {stages.map((stage, i) => {
        const ratio = stage.value / max;
        const previousValue = i > 0 ? stages[i - 1]!.value : null;
        const dropPct =
          previousValue && previousValue > 0
            ? Math.round(((previousValue - stage.value) / previousValue) * 100)
            : 0;
        const intensity = i / Math.max(1, stages.length - 1);
        const color = `color-mix(in srgb, var(--teal-500) ${100 - intensity * 50}%, var(--teal-700))`;
        return (
          <div key={stage.label} className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs text-ink-500">
                <span className="font-medium text-ink-900">{stage.label}</span>
                <span className="font-numeric tnum">
                  {num(stage.value)}
                  {previousValue !== null && (
                    <span className="ms-2 text-2xs text-terra-700">
                      −{dropPct}%
                    </span>
                  )}
                </span>
              </div>
              <div
                className="mt-1 overflow-hidden rounded-md"
                style={{ height, background: 'var(--ink-100)' }}
              >
                <div
                  className="h-full origin-inline-start"
                  style={{
                    width: `${Math.max(4, ratio * 100)}%`,
                    background: color,
                    transformOrigin: 'right',
                    animation: animate
                      ? `funnelEnter 0.6s var(--ease-standard) ${i * 0.05}s both`
                      : undefined,
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
      <style>{`@keyframes funnelEnter { from { transform: scaleX(0); } to { transform: scaleX(1); } }`}</style>
    </div>
  );
}
