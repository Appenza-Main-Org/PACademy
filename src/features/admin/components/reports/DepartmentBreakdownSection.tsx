/**
 * Section 3 — التوزيع حسب الأقسام (Department breakdown).
 * 3-column grid: dept distribution donut, eligibility pass rate per dept,
 * top 5 rejection reasons.
 */

import { Card, CardBody, CardHeader } from '@/shared/components';
import { DonutChart } from '@/shared/components/charts';
import { num } from '@/shared/lib/format';
import type { DepartmentReport } from '@/shared/types/domain';
import { SectionHeading } from './SectionHeading';

interface DepartmentBreakdownSectionProps {
  report: DepartmentReport;
}

const DONUT_PALETTE = [
  'var(--teal-500)',
  'var(--gold-500)',
  'var(--terra-400)',
  'var(--teal-300)',
  'var(--gold-300)',
  'var(--ink-400)',
  'var(--teal-700)',
];

export function DepartmentBreakdownSection({ report }: DepartmentBreakdownSectionProps): JSX.Element {
  const totalApplicants = report.byDepartment.reduce((s, d) => s + d.total, 0);
  const donutData = report.byDepartment.map((d, i) => ({
    label: d.labelAr,
    value: d.total,
    color: DONUT_PALETTE[i % DONUT_PALETTE.length],
  }));

  return (
    <section className="mb-8">
      <SectionHeading title="التوزيع حسب الأقسام" eyebrow="RFP Scope Document §4(1-2) · Application Categories" />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title="التوزيع حسب القسم" subtitle={`${num(totalApplicants)} متقدم موزعون على ${report.byDepartment.length} أقسام`} />
          <CardBody>
            <DonutChart data={donutData} centerLabel="متقدم" size={200} />
            <ul className="mt-4 flex flex-col gap-1.5 text-2xs text-ink-700">
              {report.byDepartment.map((d, i) => (
                <li key={d.key} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 truncate">
                    <span
                      aria-hidden
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ background: DONUT_PALETTE[i % DONUT_PALETTE.length] }}
                    />
                    <span className="truncate">{d.labelAr}</span>
                  </span>
                  <span className="font-numeric tnum text-ink-500">{d.percentOfTotal}%</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="معدل الأهلية حسب القسم" subtitle="نسبة من اجتاز فحص الأهلية الأولي" />
          <CardBody>
            <ul className="flex flex-col gap-2.5">
              {report.byDepartment.map((d) => (
                <li key={d.key}>
                  <div className="flex items-center justify-between text-2xs">
                    <span className="truncate text-ink-700">{d.labelAr}</span>
                    <span className="font-numeric tnum text-ink-700">{d.eligibilityPassRate}%</span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-pill bg-ink-100">
                    <div
                      className="h-full rounded-pill"
                      style={{
                        width: `${Math.min(100, Math.max(2, d.eligibilityPassRate))}%`,
                        background:
                          d.eligibilityPassRate >= 70
                            ? 'var(--success)'
                            : d.eligibilityPassRate >= 50
                              ? 'var(--gold-500)'
                              : 'var(--terra-500)',
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="أسباب الرفض الأكثر شيوعاً" subtitle="أعلى ٥ أسباب لرفض الأهلية" />
          <CardBody>
            {report.topRejectionReasons.length === 0 ? (
              <p className="px-4 py-9 text-center text-sm text-ink-500">لا توجد بيانات</p>
            ) : (
              <RejectionReasonsList reasons={report.topRejectionReasons} />
            )}
          </CardBody>
        </Card>
      </div>
    </section>
  );
}

/** Horizontal ranked-bar list — clearer than a vertical bar chart for
 *  long Arabic labels with absolute + share-of-rejections context. */
function RejectionReasonsList({
  reasons,
}: {
  reasons: DepartmentReport['topRejectionReasons'];
}): JSX.Element {
  const max = Math.max(...reasons.map((r) => r.count), 1);
  const total = reasons.reduce((s, r) => s + r.count, 0);

  return (
    <div>
      <ol className="flex flex-col gap-3">
        {reasons.map((r, i) => {
          const fillPercent = Math.round((r.count / max) * 100);
          const shareOfTop = total > 0 ? Math.round((r.count / total) * 100) : 0;
          return (
            <li key={r.reason} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="font-numeric tnum inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-terra-50 text-2xs font-bold text-terra-700"
                >
                  {i + 1}
                </span>
                <p className="flex-1 text-sm leading-tight text-ink-900">{r.labelAr}</p>
                <span className="font-numeric tnum text-sm font-bold text-terra-700" dir="ltr">
                  {num(r.count)}
                </span>
              </div>
              <div className="flex items-center gap-2 ps-9">
                <div className="h-1.5 flex-1 overflow-hidden rounded-pill bg-ink-100">
                  <div
                    className="h-full rounded-pill bg-terra-500 transition-all duration-base ease-standard"
                    style={{ width: `${fillPercent}%` }}
                  />
                </div>
                <span className="font-numeric tnum w-10 shrink-0 text-end text-2xs text-ink-500">
                  {shareOfTop}%
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="font-numeric tnum mt-4 border-t border-border-subtle pt-3 text-2xs text-ink-500">
        إجمالي حالات الرفض في هذه الأسباب الخمسة:{' '}
        <span className="font-bold text-ink-900">{num(total)}</span>
      </p>
    </div>
  );
}
