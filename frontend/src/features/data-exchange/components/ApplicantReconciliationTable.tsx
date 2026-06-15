/**
 * ApplicantReconciliationTable — per-applicant field-level diff review.
 *
 * Renders the Applicants reconciliation preview as expandable, read-only
 * rows. Approval is a single bulk action — no per-row or per-field selection.
 * «اعتماد المطابق الصالح فقط» commits every displayed valid record at once;
 * «رفض الكل» dismisses the review without writing anything.
 */

import { useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronUp, UserX } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader } from '@/shared/components';
import type { BadgeTone } from '@/shared/components/Badge';
import type {
  ApplicantReconciliationDecision,
  ApplicantReconciliationPreview,
  ApplicantReconciliationRow,
} from '../types';

interface ApplicantReconciliationTableProps {
  preview: ApplicantReconciliationPreview;
  testNameByCode: ReadonlyMap<string, string>;
  committing: boolean;
  onApproveValid: (decisions: ApplicantReconciliationDecision[]) => void;
  onReject: () => void;
}

const FIELD_LABELS_AR: Record<string, string> = {
  fullName: 'الاسم الرباعي',
  name: 'الاسم',
  gender: 'النوع',
  phoneNumber: 'رقم الهاتف',
  mobile: 'رقم المحمول',
  email: 'البريد الإلكتروني',
  religion: 'الديانة',
  birthDate: 'تاريخ الميلاد',
  birthGovernorate: 'محافظة الميلاد',
  birthDistrict: 'مركز/قسم الميلاد',
  maritalStatus: 'الحالة الاجتماعية',
  governorate: 'المحافظة',
  city: 'المدينة',
  'address.governorate': 'العنوان · المحافظة',
  'address.city': 'العنوان · المدينة',
  'address.detail': 'العنوان · التفاصيل',
  'address.street': 'العنوان · الشارع',
};

const ERROR_CODE_LABELS: Record<string, { tone: BadgeTone; label: string }> = {
  APPLICANT_NID_UNMATCHED: { tone: 'warning', label: 'رقم قومي غير مطابق' },
  RESULT_VALUE_UNKNOWN: { tone: 'danger', label: 'قيمة نتيجة غير معروفة' },
};

function hasBlockedWriteback(row: ApplicantReconciliationRow): boolean {
  return row.writeback?.errors.includes('RESULT_VALUE_UNKNOWN') ?? false;
}

function willApplyWriteback(row: ApplicantReconciliationRow): boolean {
  const wb = row.writeback;
  return (
    wb?.outcome != null
    && !wb.errors.includes('RESULT_VALUE_UNKNOWN')
  );
}

function buildValidDecisions(
  rows: readonly ApplicantReconciliationRow[],
): ApplicantReconciliationDecision[] {
  const decisions: ApplicantReconciliationDecision[] = [];
  for (const row of rows) {
    if (hasBlockedWriteback(row)) continue;
    const acceptedFields = row.fieldDiffs.map((d) => d.field);
    const applyWriteback = willApplyWriteback(row);
    if (acceptedFields.length === 0 && !applyWriteback) continue;
    decisions.push({ nationalId: row.nationalId, acceptedFields, applyWriteback });
  }
  return decisions;
}

