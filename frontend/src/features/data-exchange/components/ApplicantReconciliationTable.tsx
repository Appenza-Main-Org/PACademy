/**
 * ApplicantReconciliationTable — per-applicant field-level diff display.
 *
 * Renders the Applicants reconciliation preview as expandable rows: each
 * matched applicant exposes a sub-table of `{field, before, after}` diffs
 * with per-field checkboxes the admin uses to accept or reject changes.
 * Result + next-exam writeback (if present) sits in its own band with a
 * single «اعتماد النتيجة» toggle.
 *
 * Selection state is hoisted to the parent — this component is presentation
 * + checkbox plumbing only. Commit happens via the parent's mutation hook.
 */

import { useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronUp, UserX } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader } from '@/shared/components';
import type { BadgeTone } from '@/shared/components/Badge';
import type {
  ApplicantReconciliationPreview,
  ApplicantReconciliationRow,
} from '../types';

/** Per-applicant decision: which fields the admin accepted + whether to
 *  apply the result/next-exam writeback. Keyed by national ID. */
export interface ReconciliationDecisionState {
  acceptedFields: ReadonlySet<string>;
  applyWriteback: boolean;
}

interface ApplicantReconciliationTableProps {
  preview: ApplicantReconciliationPreview;
  decisions: ReadonlyMap<string, ReconciliationDecisionState>;
  testNameByCode: ReadonlyMap<string, string>;
  onDecisionsChange: (next: Map<string, ReconciliationDecisionState>) => void;
  committing: boolean;
  onCommit: () => void;
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
  WRITEBACK_NEXT_EXAM_MISSING: { tone: 'warning', label: 'موعد الاختبار التالي مفقود' },
};

