/**
 * Gauge — semicircle gauge (0..100 by default).
 * Source: Tasks/DESIGN_SYSTEM.md §4.13.
 *
 * Used in: medical BMI station, exam pass-rate, dashboard quick reads.
 * Color zones: 0-50 ink-300, 50-80 teal-500, 80-100 success.
 *
 * Usage:
 *   <Gauge value={72} label="معدل النجاح" suffix="%" />
 */

import { num } from '@/shared/lib/format';
import { prefersReducedMotion } from '@/shared/lib/motion';

interface GaugeProps {
  value: number;
  /** Defaults to 0..100. */
  min?: number;
  max?: number;
  /** Display label below the value. */
  label?: string;
  /** Suffix appended to the value (% etc.). */
  suffix?: string;
  /** Override the auto-zone colour. */
  color?: string;
  size?: number;
  ariaLabel?: string;
}

const ZONES = [
  { stop: 0.5, color: 'var(--ink-300)' },
  { stop: 0.8, color: 'var(--teal-500)' },
  { stop: 1.0, color: 'var(--success)' },
] as const;

export function Gauge({
  value,
  min = 0,
  max = 100,
  label,
  suffix,
  color,
  size = 180,
  ariaLabel,
}: GaugeProps): JSX.Element {
  const ratio = clamp01((value - min) / (max - min || 1));
  const fill = color ?? ZONES.find((z) => ratio <= z.stop)?.color ?? 'var(--teal-500)';
  const w = size;
  const h = size / 2 + 24;
  const cx = w / 2;
  const cy = size / 2;
  const r = size / 2 - 8;
  const stroke = 12;
  const animate = !prefersReducedMotion();
  const arcLength = Math.PI * r;
  const filled = arcLength * ratio;

  return (
    <div className="inline-flex flex-col items-center">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={ariaLabel ?? label ?? 'مؤشر'}
        style={{ width: w, height: h }}
      >
        {/* track */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="var(--ink-100)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* filled */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={fill}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${arcLength - filled}`}
        >
          {animate && (
            <animate
              attributeName="stroke-dasharray"
              from={`0 ${arcLength}`}
              to={`${filled} ${arcLength - filled}`}
              dur="0.6s"
              fill="freeze"
            />
          )}
        </path>
        <text
          x={cx}
          y={cy - 8}
          textAnchor="middle"
          fontSize={28}
          fontWeight={700}
          fontFamily="Cairo"
          style={{ fontFeatureSettings: '"tnum"' }}
          fill="var(--ink-900)"
        >
          {num(value)}
          {suffix && (
            <tspan fontSize={14} fill="var(--ink-500)" dx={2}>
              {suffix}
            </tspan>
          )}
        </text>
      </svg>
      {label && <span className="mt-1 text-sm text-ink-500">{label}</span>}
    </div>
  );
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