export function ApplicantReconciliationTable({
  preview,
  testNameByCode,
  committing,
  onApproveValid,
  onReject,
}: ApplicantReconciliationTableProps): JSX.Element {
  const matched = useMemo(() => preview.rows.filter((r) => !r.unmatched), [preview.rows]);
  const unmatched = useMemo(() => preview.rows.filter((r) => r.unmatched), [preview.rows]);
  const actionableMatched = useMemo(
    () => matched.filter((r) => r.fieldDiffs.length > 0 || r.writeback?.outcome != null),
    [matched],
  );

  const validDecisions = useMemo(
    () => buildValidDecisions(actionableMatched),
    [actionableMatched],
  );
  const validCount = validDecisions.length;
  const skippedCount = actionableMatched.length - validCount;

  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><Check size={18} /> مراجعة بيانات المتقدمين</span>}
        subtitle="راجع النتائج، ثم اعتمد كل السجلات الصالحة دفعة واحدة."
      />
      <CardBody className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-4">
          <ReconcileCounter label="مطابق" value={preview.counts.matched ?? 0} tone="info" />
          <ReconcileCounter label="غير مطابق" value={preview.counts.unmatched ?? 0} tone="warning" />
          <ReconcileCounter label="به تغييرات" value={preview.counts.withDiff ?? 0} tone="warning" />
          <ReconcileCounter label="به نتيجة" value={preview.counts.withWriteback ?? 0} tone="success" />
        </div>

        {unmatched.length > 0 && (
          <div className="rounded-md border border-terra-300 bg-terra-50 p-3 text-2xs text-terra-700">
            <p className="mb-1 flex items-center gap-1 font-semibold">
              <UserX size={14} /> {unmatched.length} متقدمين غير مطابقين — لن يُكتب لهم شيء.
            </p>
            <ul className="space-y-0.5 ps-5 text-2xs" dir="ltr">
              {unmatched.slice(0, 8).map((r, i) => (
                <li key={r.nationalId || i} className="font-mono">
                  {r.nationalId || '—'} {r.fullName ? `· ${r.fullName}` : ''}
                </li>
              ))}
              {unmatched.length > 8 && (
                <li className="text-terra-600">… و {unmatched.length - 8} متقدم آخر.</li>
              )}
            </ul>
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-card">
          {actionableMatched.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-ink-500">
              لا توجد تغييرات أو نتائج للمعاينة في الصفوف المطابقة.
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
              {actionableMatched.map((row) => (
                <ApplicantDiffRow
                  key={row.nationalId}
                  row={row}
                  testNameByCode={testNameByCode}
                />
              ))}
            </div>
          )}
        </div>

        {actionableMatched.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-ink-50 px-4 py-3">
            <p className="text-xs leading-6 text-ink-500">
              <span className="font-semibold text-ink-700">{validCount}</span> متقدم صالح للاعتماد دفعة واحدة
              {skippedCount > 0 && (
                <span className="text-terra-600"> — {skippedCount} صف مُتعذِّر لن يُكتب.</span>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" disabled={committing} onClick={onReject}>
                رفض الكل
              </Button>
              <Button
                variant="primary"
                isLoading={committing}
                disabled={validCount === 0}
                onClick={() => onApproveValid(validDecisions)}
              >
                اعتماد المطابق الصالح فقط
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function ReconcileCounter({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: BadgeTone;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between rounded-md border border-border-subtle bg-ink-50 px-3 py-2">
      <p className="text-2xs font-semibold text-ink-500">{label}</p>
      <Badge tone={tone}>{value}</Badge>
    </div>
  );
}

function ApplicantDiffRow({
  row,
  testNameByCode,
}: {
  row: ApplicantReconciliationRow;
  testNameByCode: ReadonlyMap<string, string>;
}): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const writeback = row.writeback;
  const outcomeMeta = getOutcomeMeta(writeback?.outcome ?? null);
  const testDisplay = getTestDisplay(writeback?.testCode ?? null, testNameByCode);
  const writebackApplies = willApplyWriteback(row);

  return (
    <article className="border-b border-border-subtle last:border-b-0">
      <div className="grid gap-3 px-3 py-3 lg:grid-cols-[minmax(16rem,1.1fr)_minmax(24rem,1.5fr)_auto] lg:items-center">
        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          className="flex min-w-0 items-center gap-3 rounded-md text-start transition-colors hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none"
          aria-expanded={expanded}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-ink-50 text-ink-600">
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink-900">{row.fullName ?? '—'}</span>
            <span dir="ltr" className="mt-0.5 block font-mono text-2xs text-ink-500">{row.nationalId}</span>
          </span>
        </button>

        <div className="grid gap-2 sm:grid-cols-3">
          <SummaryField label="النتيجة" value={writeback?.resultRaw ?? '—'} badge={outcomeMeta ? <Badge tone={outcomeMeta.tone}>{outcomeMeta.label}</Badge> : null} />
          <SummaryField label="الاختبار" value={testDisplay.label} title={testDisplay.title} isMonospace={false} />
          <SummaryField label="الموعد التالي" value={writeback?.nextExamDate ?? '—'} dir="ltr" />
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {row.fieldDiffs.length > 0 && <Badge tone="warning">{row.fieldDiffs.length} تغيير</Badge>}
          {writeback?.errors.map((code) => {
            const meta = ERROR_CODE_LABELS[code];
            return meta ? (
              <Badge key={code} tone={meta.tone}>
                <AlertTriangle size={11} className="me-1 inline-block" />
                {meta.label}
              </Badge>
            ) : null;
          })}
          {writebackApplies && (
            <Badge tone="success">
              <Check size={11} className="me-1 inline-block" />
              تُعتمد النتيجة
            </Badge>
          )}
          {hasBlockedWriteback(row) && (
            <Badge tone="danger">
              <AlertTriangle size={11} className="me-1 inline-block" />
              نتيجة مُتعذِّرة
            </Badge>
          )}
        </div>
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-border-subtle bg-ink-50 px-3 py-3">
          {row.fieldDiffs.length > 0 ? (
            <div className="space-y-2">
              <p className="text-2xs font-semibold text-ink-700">الحقول المُعدَّلة</p>
              <ul className="space-y-1.5">
                {row.fieldDiffs.map((diff) => (
                  <li
                    key={diff.field}
                    className="flex items-start gap-3 rounded-md border border-border-subtle bg-surface-card px-2.5 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-2xs font-semibold text-ink-800">
                        {FIELD_LABELS_AR[diff.field] ?? diff.field}
                      </p>
                      <div className="mt-1 grid gap-1 text-2xs sm:grid-cols-2">
                        <div>
                          <span className="text-ink-400">قبل: </span>
                          <span className="text-ink-700">{diff.before || '—'}</span>
                        </div>
                        <div>
                          <span className="text-ink-400">بعد: </span>
                          <span className="font-semibold text-ink-900">{diff.after || '—'}</span>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="rounded-md border border-border-subtle bg-surface-card px-3 py-2 text-2xs text-ink-500">
              لا توجد تعديلات حقول، هذا الصف يحتوي على نتيجة اختبار فقط.
            </p>
          )}
        </div>
      )}
    </article>
  );
}

function SummaryField({
  label,
  value,
  badge,
  dir,
  title,
  isMonospace = true,
}: {
  label: string;
  value: string;
  badge?: JSX.Element | null;
  dir?: 'ltr' | 'rtl';
  title?: string;
  isMonospace?: boolean;
}): JSX.Element {
  return (
    <div className="min-w-0 rounded-md border border-border-subtle bg-ink-50 px-3 py-2">
      <p className="mb-1 text-[10px] font-semibold text-ink-400">{label}</p>
      <div className="flex min-h-5 items-center gap-2">
        <span
          dir={dir}
          title={title}
          className={['truncate text-2xs font-semibold text-ink-800', isMonospace ? 'font-mono' : ''].join(' ')}
        >
          {value}
        </span>
        {badge}
      </div>
    </div>
  );
}

function getTestDisplay(
  testCode: string | null,
  testNameByCode: ReadonlyMap<string, string>,
): { label: string; title?: string } {
  if (!testCode) return { label: '—' };
  return { label: testNameByCode.get(testCode) ?? testCode, title: testCode };
}

function getOutcomeMeta(outcome: string | null): { label: string; tone: BadgeTone } | null {
  if (!outcome) return null;
  if (outcome === 'passed') return { label: 'ناجح', tone: 'success' };
  if (outcome === 'failed') return { label: 'راسب', tone: 'danger' };
  if (outcome === 'in-progress') return { label: 'مؤجل', tone: 'warning' };
  return { label: outcome, tone: 'neutral' };
}
