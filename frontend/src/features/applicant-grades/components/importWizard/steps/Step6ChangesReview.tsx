/**
 * Step 6 — مراجعة التغييرات.
 *
 * Per-row diff view for incoming records that already exist in the
 * database. Each row shows the changed fields side-by-side (existing
 * value → new value) with per-row "قبول التغييرات" / "رفض التغييرات"
 * buttons. A toolbar at the top exposes bulk accept-all / reject-all.
 *
 * Only rows the admin explicitly accepts are written by the commit —
 * rejected rows leave the existing record untouched. Rows whose
 * incoming data matches the existing record bit-for-bit are not
 * surfaced (no decision needed).
 *
 * Sibling concern — item 6: when the upload contains two different
 * `المجموع الكلي` values for the same nationalId, the conflict is
 * surfaced here too with a radio-style resolver. Default action is
 * `pick-higher` (highest total selected); the admin can switch to any
 * specific row via the radio picker, then confirm with the per-card
 * "قبول الطالب بالدرجة المختارة" button.
 */

import { useEffect, useMemo, type ReactNode } from 'react';
import { Check, CheckCircle2, ShieldAlert, X } from 'lucide-react';
import { Badge, Button, Card, CardBody } from '@/shared/components';
import { useImportWizardStore } from '../../../store/importWizard.store';
import type {
  ExistingDiffDecision,
  UploadDuplicateDecision,
} from '../../../store/importWizard.store';
import { useGrades } from '../../../api/grades.queries';
import { normaliseRows } from '../../../lib/normalise';
import {
  buildAlreadyImported,
  buildExistingDiffs,
  buildUploadDuplicates,
  type DiffCell,
  type ExistingDiff,
  type UploadDuplicate,
} from '../../../lib/buildDiff';

function formatCell(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '—';
  return String(value);
}