export function ApplicantReconciliationTable({
  preview,
  decisions,
  testNameByCode,
  onDecisionsChange,
  committing,
  onCommit,
}: ApplicantReconciliationTableProps): JSX.Element {
  const matched = useMemo(() => preview.rows.filter((r) => !r.unmatched), [preview.rows]);
  const unmatched = useMemo(() => preview.rows.filter((r) => r.unmatched), [preview.rows]);
  const actionableMatched = useMemo(
    () => matched.filter((r) => r.fieldDiffs.length > 0 || r.writeback?.outcome != null),
    [matched],
  );

  const acceptedRowCount = useMemo(
    () =>
      Array.from(decisions.values()).filter(
        (d) => d.acceptedFields.size > 0 || d.applyWriteback,
      ).length,
    [decisions],
  );

  function patchDecision(nid: string, patch: Partial<ReconciliationDecisionState>): void {
    const next = new Map(decisions);
    const current = next.get(nid) ?? { acceptedFields: new Set<string>(), applyWriteback: false };
    next.set(nid, {
      acceptedFields: patch.acceptedFields ?? current.acceptedFields,
      applyWriteback: patch.applyWriteback ?? current.applyWriteback,
    });
    onDecisionsChange(next);
  }

  function acceptAllValid(): void {
    const next = new Map<string, ReconciliationDecisionState>();
    for (const row of actionableMatched) {
      if (row.writeback?.errors.includes('RESULT_VALUE_UNKNOWN')) continue;
      next.set(row.nationalId, {
        acceptedFields: new Set(row.fieldDiffs.map((d) => d.field)),
        applyWriteback:
          row.writeback?.outcome != null
          && !row.writeback.errors.includes('RESULT_VALUE_UNKNOWN')
          && !row.writeback.errors.includes('WRITEBACK_NEXT_EXAM_MISSING'),
      });
    }
    onDecisionsChange(next);
  }

  function rejectAll(): void {
    onDecisionsChange(new Map());
  }

  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><Check size={18} /> مراجعة بيانات المتقدمين</span>}
        subtitle="راجع النتائج قبل الاعتماد."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={acceptAllValid}
              className="rounded-md border border-[var(--accent-500)] bg-[var(--accent-50)] px-3 py-1.5 text-2xs font-semibold text-ink-900 transition-colors hover:bg-[var(--accent-100)]"
            >
              اعتماد المطابق الصالح فقط
            </button>
            <button
              type="button"
              onClick={rejectAll}
              className="rounded-md border border-border-default bg-surface-card px-3 py-1.5 text-2xs font-semibold text-ink-700 transition-colors hover:bg-ink-50"
            >
              رفض الكل
            </button>
          </div>
        }
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
              {unmatched.slice(0, 8).map((r) => (
                <li key={r.nationalId || Math.random()} className="font-mono">
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
                  decision={decisions.get(row.nationalId)}
                  testNameByCode={testNameByCode}
                  onPatch={(patch) => patchDecision(row.nationalId, patch)}
                />
              ))}
            </div>
          )}
        </div>

        {actionableMatched.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-ink-50 px-4 py-3">
            <p className="text-xs leading-6 text-ink-500">
              <span className="font-semibold text-ink-700">{acceptedRowCount}</span> متقدم محدد للاعتماد —
              التغييرات المرفوضة لن تُكتب.
            </p>
            <Button
              variant="primary"
              isLoading={committing}
              disabled={acceptedRowCount === 0}
              onClick={onCommit}
            >
              اعتماد التغييرات المحددة
            </Button>
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
  decision,
  testNameByCode,
  onPatch,
}: {
  row: ApplicantReconciliationRow;
  decision: ReconciliationDecisionState | undefined;
  testNameByCode: ReadonlyMap<string, string>;
  onPatch: (patch: Partial<ReconciliationDecisionState>) => void;
}): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const accepted = decision?.acceptedFields ?? new Set<string>();
  const applyWriteback = decision?.applyWriteback ?? false;
  const writeback = row.writeback;
  const hasBlockingWritebackError =
    writeback?.errors.includes('RESULT_VALUE_UNKNOWN') ?? false;
  const outcomeMeta = getOutcomeMeta(writeback?.outcome ?? null);
  const testDisplay = getTestDisplay(writeback?.testCode ?? null, testNameByCode);

  function toggleField(field: string): void {
    const next = new Set(accepted);
    if (next.has(field)) next.delete(field);
    else next.add(field);
    onPatch({ acceptedFields: next });
  }

  function toggleAll(allOn: boolean): void {
    onPatch({
      acceptedFields: allOn ? new Set(row.fieldDiffs.map((d) => d.field)) : new Set(),
    });
  }

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
          <SummaryField
            label="الاختبار"
            value={testDisplay.label}
            title={testDisplay.title}
            isMonospace={false}
          />
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
          {writeback?.outcome && (
            <label
              className={[
                'inline-flex h-9 items-center gap-2 rounded-md border px-3 text-2xs font-semibold transition-colors',
                hasBlockingWritebackError
                  ? 'cursor-not-allowed border-terra-300 bg-terra-50 text-terra-700 opacity-70'
                  : applyWriteback
                    ? 'cursor-pointer border-[var(--accent-500)] bg-[var(--accent-50)] text-ink-900'
                    : 'cursor-pointer border-border-default bg-surface-card text-ink-700 hover:bg-ink-50',
              ].join(' ')}
            >
              <input
                type="checkbox"
                checked={applyWriteback}
                disabled={hasBlockingWritebackError}
                onChange={(event) => onPatch({ applyWriteback: event.target.checked })}
                className="accent-teal-500"
              />
              اعتماد
            </label>
          )}
        </div>
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-border-subtle bg-ink-50 px-3 py-3">
          {row.fieldDiffs.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-2xs font-semibold text-ink-700">الحقول المُعدَّلة</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => toggleAll(true)}
                    className="text-2xs font-semibold text-[var(--accent-700)] hover:underline"
                  >
                    اعتماد الكل
                  </button>
                  <span className="text-ink-300">·</span>
                  <button
                    type="button"
                    onClick={() => toggleAll(false)}
                    className="text-2xs font-semibold text-ink-600 hover:underline"
                  >
                    إلغاء الكل
                  </button>
                </div>
              </div>
              <ul className="space-y-1.5">
                {row.fieldDiffs.map((diff) => (
                  <li
                    key={diff.field}
                    className={[
                      'flex items-start gap-3 rounded-md border px-2.5 py-2 transition-colors',
                      accepted.has(diff.field)
                        ? 'border-[var(--accent-500)] bg-[var(--accent-50)]'
                        : 'border-border-subtle bg-ink-50',
                    ].join(' ')}
                  >
                    <label className="mt-0.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={accepted.has(diff.field)}
                        onChange={() => toggleField(diff.field)}
                        className="accent-teal-500"
                        aria-label={`اعتماد تغيير ${FIELD_LABELS_AR[diff.field] ?? diff.field}`}
                      />
                    </label>
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
                          <span className="text-ink-900 font-semibold">{diff.after || '—'}</span>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {row.fieldDiffs.length === 0 && (
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
          className={[
            'truncate text-2xs font-semibold text-ink-800',
            isMonospace ? 'font-mono' : '',
          ].join(' ')}
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
  return {
    label: testNameByCode.get(testCode) ?? testCode,
    title: testCode,
  };
}

function getOutcomeMeta(outcome: string | null): { label: string; tone: BadgeTone } | null {
  if (!outcome) return null;
  if (outcome === 'passed') return { label: 'ناجح', tone: 'success' };
  if (outcome === 'failed') return { label: 'راسب', tone: 'danger' };
  if (outcome === 'in-progress') return { label: 'مؤجل', tone: 'warning' };
  return { label: outcome, tone: 'neutral' };
}
