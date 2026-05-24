/**
 * Section 4 — نتائج الاختبارات (Test results dashboard).
 * 5 stacked-bar tiles (one per test kind) + governorate × test-kind heatmap.
 */

import { Activity, Brain, Stethoscope, TestTube, TrendingDown, TrendingUp, UserCheck, type LucideIcon } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/shared/components';
import { HeatmapChart, HeatmapLegend } from '@/shared/components/charts';
import { num } from '@/shared/lib/format';
import type { TestKindForReport, TestKindResult, TestResultsReport } from '@/shared/types/domain';
import { SectionHeading } from './SectionHeading';

const KIND_ICON: Record<TestKindForReport, LucideIcon> = {
  medical: Stethoscope,
  physical: Activity,
  psychological: Brain,
  interview: UserCheck,
  drug: TestTube,
};

interface TestResultsSectionProps {
  report: TestResultsReport;
}

export function TestResultsSection({ report }: TestResultsSectionProps): JSX.Element {
  const weakestTest = report.byKind.slice().sort((a, b) => a.passRate - b.passRate)[0];
  const strongestDelta = report.byKind.slice().sort((a, b) => b.deltaPercent - a.deltaPercent)[0];

  return (
    <section className="mb-8">
      <SectionHeading
        title="نتائج الاختبارات"
        trailing={
          <div className="flex flex-wrap items-center gap-2 text-2xs">
            {weakestTest && (
              <span className="rounded-pill bg-terra-50 px-2.5 py-1 text-terra-700">
                أقل نجاح: <span className="font-medium">{weakestTest.labelAr}</span>
              </span>
            )}
            {strongestDelta && (
              <span className="rounded-pill bg-teal-50 px-2.5 py-1 text-teal-700">
                أفضل تحسن: <span className="font-medium">{strongestDelta.labelAr}</span>
              </span>
            )}
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {report.byKind.map((k) => (
          <TestKindTile key={k.kind} result={k} />
        ))}
      </div>

      <Card className="mt-5">
        <CardHeader
          title="معدل النجاح حسب المحافظة × نوع الاختبار"
          subtitle="أعلى ٨ محافظات حسب عدد المتقدمين"
          actions={<HeatmapLegend scale="pass-rate" />}
        />
        <CardBody>
          <HeatmapChart
            rows={report.governorateHeatmap.governorates}
            cols={report.governorateHeatmap.kinds.map((k) => labelFor(k))}
            data={report.governorateHeatmap.passRates}
            colorScale="pass-rate"
            formatCell={(v) => `${Math.round(v)}%`}
          />
        </CardBody>
      </Card>
    </section>
  );
}

function TestKindTile({ result }: { result: TestKindResult }): JSX.Element {
  const Icon = KIND_ICON[result.kind];
  const total = result.passed + result.failed + result.pending;
  const pPct = total > 0 ? (result.passed / total) * 100 : 0;
  const fPct = total > 0 ? (result.failed / total) * 100 : 0;
  const wPct = Math.max(0, 100 - pPct - fPct);
  const positive = result.deltaPercent >= 0;
  const TrendIcon = positive ? TrendingUp : TrendingDown;

  return (
    <Card variant="compact">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
          style={{ background: 'var(--accent-50)', color: 'var(--accent-600)' }}
        >
          <Icon size={14} strokeWidth={1.75} />
        </span>
        <h3 className="text-sm font-bold text-ink-900">{result.labelAr}</h3>
      </div>
      <div
        aria-label={`${result.labelAr} — اجتاز ${result.passed} · لم يجتز ${result.failed} · قيد الانتظار ${result.pending}`}
        className="mt-3 flex h-2.5 w-full overflow-hidden rounded-pill bg-ink-100"
      >
        <span style={{ width: `${pPct}%`, background: 'var(--success)' }} />
        <span style={{ width: `${fPct}%`, background: 'var(--terra-500)' }} />
        <span style={{ width: `${wPct}%`, background: 'var(--gold-400)' }} />
      </div>
      <div className="mt-2 flex items-baseline justify-between">
        <p className="font-numeric tnum text-2xl font-bold text-ink-900">{result.passRate}%</p>
        <span
          className={`inline-flex items-center gap-0.5 text-2xs font-medium ${
            positive ? 'text-success' : 'text-terra-700'
          }`}
        >
          <TrendIcon size={10} strokeWidth={2} />
          {positive ? '+' : ''}
          {result.deltaPercent}pp
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-1 text-2xs">
        <Stat label="اجتاز" value={result.passed} tone="text-success" />
        <Stat label="لم يجتز" value={result.failed} tone="text-terra-700" />
        <Stat label="انتظار" value={result.pending} tone="text-gold-700" />
      </dl>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }): JSX.Element {
  return (
    <div>
      <dt className="text-ink-500">{label}</dt>
      <dd className={`font-numeric tnum font-bold ${tone}`}>{num(value)}</dd>
    </div>
  );
}

function labelFor(kind: TestKindForReport): string {
  switch (kind) {
    case 'medical':
      return 'طبي';
    case 'physical':
      return 'بدني';
    case 'psychological':
      return 'نفسي';
    case 'interview':
      return 'مقابلة';
    case 'drug':
      return 'مخدرات';
  }
}