export function Step6ChangesReview(): JSX.Element {
  const parsed = useImportWizardStore((s) => s.parsed);
  const selectedTableName = useImportWizardStore((s) => s.selectedTableName);
  const mapping = useImportWizardStore((s) => s.mapping);
  const filters = useImportWizardStore((s) => s.filters);
  const lookupValueMappings = useImportWizardStore((s) => s.lookupValueMappings);
  const graduationYear = useImportWizardStore((s) => s.graduationYear);
  const selectedSchoolCategories = useImportWizardStore(
    (s) => s.selectedSchoolCategories,
  );
  const existingDiffDecisions = useImportWizardStore(
    (s) => s.existingDiffDecisions,
  );
  const setExistingDiffDecision = useImportWizardStore(
    (s) => s.setExistingDiffDecision,
  );
  const setBulkExistingDiffDecisions = useImportWizardStore(
    (s) => s.setBulkExistingDiffDecisions,
  );
  const uploadDuplicateDecisions = useImportWizardStore(
    (s) => s.uploadDuplicateDecisions,
  );
  const setUploadDuplicateDecision = useImportWizardStore(
    (s) => s.setUploadDuplicateDecision,
  );
  const setBulkUploadDuplicateDecisions = useImportWizardStore(
    (s) => s.setBulkUploadDuplicateDecisions,
  );
  const importResult = useImportWizardStore((s) => s.importResult);

  const { data: allRows } = useGrades();

  const normalised = useMemo(() => {
    const table = parsed?.tables.find((t) => t.name === selectedTableName) ?? null;
    if (!table || graduationYear == null) return [];
    return normaliseRows(
      table,
      mapping,
      filters,
      graduationYear,
      lookupValueMappings,
      selectedSchoolCategories,
    );
  }, [
    parsed,
    selectedTableName,
    mapping,
    filters,
    graduationYear,
    lookupValueMappings,
    selectedSchoolCategories,
  ]);

  const diffs = useMemo<ExistingDiff[]>(
    () => buildExistingDiffs(normalised, allRows ?? []).filter((d) => d.hasChanges),
    [normalised, allRows],
  );
  const alreadyImported = useMemo(
    () => buildAlreadyImported(normalised, allRows ?? []),
    [normalised, allRows],
  );
  /* Surface every duplicate-NID case — not just total conflicts — so
   * admins can explicitly pick which of the duplicate rows is the
   * canonical record (per request: "if the uploaded sheet has more than
   * one row with same national id, allow the admin to take action which
   * row to take"). */
  const uploadDuplicates = useMemo<UploadDuplicate[]>(
    () => buildUploadDuplicates(normalised),
    [normalised],
  );

  useEffect(() => {
    if (uploadDuplicates.length === 0) return;
    const seeded: Record<string, UploadDuplicateDecision> = {
      ...uploadDuplicateDecisions,
    };
    let touched = false;
    for (const u of uploadDuplicates) {
      if (seeded[u.nationalId] == null) {
        /* Default selection is the row with the highest total — seeded
         * as an explicit `pick-row` so the radio UI lights up on that
         * row immediately. Rows without a parseable total fall to the
         * first row so the commit has something deterministic to write. */
        seeded[u.nationalId] = {
          action: 'pick-row',
          pickedSourceRowIndex: pickDefaultRowIndex(u.rows),
        };
        touched = true;
      }
    }
    if (touched) setBulkUploadDuplicateDecisions(seeded);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [uploadDuplicates.length]);

  function acceptAllDiffs(): void {
    const next: Record<string, ExistingDiffDecision> = { ...existingDiffDecisions };
    for (const d of diffs) {
      const decision = existingDiffDecisions[d.nationalId] ?? 'pending';
      if (decision === 'pending') next[d.nationalId] = 'accept';
    }
    setBulkExistingDiffDecisions(next);
  }
  function rejectAllDiffs(): void {
    const next: Record<string, ExistingDiffDecision> = { ...existingDiffDecisions };
    for (const d of diffs) {
      const decision = existingDiffDecisions[d.nationalId] ?? 'pending';
      if (decision === 'pending') next[d.nationalId] = 'reject';
    }
    setBulkExistingDiffDecisions(next);
  }
  const acceptedCount = diffs.filter(
    (d) => existingDiffDecisions[d.nationalId] === 'accept',
  ).length;
  const rejectedCount = diffs.filter(
    (d) => existingDiffDecisions[d.nationalId] === 'reject',
  ).length;
  const pendingCount = diffs.filter((d) => {
    const decision = existingDiffDecisions[d.nationalId] ?? 'pending';
    return decision === 'pending';
  }).length;
  const diffBulkMode: BulkDecisionMode =
    diffs.length > 0 && acceptedCount === diffs.length
      ? 'accept'
      : diffs.length > 0 && rejectedCount === diffs.length
        ? 'reject'
        : null;
  const undecidedUploadDuplicates = uploadDuplicates.filter(
    (u) => uploadDuplicateDecisions[u.nationalId] == null,
  ).length;
  const uploadBulkMode = getUploadDuplicateBulkMode(
    uploadDuplicates,
    uploadDuplicateDecisions,
  );
  const skippedExistingCount = alreadyImported.length;
  const skippedCount = (importResult?.totals.skipped ?? 0) + skippedExistingCount;
  const importableCount = Math.max(
    0,
    (importResult?.totals.imported ?? normalised.length) - skippedExistingCount,
  );

  function acceptAllUploadDuplicates(): void {
    const next: Record<string, UploadDuplicateDecision> = {
      ...uploadDuplicateDecisions,
    };
    for (const duplicate of uploadDuplicates) {
      next[duplicate.nationalId] = {
        action: 'pick-row',
        pickedSourceRowIndex: pickDefaultRowIndex(duplicate.rows),
      };
    }
    setBulkUploadDuplicateDecisions(next);
  }

  function rejectAllUploadDuplicates(): void {
    const next: Record<string, UploadDuplicateDecision> = {
      ...uploadDuplicateDecisions,
    };
    for (const duplicate of uploadDuplicates) {
      next[duplicate.nationalId] = { action: 'reject' };
    }
    setBulkUploadDuplicateDecisions(next);
  }

  if (diffs.length === 0 && uploadDuplicates.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <ImportDecisionSummary
          received={importResult?.totals.received ?? normalised.length}
          importable={importableCount}
          skipped={skippedCount}
          rejected={importResult?.totals.failed ?? 0}
          skippedExisting={skippedExistingCount}
        />
        {alreadyImported.length > 0 && (
          <AlreadyImportedBanner count={alreadyImported.length} />
        )}
        <Card>
          <CardBody className="px-6 py-12 text-center">
            <Check
              size={36}
              strokeWidth={1.5}
              className="mx-auto text-success"
              aria-hidden
            />
            <h3 className="mt-3 text-base font-semibold text-ink-900">
              لا توجد تغييرات على سجلات موجودة
            </h3>
            <p className="m-0 mt-1 text-sm text-ink-500">
              جميع الصفوف في الملف جديدة أو متطابقة مع السجلات الحالية. تابع
              لاستكمال الاستيراد.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ImportDecisionSummary
        received={importResult?.totals.received ?? normalised.length}
        importable={importableCount}
        skipped={skippedCount}
        rejected={importResult?.totals.failed ?? 0}
        skippedExisting={skippedExistingCount}
      />
      {alreadyImported.length > 0 && (
        <AlreadyImportedBanner count={alreadyImported.length} />
      )}
      {uploadDuplicates.length > 0 && (
        <UploadDuplicatesSection
          duplicates={uploadDuplicates}
          decisions={uploadDuplicateDecisions}
          undecidedCount={undecidedUploadDuplicates}
          bulkMode={uploadBulkMode}
          onSetDecision={setUploadDuplicateDecision}
          onAcceptAll={acceptAllUploadDuplicates}
          onRejectAll={rejectAllUploadDuplicates}
        />
      )}

      {diffs.length > 0 && (
        <section className="flex flex-col gap-3">
          <header className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border-subtle bg-ink-50/40 px-3.5 py-2.5">
            <div className="flex items-center gap-2 text-xs text-ink-700">
              <ShieldAlert
                size={14}
                strokeWidth={1.75}
                className="text-gold-700"
                aria-hidden
              />
              <span>
                <span className="font-numeric font-bold text-ink-900">
                  {diffs.length.toLocaleString('en')}
                </span>{' '}
                سجلات موجودة قد تتأثر —
                <span className="me-1 ms-1 text-2xs text-teal-700">
                  مقبول:{' '}
                  <span className="font-numeric font-bold">
                    {acceptedCount.toLocaleString('en')}
                  </span>
                </span>
                <span className="text-2xs text-terra-700">
                  مرفوض:{' '}
                  <span className="font-numeric font-bold">
                    {rejectedCount.toLocaleString('en')}
                  </span>
                </span>
                <span className="me-1 ms-1 text-2xs text-ink-500">
                  قيد القرار:{' '}
                  <span className="font-numeric font-bold">
                    {pendingCount.toLocaleString('en')}
                  </span>
                </span>
          </span>
            </div>
            <BulkDecisionToggle
              mode={diffBulkMode}
              acceptLabel={`قبول الكل (${pendingCount.toLocaleString('en')})`}
              rejectLabel={`رفض الكل (${pendingCount.toLocaleString('en')})`}
              onAccept={acceptAllDiffs}
              onReject={rejectAllDiffs}
              disabled={pendingCount === 0}
            />
          </header>

          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {diffs.map((d) => (
              <li key={d.nationalId}>
                <DiffCard
                  diff={d}
                  decision={existingDiffDecisions[d.nationalId] ?? 'pending'}
                  onDecide={(decision) =>
                    setExistingDiffDecision(d.nationalId, decision)
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

type BulkDecisionMode = 'accept' | 'reject' | null;

interface ImportDecisionSummaryProps {
  received: number;
  importable: number;
  skipped: number;
  rejected: number;
  skippedExisting: number;
}

function ImportDecisionSummary({
  received,
  importable,
  skipped,
  rejected,
  skippedExisting,
}: ImportDecisionSummaryProps): JSX.Element {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border-subtle bg-white p-3">
      <div className="grid grid-cols-2 overflow-hidden rounded-md border border-border-subtle md:grid-cols-4">
        <DecisionStat label="مستلمة" value={received} />
        <DecisionStat label="سيتم استيرادها" value={importable} tone="success" />
        <DecisionStat label="سيتم تجاهلها" value={skipped} tone="warning" />
        <DecisionStat label="مرفوضة" value={rejected} tone="danger" />
      </div>
      {skippedExisting > 0 && (
        <div className="rounded-md border border-gold-200 bg-gold-50 px-3 py-2 text-xs text-gold-700">
          <span className="font-numeric font-bold text-ink-900">
            {skippedExisting.toLocaleString('en')}
          </span>{' '}
          صفًا موجود مسبقًا بنفس الرقم القومي وسنة التخرج، ولن يتم استيراده مرة أخرى.
        </div>
      )}
    </div>
  );
}

function DecisionStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'success' | 'warning' | 'danger';
}): JSX.Element {
  const toneClass =
    tone === 'success'
      ? 'bg-success-bg text-success'
      : tone === 'warning'
        ? 'bg-gold-50 text-gold-700'
        : tone === 'danger'
          ? 'bg-terra-50 text-terra-700'
          : 'bg-white text-ink-700';
  return (
    <div className={`border-e border-border-subtle px-3 py-2.5 last:border-e-0 ${toneClass}`}>
      <div className="text-2xs">{label}</div>
      <div className="mt-1 font-numeric text-xl font-bold">{value.toLocaleString('en')}</div>
    </div>
  );
}

interface BulkDecisionToggleProps {
  mode: BulkDecisionMode;
  acceptLabel: string;
  rejectLabel: string;
  onAccept: () => void;
  onReject: () => void;
  disabled?: boolean;
}

function BulkDecisionToggle({
  mode,
  acceptLabel,
  rejectLabel,
  onAccept,
  onReject,
  disabled,
}: BulkDecisionToggleProps): JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label="قرار جماعي"
      className="inline-flex overflow-hidden rounded-md border border-border-default bg-surface-card p-0.5 shadow-xs"
    >
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'reject'}
        disabled={disabled}
        onClick={onReject}
        className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-sm px-3 text-xs font-medium transition-colors focus-visible:shadow-focus-teal focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
          mode === 'reject'
            ? 'bg-terra-500 text-text-inverse'
            : 'text-ink-700 hover:bg-terra-50 hover:text-terra-700'
        }`}
      >
        <X size={12} strokeWidth={2} aria-hidden />
        {rejectLabel}
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'accept'}
        disabled={disabled}
        onClick={onAccept}
        className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-sm px-3 text-xs font-medium transition-colors focus-visible:shadow-focus-teal focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
          mode === 'accept'
            ? 'bg-teal-600 text-text-inverse'
            : 'text-ink-700 hover:bg-teal-50 hover:text-teal-700'
        }`}
      >
        <Check size={12} strokeWidth={2} aria-hidden />
        {acceptLabel}
      </button>
    </div>
  );
}

function getUploadDuplicateBulkMode(
  duplicates: ReadonlyArray<UploadDuplicate>,
  decisions: Record<string, UploadDuplicateDecision>,
): BulkDecisionMode {
  if (duplicates.length === 0) return null;
  let accepted = 0;
  let rejected = 0;
  for (const duplicate of duplicates) {
    const decision = decisions[duplicate.nationalId];
    if (decision?.action === 'reject') rejected += 1;
    else accepted += 1;
  }
  if (accepted === duplicates.length) return 'accept';
  if (rejected === duplicates.length) return 'reject';
  return null;
}

interface DiffCardProps {
  diff: ExistingDiff;
  decision: ExistingDiffDecision;
  onDecide: (decision: ExistingDiffDecision) => void;
}

function DiffCard({ diff, decision, onDecide }: DiffCardProps): JSX.Element {
  const changedCells = diff.cells.filter((c) => c.changed);
  const accent =
    decision === 'accept'
      ? 'var(--teal-500)'
      : decision === 'reject'
        ? 'var(--terra-400)'
        : 'var(--border-default)';
  return (
    <Card>
      <CardBody className="p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-6 w-1 rounded-pill"
              style={{ background: accent }}
            />
            <span className="font-medium text-ink-900">{diff.nameAr}</span>
            <span
              className="font-mono text-2xs text-ink-500"
              dir="ltr"
            >
              {diff.nationalId}
            </span>
            <Badge tone="info">
              <span className="font-numeric tabular-nums">
                {changedCells.length.toLocaleString('en')}
              </span>{' '}
              تغيير
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant={decision === 'reject' ? 'primary' : 'secondary'}
              leadingIcon={<X size={12} strokeWidth={2} aria-hidden />}
              onClick={() => onDecide('reject')}
            >
              رفض التغييرات
            </Button>
            <Button
              size="sm"
              variant={decision === 'accept' ? 'primary' : 'secondary'}
              leadingIcon={<Check size={12} strokeWidth={2} aria-hidden />}
              onClick={() => onDecide('accept')}
            >
              قبول التغييرات
            </Button>
          </div>
        </div>

        <div className="mt-3 overflow-hidden rounded-md border border-border-subtle">
          <table className="w-full border-collapse text-xs">
            <thead className="bg-ink-50/60 text-2xs uppercase text-ink-500">
              <tr>
                <th
                  scope="col"
                  className="px-3 py-1.5 text-start font-semibold"
                  style={{ width: '30%' }}
                >
                  الحقل
                </th>
                <th
                  scope="col"
                  className="px-3 py-1.5 text-start font-semibold"
                  style={{ width: '35%' }}
                >
                  القيمة الحالية
                </th>
                <th
                  scope="col"
                  className="px-3 py-1.5 text-start font-semibold"
                  style={{ width: '35%' }}
                >
                  القيمة الجديدة
                </th>
              </tr>
            </thead>
            <tbody>
              {changedCells.map((c) => (
                <DiffRow key={c.field} cell={c} />
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}

function DiffRow({ cell }: { cell: DiffCell }): JSX.Element {
  return (
    <tr className="border-t border-border-subtle first:border-t-0">
      <td className="px-3 py-1.5 align-top text-2xs font-semibold text-ink-700">
        {cell.labelAr}
      </td>
      <td className="px-3 py-1.5 align-top">
        <span className="rounded-pill bg-terra-50 px-2 py-0.5 font-mono text-2xs text-terra-700">
          {formatCell(cell.oldValue)}
        </span>
      </td>
      <td className="px-3 py-1.5 align-top">
        <span className="rounded-pill bg-teal-50 px-2 py-0.5 font-mono text-2xs text-teal-700">
          {formatCell(cell.newValue)}
        </span>
      </td>
    </tr>
  );
}

interface UploadDuplicatesSectionProps {
  duplicates: UploadDuplicate[];
  decisions: Record<string, UploadDuplicateDecision>;
  undecidedCount: number;
  bulkMode: BulkDecisionMode;
  onSetDecision: (nid: string, decision: UploadDuplicateDecision) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}

function UploadDuplicatesSection({
  duplicates,
  decisions,
  undecidedCount,
  bulkMode,
  onSetDecision,
  onAcceptAll,
  onRejectAll,
}: UploadDuplicatesSectionProps): JSX.Element {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gold-300 bg-gold-50 px-3.5 py-2.5">
        <div className="flex items-center gap-2 text-xs text-gold-700">
          <ShieldAlert size={14} strokeWidth={1.75} aria-hidden />
          <span>
            <span className="font-numeric font-bold text-ink-900">
              {duplicates.length.toLocaleString('en')}
            </span>{' '}
            رقم قومي مكرر داخل الملف. اختر الصف الذي تريد اعتماده لكل طالب —{' '}
            <span className="font-numeric font-bold">
              {undecidedCount.toLocaleString('en')}
            </span>{' '}
            بحاجة لقرار صريح.
          </span>
        </div>
        <BulkDecisionToggle
          mode={bulkMode}
          acceptLabel="قبول الكل"
          rejectLabel="رفض الكل"
          onAccept={onAcceptAll}
          onReject={onRejectAll}
        />
      </header>

      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {duplicates.map((u) => {
          const fallback: UploadDuplicateDecision = {
            action: 'pick-row',
            pickedSourceRowIndex: pickDefaultRowIndex(u.rows),
          };
          return (
            <li key={u.nationalId}>
              <UploadDuplicateCard
                duplicate={u}
                decision={decisions[u.nationalId] ?? fallback}
                onSetDecision={(d) => onSetDecision(u.nationalId, d)}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

interface UploadDuplicateCardProps {
  duplicate: UploadDuplicate;
  decision: UploadDuplicateDecision;
  onSetDecision: (decision: UploadDuplicateDecision) => void;
}

function UploadDuplicateCard({
  duplicate,
  decision,
  onSetDecision,
}: UploadDuplicateCardProps): JSX.Element {
  /* Sort rows by source order so the picker matches the file's row
   * numbering. Compute the row with the highest total so a "الأعلى"
   * chip can highlight it as the recommended pick. */
  const sortedRows = useMemo(
    () => [...duplicate.rows].sort((a, b) => a.sourceRowIndex - b.sourceRowIndex),
    [duplicate.rows],
  );
  const higherTotal =
    duplicate.distinctTotals.length > 0
      ? Math.max(...duplicate.distinctTotals)
      : null;
  const higherRowIndex = useMemo(() => {
    if (higherTotal == null) return null;
    return sortedRows.find((r) => r.totalGrade === higherTotal)?.sourceRowIndex ?? null;
  }, [sortedRows, higherTotal]);

  const selectedRowIndex = computeSelectedRowIndex(decision, sortedRows, higherTotal);

  function badgeLabel(): string {
    switch (decision.action) {
      case 'pick-higher':
        return 'قبول بالدرجة الأعلى';
      case 'pick-lower':
        return 'قبول بالدرجة الأدنى';
      case 'pick-specific':
        return `اختيار درجة: ${decision.pickedTotal}`;
      case 'pick-row':
        return `اختيار الصف رقم ${decision.pickedSourceRowIndex}`;
      case 'reject':
        return 'استبعاد الطالب';
    }
  }

  return (
    <Card>
      <CardBody className="p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-medium text-ink-900">
              {duplicate.nameAr ?? '—'}
            </span>
            <span className="font-mono text-2xs text-ink-500" dir="ltr">
              {duplicate.nationalId}
            </span>
            <Badge tone="warning">
              <span className="font-numeric tabular-nums">
                {duplicate.rows.length.toLocaleString('en')}
              </span>{' '}
              صفوف
            </Badge>
            {duplicate.hasTotalConflict && (
              <Badge tone="danger">تعارض في المجموع</Badge>
            )}
          </div>
          <Badge tone={decision.action === 'reject' ? 'danger' : 'info'}>
            {badgeLabel()}
          </Badge>
        </div>

        <div
          role="radiogroup"
          aria-label="اختر الصف المعتمد"
          className="mt-3 flex flex-col gap-2"
        >
          {sortedRows.map((row) => {
            const selected = selectedRowIndex === row.sourceRowIndex;
            const isHigher = higherRowIndex === row.sourceRowIndex;
            return (
              <button
                key={row.sourceRowIndex}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() =>
                  onSetDecision({
                    action: 'pick-row',
                    pickedSourceRowIndex: row.sourceRowIndex,
                  })
                }
                className="flex cursor-pointer flex-wrap items-center gap-3 rounded-md border bg-white px-3 py-2 text-start text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                style={{
                  borderColor: selected
                    ? 'var(--teal-500)'
                    : 'var(--border-default)',
                  background: selected ? 'var(--teal-50)' : 'var(--surface-card)',
                }}
              >
                <span className="flex shrink-0 items-center gap-2">
                  <span
                    aria-hidden
                    className="grid h-4 w-4 place-items-center rounded-full border"
                    style={{
                      borderColor: selected ? 'var(--teal-500)' : 'var(--ink-400)',
                    }}
                  >
                    {selected && (
                      <span
                        aria-hidden
                        className="h-2 w-2 rounded-full"
                        style={{ background: 'var(--teal-500)' }}
                      />
                    )}
                  </span>
                  <span className="rounded-pill bg-ink-100 px-2 py-0.5 font-en text-2xs font-semibold text-ink-700">
                    صف #
                    <span className="tabular-nums">{row.sourceRowIndex}</span>
                  </span>
                </span>
                <RowCell label="المجموع">
                  <span className="font-en text-sm font-bold text-ink-900">
                    {row.totalGrade ?? '—'}
                  </span>
                </RowCell>
                <RowCell label="الشعبة">
                  <span className="text-xs text-ink-700">
                    {row.track ?? '—'}
                  </span>
                </RowCell>
                <RowCell label="اسم المدرسة">
                  <span className="text-xs text-ink-700">
                    {row.schoolName ?? '—'}
                  </span>
                </RowCell>
                <RowCell label="الدور">
                  <span className="text-xs text-ink-700">
                    {row.examRound ?? '—'}
                  </span>
                </RowCell>
                {isHigher && duplicate.hasTotalConflict && (
                  <Badge tone="info">الأعلى</Badge>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant={decision.action !== 'reject' ? 'primary' : 'secondary'}
            leadingIcon={<Check size={12} strokeWidth={2} aria-hidden />}
            disabled={selectedRowIndex == null}
            onClick={() => {
              if (selectedRowIndex == null) return;
              onSetDecision({
                action: 'pick-row',
                pickedSourceRowIndex: selectedRowIndex,
              });
            }}
          >
            قبول
          </Button>
          <Button
            size="sm"
            variant={decision.action === 'reject' ? 'primary' : 'secondary'}
            leadingIcon={<X size={12} strokeWidth={2} aria-hidden />}
            onClick={() => onSetDecision({ action: 'reject' })}
          >
            رفض الطالب
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function RowCell({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <span className="inline-flex min-w-0 flex-col gap-0.5">
      <span className="text-2xs text-ink-500">{label}</span>
      <span className="truncate">{children}</span>
    </span>
  );
}

function AlreadyImportedBanner({ count }: { count: number }): JSX.Element {
  return (
    <div className="flex items-start gap-2 rounded-md border border-teal-200 bg-teal-50 px-3.5 py-2.5 text-xs text-teal-700">
      <CheckCircle2 size={14} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0" />
      <span>
        <span className="font-numeric font-bold text-ink-900">
          {count.toLocaleString('en')}
        </span>{' '}
        صفًا موجود مسبقًا بنفس الرقم القومي وبنفس سنة التخرج — سيُتجاهل تلقائيًا أثناء التأكيد
        لضمان وجود سجل واحد لكل طالب في نفس سنة التخرج. لا حاجة لاتخاذ قرار.
      </span>
    </div>
  );
}

/** Pick the default-selected row for a duplicate-NID group: the one
 *  with the highest parseable total. Ties break by source order (first
 *  occurrence wins). Falls back to the first row when no totals are
 *  parseable so the commit always has a deterministic target. */
function pickDefaultRowIndex(
  rows: ReadonlyArray<{ sourceRowIndex: number; totalGrade: number | null }>,
): number {
  const ordered = [...rows].sort((a, b) => a.sourceRowIndex - b.sourceRowIndex);
  let best = ordered[0]!;
  for (const r of ordered) {
    if (r.totalGrade == null || !Number.isFinite(r.totalGrade)) continue;
    if (best.totalGrade == null || r.totalGrade > best.totalGrade) best = r;
  }
  return best.sourceRowIndex;
}

/** Resolve which source row should appear selected in the picker for a
 *  given decision. `pick-row` is direct; `pick-higher` / `pick-lower` /
 *  `pick-specific` resolve to the row matching the corresponding total;
 *  `reject` clears the selection. */
function computeSelectedRowIndex(
  decision: UploadDuplicateDecision,
  rows: ReadonlyArray<{ sourceRowIndex: number; totalGrade: number | null }>,
  higherTotal: number | null,
): number | null {
  switch (decision.action) {
    case 'pick-row':
      return decision.pickedSourceRowIndex;
    case 'reject':
      return null;
    case 'pick-higher':
      return higherTotal != null
        ? rows.find((r) => r.totalGrade === higherTotal)?.sourceRowIndex ?? null
        : null;
    case 'pick-lower': {
      const lows = rows
        .map((r) => r.totalGrade)
        .filter((t): t is number => t != null && Number.isFinite(t));
      if (lows.length === 0) return null;
      const lower = Math.min(...lows);
      return rows.find((r) => r.totalGrade === lower)?.sourceRowIndex ?? null;
    }
    case 'pick-specific':
      return rows.find((r) => r.totalGrade === decision.pickedTotal)?.sourceRowIndex ?? null;
  }
}
