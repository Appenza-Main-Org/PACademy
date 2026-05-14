/**
 * ApprovedRulesView — «عرض» tab body for the committees wizard step.
 *
 * Renders rows promoted from the «قواعد عامة» section in
 * `application_settings` (via the shared wizard store) as a flat
 * RTL data grid.
 *
 * Column order (RTL, right-to-left in the rendered table):
 *   بداية التقديم | نهاية التقديم | تاريخ احتساب السن | سنة التخرج (top) |
 *   النوع | الحالة الاجتماعية | التقدير | الدرجة العلمية | اللجنة | سنة التخرج (per-rule)
 */

import { useMemo } from 'react';
import { Card, EmptyState } from '@/shared/components';
import { useLookup } from '@/features/lookups';
import { useCommittees } from '@/features/committees/api/committee.queries';
import { date as fmtDate, num } from '@/shared/lib/format';
import {
  useAdmissionSetupWizardStore,
  type ApprovedGeneralRuleRow,
} from '../../store/wizardSharedState';

const TYPE_LABELS: Record<string, string> = {
  male: 'ذكر',
  female: 'أنثى',
};

const ACADEMIC_DEGREE_LABELS: Record<string, string> = {
  bachelor: 'بكالوريوس',
  higher_diploma: 'دبلوم عالٍ',
  master: 'ماجستير',
  doctorate: 'دكتوراه',
};

export function ApprovedRulesView(): JSX.Element {
  const approved = useAdmissionSetupWizardStore((s) => s.approved);

  const maritalQuery = useLookup('marital-statuses');
  const gradesQuery = useLookup('academic-grades');
  const committeesQuery = useCommittees();

  const maritalLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of maritalQuery.data ?? []) map.set(m.code, m.name);
    return map;
  }, [maritalQuery.data]);

  const gradeLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of gradesQuery.data ?? []) map.set(g.code, g.name);
    return map;
  }, [gradesQuery.data]);

  const committeeLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of committeesQuery.data ?? []) map.set(c.id, c.name);
    return map;
  }, [committeesQuery.data]);

  if (approved.length === 0) {
    return (
      <Card>
        <div className="p-6">
          <EmptyState
            variant="generic"
            title="لا توجد بيانات معتمدة"
            description="اعتمد القواعد من خطوة إعدادات التقديم لعرضها هنا."
          />
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm" dir="rtl">
          <thead className="bg-ink-50/80">
            <tr>
              <Th>بداية التقديم</Th>
              <Th>نهاية التقديم</Th>
              <Th>تاريخ احتساب السن</Th>
              <Th>سنة التخرج</Th>
              <Th>النوع</Th>
              <Th>الحالة الاجتماعية</Th>
              <Th>التقدير</Th>
              <Th>الدرجة العلمية</Th>
              <Th>اللجنة</Th>
              <Th>سنة التخرج</Th>
            </tr>
          </thead>
          <tbody>
            {approved.map((row) => (
              <Row
                key={row.id}
                row={row}
                maritalLabel={maritalLabel}
                gradeLabel={gradeLabel}
                committeeLabel={committeeLabel}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

interface RowProps {
  row: ApprovedGeneralRuleRow;
  maritalLabel: Map<string, string>;
  gradeLabel: Map<string, string>;
  committeeLabel: Map<string, string>;
}

function Row({
  row,
  maritalLabel,
  gradeLabel,
  committeeLabel,
}: RowProps): JSX.Element {
  const { header } = row;
  return (
    <tr className="border-t border-border-subtle">
      <Td>{formatIsoDate(header.applicationStart)}</Td>
      <Td>{formatIsoDate(header.applicationEnd)}</Td>
      <Td>{formatIsoDate(header.ageReferenceDate)}</Td>
      <Td>
        {header.graduationYears.length === 0
          ? '—'
          : header.graduationYears.map((y) => num(y)).join('، ')}
      </Td>
      <Td>{TYPE_LABELS[row.type] ?? row.type}</Td>
      <Td>{maritalLabel.get(row.maritalStatus) ?? row.maritalStatus}</Td>
      <Td>{gradeLabel.get(row.grade) ?? row.grade}</Td>
      <Td>
        {row.academicDegrees
          .map((d) => ACADEMIC_DEGREE_LABELS[d] ?? d)
          .join('، ')}
      </Td>
      <Td>
        {row.committees.map((id) => committeeLabel.get(id) ?? id).join('، ')}
      </Td>
      <Td>
        {row.graduationYears.length === 0
          ? '—'
          : row.graduationYears.map((y) => num(y)).join('، ')}
      </Td>
    </tr>
  );
}

function formatIsoDate(value: string): string {
  if (!value) return '—';
  return fmtDate(value, 'full');
}

function Th({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <th className="px-3 py-2 text-start font-ar text-2xs font-medium text-ink-600">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <td className="px-3 py-2 align-middle font-ar text-2xs text-ink-900">
      {children}
    </td>
  );
}
