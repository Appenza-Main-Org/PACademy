/**
 * Section 1 — نظرة عامة على الدورة (Cycle overview).
 * 3-column grid: registration tempo, acceptance rate, cycle status.
 */

import { TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/shared/components';
import { date as fmtDate, num } from '@/shared/lib/format';
import type { CycleSnapshot } from '@/shared/types/domain';
import { RegistrationTempoChart } from './RegistrationTempoChart';
import { SectionHeading } from './SectionHeading';
import type { TimeRange } from './RangeChips';

interface CycleOverviewSectionProps {
  snapshot: CycleSnapshot;
  range: TimeRange;
}

const RANGE_WINDOW_DAYS: Record<TimeRange, number | null> = {
  today: 1,
  '7d': 7,
  '30d': 30,
  cycle: null,
  compare: null,
};

const RANGE_SUBTITLE: Record<TimeRange, string> = {
  today: 'آخر يوم',
  '7d': 'آخر ٧ أيام',
  '30d': 'آخر ٣٠ يوم',
  cycle: 'الدورة الكاملة',
  compare: 'مقارنة بالدورة السابقة',
};

function sliceTail<T>(arr: readonly T[], n: number | null): readonly T[] {
  if (n === null || n >= arr.length) return arr;
  return arr.slice(arr.length - n);
}

export function CycleOverviewSection({ snapshot, range }: CycleOverviewSectionProps): JSX.Element {
  const window = RANGE_WINDOW_DAYS[range];
  const tempoThis = sliceTail(snapshot.registrationTempo.thisCycle, window);
  const tempoPrev = sliceTail(snapshot.registrationTempo.prevCycle, window);
  const hasPrevCycle = snapshot.registrationTempo.prevCycle.length > 0;
  const showCompareLine = (range === 'compare' || range === 'cycle') && hasPrevCycle;

  const thisTotal = tempoThis.reduce((s, p) => s + p.value, 0);
  const prevTotal = tempoPrev.reduce((s, p) => s + p.value, 0);
  const windowDelta =
    prevTotal > 0
      ? Math.round(((thisTotal - prevTotal) / prevTotal) * 1000) / 10
      : snapshot.registrationTempo.deltaPercent;

  const positive = windowDelta >= 0;
  const TrendIcon = positive ? TrendingUp : TrendingDown;
  const capacity = snapshot.capacity ?? 0;
  const capacityRatio = capacity > 0 ? Math.min(1, snapshot.totalApplicants / capacity) : 0;
  const closeFmt = fmtDate(snapshot.closeDateIso, 'short');

  return (
    <section className="mb-8">
      <SectionHeading
        title="نظرة عامة على الدورة"
        eyebrow={RANGE_SUBTITLE[range]}
      />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {/* Tile A — Registration tempo (this cycle vs previous) */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="إيقاع التقديم اليومي"
            subtitle={RANGE_SUBTITLE[range]}
            actions={
              hasPrevCycle ? (
                <span className="inline-flex items-center gap-1 text-xs">
                  <TrendIcon size={12} strokeWidth={2} className={positive ? 'text-success' : 'text-terra-700'} />
                  <span className={positive ? 'text-success' : 'text-terra-700'}>
                    {positive ? '+' : ''}
                    {windowDelta}%
                  </span>
                  <span className="text-ink-500">مقارنةً بالعام الماضي</span>
                </span>
              ) : undefined
            }
          />
          <CardBody>
            <RegistrationTempoChart thisCycle={tempoThis} prevCycle={showCompareLine ? tempoPrev : []} />
            <div className="mt-3 flex items-center gap-4 text-2xs text-ink-500">
              <LegendDot color="var(--teal-500)" label="الدورة الحالية" />
              {showCompareLine && <LegendDot color="var(--gold-400)" label="الدورة السابقة" />}
              <span className="ms-auto">
                إجمالي النطاق:{' '}
                <span className="font-numeric tnum text-ink-700">{num(thisTotal)}</span> متقدم
              </span>
            </div>
          </CardBody>
        </Card>

        {/* Tile B — Acceptance rate KPI */}
        <Card>
          <CardHeader title="معدل القبول الإجمالي" subtitle="من المتقدمين الذين أكملوا المراحل الإحدى عشر" />
          <CardBody>
            <p className="font-numeric tnum text-4xl font-bold leading-none text-ink-900">
              {snapshot.acceptanceRate}%
            </p>
            <p className="mt-2 text-xs text-ink-500">
              {num(snapshot.finalApproved)} من إجمالي {num(snapshot.totalApplicants)} متقدم
            </p>
            {hasPrevCycle && (
              <div className="mt-3 inline-flex items-center gap-1 text-2xs text-ink-500">
                <span>الدورة السابقة:</span>
                <span className="font-numeric tnum text-ink-700">{snapshot.prevCycleAcceptanceRate}%</span>
                <span
                  className={
                    snapshot.acceptanceRate - snapshot.prevCycleAcceptanceRate >= 0
                      ? 'text-success'
                      : 'text-terra-700'
                  }
                >
                  ({snapshot.acceptanceRate - snapshot.prevCycleAcceptanceRate >= 0 ? '+' : ''}
                  {Math.round((snapshot.acceptanceRate - snapshot.prevCycleAcceptanceRate) * 10) / 10}pp)
                </span>
              </div>
            )}
            {capacity > 0 && (
              <>
                <div className="mt-4 flex items-end justify-between text-2xs text-ink-500">
                  <span>الإقبال مقابل الطاقة الاستيعابية</span>
                  <span className="font-numeric tnum text-ink-700">
                    {num(snapshot.totalApplicants)} / {num(capacity)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-pill bg-ink-100">
                  <div
                    className="h-full rounded-pill"
                    style={{
                      width: `${Math.round(capacityRatio * 100)}%`,
                      background: 'var(--teal-500)',
                    }}
                  />
                </div>
              </>
            )}
          </CardBody>
        </Card>

        {/* Tile C — Cycle status */}
        <Card className="lg:col-span-3">
          <CardHeader title="حالة الدورة" subtitle="نوافذ التقديم لكل قسم في هذه الدورة" />
          <CardBody>
            <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
              <dl className="grid grid-cols-3 gap-x-4 gap-y-3 md:grid-cols-1">
                <Pair label="عنوان الدورة" value={snapshot.cycleLabelAr} />
                <Pair
                  label="موعد الإغلاق"
                  value={
                    <>
                      <span className="block">{closeFmt}</span>
                      <span className="block text-2xs text-ink-500">{snapshot.hijriCloseDate}</span>
                    </>
                  }
                />
                <Pair
                  label="الأيام المتبقية"
                  value={<span className="font-numeric tnum">{num(snapshot.daysRemaining)}</span>}
                />
              </dl>
              <ul className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {snapshot.categoriesOpen.map((c) => (
                  <li
                    key={c.key}
                    className="flex items-center justify-between rounded-md border border-border-subtle px-3 py-2 text-2xs"
                  >
                    <span className="truncate text-ink-700">{c.labelAr}</span>
                    <span
                      className={
                        c.isOpen
                          ? 'shrink-0 rounded-pill bg-success-bg px-2 py-0.5 text-success'
                          : 'shrink-0 rounded-pill bg-ink-100 px-2 py-0.5 text-ink-500'
                      }
                    >
                      {c.isOpen ? 'مفتوح' : 'مغلق'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </CardBody>
        </Card>
      </div>
    </section>
  );
}

function Pair({ label, value }: { label: string; value: React.ReactNode }): JSX.Element {
  return (
    <div>
      <dt className="text-2xs uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink-900">{value}</dd>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }): JSX.Element {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className="inline-block h-1.5 w-3 rounded-pill" style={{ background: color }} />
      <span>{label}</span>
    </span>
  );
}
