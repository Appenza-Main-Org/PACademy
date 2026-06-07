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
import { Check, CheckCircle2, ListChecks, ShieldAlert, X } from 'lucide-react';
import { Accordion, Badge, Button, Card, CardBody } from '@/shared/components';
import { useImportWizardStore } from '../../../store/importWizard.store';
import type {
  ExistingDiffDecision,
  UploadDuplicateDecision,
} from '../../../store/importWizard.store';
import { useGrades } from '../../../api/grades.queries';
import { normaliseRows } from '../../../lib/normalise';
import {
  buildIntegrityAuditRows,
  isInformationalAuditCode,
  summarizeIntegrityDecisions,
  type IntegrityAuditRow,
} from '../../../lib/duplicateAudit';
import { useImportValidationRules } from '../../../lib/useImportValidationRules';
import {
  buildAlreadyImported,
  buildExistingDiffs,
  buildUploadDuplicates,
  defaultExistingDiffDecision,
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
  const maxGradeByCategory = useImportWizardStore((s) => s.maxGradeByCategory);
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
  const outOfRangeDecisions = useImportWizardStore((s) => s.outOfRangeDecisions);
  const setOutOfRangeDecision = useImportWizardStore(
    (s) => s.setOutOfRangeDecision,
  );
  const setBulkOutOfRangeDecisions = useImportWizardStore(
    (s) => s.setBulkOutOfRangeDecisions,
  );
  const setUploadDuplicateDecision = useImportWizardStore(
    (s) => s.setUploadDuplicateDecision,
  );
  const setBulkUploadDuplicateDecisions = useImportWizardStore(
    (s) => s.setBulkUploadDuplicateDecisions,
  );
  const importResult = useImportWizardStore((s) => s.importResult);
  const validationRules = useImportValidationRules();

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
  const integrityRows = useMemo(
    () =>
      buildIntegrityAuditRows({
        rows: normalised,
        selectedSchoolCategories,
        maxGradeByCategory,
        validationRules,
        existingRows: allRows ?? [],
      }),
    [
      normalised,
      selectedSchoolCategories,
      maxGradeByCategory,
      validationRules,
      allRows,
    ],
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
    if (diffs.length === 0) return;
    const seeded: Record<string, ExistingDiffDecision> = { ...existingDiffDecisions };
    let touched = false;
    for (const diff of diffs) {
      if (seeded[diff.nationalId] == null || seeded[diff.nationalId] === 'pending') {
        seeded[diff.nationalId] = defaultExistingDiffDecision(diff);
        touched = true;
      }
    }
    if (touched) setBulkExistingDiffDecisions(seeded);
  }, [diffs, existingDiffDecisions, setBulkExistingDiffDecisions]);

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
      next[d.nationalId] = 'accept';
    }
    setBulkExistingDiffDecisions(next);
  }
  function rejectAllDiffs(): void {
    const next: Record<string, ExistingDiffDecision> = { ...existingDiffDecisions };
    for (const d of diffs) {
      next[d.nationalId] = 'reject';
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
  const decisionSummary = summarizeIntegrityDecisions(
    integrityRows,
    outOfRangeDecisions,
  );
  const summaryRejectedCount = Math.max(
    importResult?.totals.failed ?? 0,
    decisionSummary.rejectedSourceRows.size,
  );
  const pendingOutOfRangeCount = decisionSummary.pendingOutOfRangeCount;
  const skippedCount = (importResult?.totals.skipped ?? 0) + skippedExistingCount;
  const importableCount = Math.max(
    0,
    (importResult?.totals.received ?? normalised.length) -
      skippedCount -
      summaryRejectedCount -
      pendingOutOfRangeCount,
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

  const outOfRangeRows = useMemo(
    () => integrityRows.filter((row) => row.code === 'GRADE_OUT_OF_RANGE'),
    [integrityRows],
  );
  const hardInvalidRows = useMemo(
    () =>
      integrityRows.filter(
        (row) =>
          row.code !== 'GRADE_OUT_OF_RANGE' &&
          row.code !== 'INVALID_NID' &&
          !isInformationalAuditCode(row.code),
      ),
    [integrityRows],
  );
  /* The dedicated NID validation report aggregates every detected
   * national-id issue (format / governorate / sequence / gender
   * / intra-file duplicate / system duplicate) into a single panel so
   * admins can review the full per-row breakdown without hunting
   * across the page. INVALID_NID rows are pulled out of HardInvalidSection
   * to keep them from being shown twice. */
  const nidValidationReportRows = useMemo(
    () =>
      integrityRows.filter(
        (row) =>
          row.code === 'INVALID_NID' ||
          row.code === 'DUPLICATE_NID_IN_FILE' ||
          row.code === 'DUPLICATE_NID_IN_SYSTEM',
      ),
    [integrityRows],
  );
  const acceptedOutOfRangeCount = outOfRangeRows.filter(
    (row) => outOfRangeDecisions[row.sourceRowIndex] === 'accept',
  ).length;
  const rejectedOutOfRangeCount = outOfRangeRows.filter(
    (row) => outOfRangeDecisions[row.sourceRowIndex] === 'reject',
  ).length;
  const pendingOutOfRangeRowCount =
    outOfRangeRows.length - acceptedOutOfRangeCount - rejectedOutOfRangeCount;
  const outOfRangeBulkMode: BulkDecisionMode =
    outOfRangeRows.length > 0 && acceptedOutOfRangeCount === outOfRangeRows.length
      ? 'accept'
      : outOfRangeRows.length > 0 && rejectedOutOfRangeCount === outOfRangeRows.length
        ? 'reject'
        : null;
  const rejectedReviewRows = useMemo(
    () =>
      integrityRows.filter((row) => {
        if (isInformationalAuditCode(row.code)) return false;
        if (row.code === 'GRADE_OUT_OF_RANGE') {
          return outOfRangeDecisions[row.sourceRowIndex] === 'reject';
        }
        return true;
      }),
    [integrityRows, outOfRangeDecisions],
  );
  const actionRequiredCount =
    uploadDuplicates.length + outOfRangeRows.length + diffs.length;
  const actionAccordionDefault = actionRequiredCount > 0 ? ['action-required'] : [];
  const rejectedAccordionDefault =
    actionRequiredCount === 0 && rejectedReviewRows.length > 0 ? ['rejected-records'] : [];

  function acceptAllOutOfRangeRows(): void {
    const next = { ...outOfRangeDecisions };
    for (const row of outOfRangeRows) next[row.sourceRowIndex] = 'accept';
    setBulkOutOfRangeDecisions(next);
  }

  function rejectAllOutOfRangeRows(): void {
    const next = { ...outOfRangeDecisions };
    for (const row of outOfRangeRows) next[row.sourceRowIndex] = 'reject';
    setBulkOutOfRangeDecisions(next);
  }

  if (
    diffs.length === 0 &&
    uploadDuplicates.length === 0 &&
    outOfRangeRows.length === 0 &&
    hardInvalidRows.length === 0 &&
    nidValidationReportRows.length === 0
  ) {
    return (
      <div className="flex flex-col gap-4">
        <ImportDecisionSummary
          received={importResult?.totals.received ?? normalised.length}
          importable={importableCount}
          skipped={skippedCount}
          rejected={summaryRejectedCount}
          pending={pendingOutOfRangeCount}
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
        rejected={summaryRejectedCount}
        pending={pendingOutOfRangeCount}
        skippedExisting={skippedExistingCount}
      />
      {alreadyImported.length > 0 && (
        <AlreadyImportedBanner count={alreadyImported.length} />
      )}
      {actionRequiredCount > 0 && (
        <ReviewDisclosure
          value="action-required"
          defaultValue={actionAccordionDefault}
          tone="warning"
          title="سجلات تحتاج إجراء من المسؤول"
          subtitle="افتح القسم لمعالجة التكرارات أو الدرجات المتجاوزة أو تغييرات السجلات الحالية."
          count={actionRequiredCount}
        >
          <ActionRequiredTable
            uploadDuplicateCount={uploadDuplicates.length}
            uploadDuplicatePending={undecidedUploadDuplicates}
            outOfRangeCount={outOfRangeRows.length}
            outOfRangePending={pendingOutOfRangeRowCount}
            diffCount={diffs.length}
            diffPending={pendingCount}
          />

          <Accordion type="multiple" className="mt-3 rounded-md border border-border-subtle bg-white">
            {uploadDuplicates.length > 0 && (
              <Accordion.Item value="upload-duplicates">
                <Accordion.HeaderRow
                  trigger={<DetailTrigger title="تكرارات داخل الملف" count={uploadDuplicates.length} />}
                  actions={
                    <BulkDecisionToggle
                      mode={uploadBulkMode}
                      acceptLabel="قبول الكل"
                      rejectLabel="رفض الكل"
                      onAccept={acceptAllUploadDuplicates}
                      onReject={rejectAllUploadDuplicates}
                    />
                  }
                />
                <Accordion.Content>
                  <UploadDuplicatesSection
                    duplicates={uploadDuplicates}
                    decisions={uploadDuplicateDecisions}
                    undecidedCount={undecidedUploadDuplicates}
                    bulkMode={uploadBulkMode}
                    onSetDecision={setUploadDuplicateDecision}
                    onAcceptAll={acceptAllUploadDuplicates}
                    onRejectAll={rejectAllUploadDuplicates}
                  />
                </Accordion.Content>
              </Accordion.Item>
            )}
            {outOfRangeRows.length > 0 && (
              <Accordion.Item value="out-of-range">
                <Accordion.HeaderRow
                  trigger={<DetailTrigger title="درجات خارج النطاق" count={outOfRangeRows.length} />}
                  actions={
                    <BulkDecisionToggle
                      mode={outOfRangeBulkMode}
                      acceptLabel="قبول الكل"
                      rejectLabel="رفض الكل"
                      onAccept={acceptAllOutOfRangeRows}
                      onReject={rejectAllOutOfRangeRows}
                    />
                  }
                />
                <Accordion.Content>
                  <OutOfRangeSection
                    rows={outOfRangeRows}
                    decisions={outOfRangeDecisions}
                    pendingCount={pendingOutOfRangeRowCount}
                    bulkMode={outOfRangeBulkMode}
                    onSetDecision={setOutOfRangeDecision}
                    onAcceptAll={acceptAllOutOfRangeRows}
                    onRejectAll={rejectAllOutOfRangeRows}
                  />
                </Accordion.Content>
              </Accordion.Item>
            )}
            {diffs.length > 0 && (
              <Accordion.Item value="existing-diffs">
                <Accordion.HeaderRow
                  trigger={<DetailTrigger title="تغييرات على سجلات موجودة" count={diffs.length} />}
                  actions={
                    <BulkDecisionToggle
                      mode={diffBulkMode}
                      acceptLabel="قبول الكل"
                      rejectLabel="رفض الكل"
                      onAccept={acceptAllDiffs}
                      onReject={rejectAllDiffs}
                      disabled={diffs.length === 0}
                    />
                  }
                />
                <Accordion.Content>
                  <ExistingDiffsSection
                    diffs={diffs}
                    acceptedCount={acceptedCount}
                    rejectedCount={rejectedCount}
                    pendingCount={pendingCount}
                    decisions={existingDiffDecisions}
                    onSetDecision={setExistingDiffDecision}
                  />
                </Accordion.Content>
              </Accordion.Item>
            )}
          </Accordion>
        </ReviewDisclosure>
      )}

      {rejectedReviewRows.length > 0 && (
        <ReviewDisclosure
          value="rejected-records"
          defaultValue={rejectedAccordionDefault}
          tone="danger"
          title="السجلات المرفوضة"
          subtitle="هذه الصفوف لن تُكتب قبل تصحيح الملف أو تغيير القرار."
          count={rejectedReviewRows.length}
        >
          <RejectedRecordsTable rows={rejectedReviewRows} />
          {(nidValidationReportRows.length > 0 || hardInvalidRows.length > 0) && (
            <Accordion type="multiple" className="mt-3 rounded-md border border-border-subtle bg-white">
              {nidValidationReportRows.length > 0 && (
                <Accordion.Item value="nid-details">
                  <Accordion.Trigger>
                    <DetailTrigger title="تفاصيل الرقم القومي" count={nidValidationReportRows.length} />
                  </Accordion.Trigger>
                  <Accordion.Content>
                    <NidValidationReport rows={nidValidationReportRows} />
                  </Accordion.Content>
                </Accordion.Item>
              )}
              {hardInvalidRows.length > 0 && (
                <Accordion.Item value="hard-invalid">
                  <Accordion.Trigger>
                    <DetailTrigger title="تفاصيل البيانات الناقصة" count={hardInvalidRows.length} />
                  </Accordion.Trigger>
                  <Accordion.Content>
                    <HardInvalidSection rows={hardInvalidRows} />
                  </Accordion.Content>
                </Accordion.Item>
              )}
            </Accordion>
          )}
        </ReviewDisclosure>
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
  pending: number;
  skippedExisting: number;
}

function ImportDecisionSummary({
  received,
  importable,
  skipped,
  rejected,
  pending,
  skippedExisting,
}: ImportDecisionSummaryProps): JSX.Element {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border-subtle bg-white p-3">
      <div className="grid grid-cols-2 overflow-hidden rounded-md border border-border-subtle md:grid-cols-5">
        <DecisionStat label="مستلمة" value={received} />
        <DecisionStat label="سيتم استيرادها" value={importable} tone="success" />
        <DecisionStat label="تحتاج قرار" value={pending} tone="warning" />
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

interface ReviewDisclosureProps {
  value: string;
  defaultValue: string[];
  tone: 'warning' | 'danger';
  title: string;
  subtitle: string;
  count: number;
  children: ReactNode;
}

function ReviewDisclosure({
  value,
  defaultValue,
  tone,
  title,
  subtitle,
  count,
  children,
}: ReviewDisclosureProps): JSX.Element {
  const toneClass =
    tone === 'danger'
      ? 'border-terra-200 bg-terra-50 text-terra-700'
      : 'border-gold-200 bg-gold-50 text-gold-700';
  return (
    <Accordion
      type="multiple"
      defaultValue={defaultValue}
      className="overflow-hidden rounded-md border border-border-subtle bg-white"
    >
      <Accordion.Item value={value}>
        <Accordion.Trigger className={toneClass} contentClassName="min-w-0">
          <span className="flex min-w-0 items-center gap-2">
            <ListChecks size={15} strokeWidth={1.75} aria-hidden className="shrink-0" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-2 text-sm font-bold text-ink-900">
                {title}
                <Badge tone={tone} className="shrink-0">
                  <span className="font-en tabular-nums">{count.toLocaleString('en')}</span>
                </Badge>
              </span>
              <span className="truncate text-2xs font-normal text-ink-600">{subtitle}</span>
            </span>
          </span>
        </Accordion.Trigger>
        <Accordion.Content className="bg-white">
          {children}
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
  );
}

function DetailTrigger({
  title,
  count,
}: {
  title: string;
  count: number;
}): JSX.Element {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="truncate text-sm font-semibold text-ink-900">{title}</span>
      <Badge tone="neutral">
        <span className="font-en tabular-nums">{count.toLocaleString('en')}</span>
      </Badge>
    </span>
  );
}

function ActionRequiredTable({
  uploadDuplicateCount,
  uploadDuplicatePending,
  outOfRangeCount,
  outOfRangePending,
  diffCount,
  diffPending,
}: {
  uploadDuplicateCount: number;
  uploadDuplicatePending: number;
  outOfRangeCount: number;
  outOfRangePending: number;
  diffCount: number;
  diffPending: number;
}): JSX.Element {
  const rows = [
    {
      label: 'تكرارات داخل الملف',
      count: uploadDuplicateCount,
      pending: uploadDuplicatePending,
      action: 'اختيار الصف المعتمد أو رفض الطالب',
    },
    {
      label: 'درجات خارج النطاق',
      count: outOfRangeCount,
      pending: outOfRangePending,
      action: 'قبول التجاوز أو رفض الصف',
    },
    {
      label: 'تغييرات على سجلات موجودة',
      count: diffCount,
      pending: diffPending,
      action: 'قبول التغييرات أو ترك السجل الحالي',
    },
  ].filter((row) => row.count > 0);

  return (
    <div className="overflow-hidden rounded-md border border-border-subtle">
      <table className="w-full border-collapse text-xs">
        <caption className="sr-only">سجلات تحتاج إجراء من المسؤول</caption>
        <thead className="bg-ink-50/70 text-2xs uppercase text-ink-500">
          <tr>
            <th scope="col" className="border-b border-border-subtle px-3 py-2 text-start font-semibold">
              نوع الإجراء
            </th>
            <th scope="col" className="border-b border-border-subtle px-3 py-2 text-end font-semibold">
              العدد
            </th>
            <th scope="col" className="border-b border-border-subtle px-3 py-2 text-end font-semibold">
              قيد القرار
            </th>
            <th scope="col" className="border-b border-border-subtle px-3 py-2 text-start font-semibold">
              المطلوب
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-border-subtle first:border-t-0">
              <th scope="row" className="px-3 py-2 text-start font-semibold text-ink-900">
                {row.label}
              </th>
              <td className="px-3 py-2 text-end font-en font-bold tabular-nums text-ink-900">
                {row.count.toLocaleString('en')}
              </td>
              <td className="px-3 py-2 text-end">
                <Badge tone={row.pending > 0 ? 'warning' : 'success'}>
                  <span className="font-en tabular-nums">{row.pending.toLocaleString('en')}</span>
                </Badge>
              </td>
              <td className="px-3 py-2 text-ink-600">{row.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExistingDiffsSection({
  diffs,
  acceptedCount,
  rejectedCount,
  pendingCount,
  decisions,
  onSetDecision,
}: {
  diffs: ExistingDiff[];
  acceptedCount: number;
  rejectedCount: number;
  pendingCount: number;
  decisions: Record<string, ExistingDiffDecision>;
  onSetDecision: (nationalId: string, decision: ExistingDiffDecision) => void;
}): JSX.Element {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border-subtle bg-ink-50/40 px-3.5 py-2.5">
        <div className="flex items-center gap-2 text-xs text-ink-700">
          <ShieldAlert size={14} strokeWidth={1.75} className="text-gold-700" aria-hidden />
          <span>
            <span className="font-numeric font-bold text-ink-900">
              {diffs.length.toLocaleString('en')}
            </span>{' '}
            سجلات موجودة قد تتأثر.
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-2xs">
          <Badge tone="success">
            مقبول <span className="font-en tabular-nums">{acceptedCount.toLocaleString('en')}</span>
          </Badge>
          <Badge tone="danger">
            مرفوض <span className="font-en tabular-nums">{rejectedCount.toLocaleString('en')}</span>
          </Badge>
          <Badge tone="neutral">
            قيد القرار <span className="font-en tabular-nums">{pendingCount.toLocaleString('en')}</span>
          </Badge>
        </div>
      </header>

      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {diffs.map((diff) => (
          <li key={diff.nationalId}>
            <DiffCard
              diff={diff}
              decision={decisions[diff.nationalId] ?? 'pending'}
              onDecide={(decision) => onSetDecision(diff.nationalId, decision)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function RejectedRecordsTable({
  rows,
}: {
  rows: IntegrityAuditRow[];
}): JSX.Element {
  return (
    <div className="overflow-hidden rounded-md border border-border-subtle">
      <table className="w-full border-collapse text-xs">
        <caption className="sr-only">السجلات المرفوضة في ملف الاستيراد</caption>
        <thead className="bg-ink-50/70 text-2xs uppercase text-ink-500">
          <tr>
            <th scope="col" className="border-b border-border-subtle px-3 py-2 text-start font-semibold">
              صف #
            </th>
            <th scope="col" className="border-b border-border-subtle px-3 py-2 text-start font-semibold">
              الرقم القومي
            </th>
            <th scope="col" className="border-b border-border-subtle px-3 py-2 text-start font-semibold">
              بيانات الطالب
            </th>
            <th scope="col" className="border-b border-border-subtle px-3 py-2 text-start font-semibold">
              سبب الرفض
            </th>
            <th scope="col" className="border-b border-border-subtle px-3 py-2 text-start font-semibold">
              التفاصيل
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${row.sourceRowIndex}-${row.code}-${row.nidIssueCode ?? ''}-${index}`}
              className="border-t border-border-subtle align-top first:border-t-0"
            >
              <td className="px-3 py-2">
                <span className="rounded-pill bg-ink-100 px-2 py-0.5 font-en text-2xs font-semibold text-ink-700">
                  #{row.sourceRowIndex}
                </span>
              </td>
              <td className="px-3 py-2">
                <span dir="ltr" className="font-mono text-2xs text-ink-700">
                  {row.nationalId ?? '—'}
                </span>
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-ink-900">{row.nameAr ?? '—'}</span>
                  <span className="text-2xs text-ink-500">
                    المجموع:{' '}
                    <span className="font-en tabular-nums">{row.totalGrade ?? '—'}</span>
                  </span>
                </div>
              </td>
              <td className="px-3 py-2">
                <Badge tone="danger">{row.labelAr}</Badge>
              </td>
              <td className="max-w-[460px] px-3 py-2 leading-relaxed text-ink-700">
                {row.detail}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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

interface OutOfRangeSectionProps {
  rows: IntegrityAuditRow[];
  decisions: Record<number, 'accept' | 'reject'>;
  pendingCount: number;
  bulkMode: BulkDecisionMode;
  onSetDecision: (sourceRowIndex: number, decision: 'accept' | 'reject') => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}

function OutOfRangeSection({
  rows,
  decisions,
  pendingCount,
  bulkMode,
  onSetDecision,
  onAcceptAll,
  onRejectAll,
}: OutOfRangeSectionProps): JSX.Element {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gold-300 bg-gold-50 px-3.5 py-2.5">
        <div className="flex items-center gap-2 text-xs text-gold-700">
          <ShieldAlert size={14} strokeWidth={1.75} aria-hidden />
          <span>
            <span className="font-numeric font-bold text-ink-900">
              {rows.length.toLocaleString('en')}
            </span>{' '}
            صفًا تتجاوز الدرجة العظمى. اختر قبول أو رفض كل صف —{' '}
            <span className="font-numeric font-bold">
              {pendingCount.toLocaleString('en')}
            </span>{' '}
            قيد القرار.
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
        {rows.map((row) => (
          <li key={row.sourceRowIndex}>
            <OutOfRangeCard
              row={row}
              decision={decisions[row.sourceRowIndex]}
              onDecide={(decision) => onSetDecision(row.sourceRowIndex, decision)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function OutOfRangeCard({
  row,
  decision,
  onDecide,
}: {
  row: IntegrityAuditRow;
  decision: 'accept' | 'reject' | undefined;
  onDecide: (decision: 'accept' | 'reject') => void;
}): JSX.Element {
  const accent =
    decision === 'accept'
      ? 'var(--teal-500)'
      : decision === 'reject'
        ? 'var(--terra-400)'
        : 'var(--gold-400)';
  return (
    <Card>
      <CardBody className="p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-6 w-1 rounded-pill"
              style={{ background: accent }}
            />
            <span className="font-medium text-ink-900">{row.nameAr ?? '—'}</span>
            {row.nationalId && (
              <span className="font-mono text-2xs text-ink-500" dir="ltr">
                {row.nationalId}
              </span>
            )}
            <Badge tone="warning">
              صف #
              <span className="font-en tabular-nums">{row.sourceRowIndex}</span>
            </Badge>
            <Badge tone={decision === 'accept' ? 'success' : decision === 'reject' ? 'danger' : 'warning'}>
              {decision === 'accept'
                ? 'مقبول'
                : decision === 'reject'
                  ? 'مرفوض'
                  : 'قيد القرار'}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant={decision === 'reject' ? 'primary' : 'secondary'}
              leadingIcon={<X size={12} strokeWidth={2} aria-hidden />}
              onClick={() => onDecide('reject')}
            >
              رفض
            </Button>
            <Button
              size="sm"
              variant={decision === 'accept' ? 'primary' : 'secondary'}
              leadingIcon={<Check size={12} strokeWidth={2} aria-hidden />}
              onClick={() => onDecide('accept')}
            >
              قبول
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-3 rounded-md border border-border-subtle bg-ink-50/60 px-3 py-2 text-xs">
          <RowCell label="المجموع">
            <span className="font-en text-sm font-bold text-ink-900">
              {row.totalGrade ?? '—'}
            </span>
          </RowCell>
          <RowCell label="الملاحظة">
            <span className="text-xs text-ink-700">{row.detail}</span>
          </RowCell>
        </div>
      </CardBody>
    </Card>
  );
}

function NidValidationReport({ rows }: { rows: IntegrityAuditRow[] }): JSX.Element {
  const counts = useMemo(() => {
    let invalidFormat = 0;
    let duplicatesInFile = 0;
    let duplicatesInSystem = 0;
    const affectedRows = new Set<number>();
    const affectedNids = new Set<string>();
    for (const row of rows) {
      affectedRows.add(row.sourceRowIndex);
      if (row.nationalId) affectedNids.add(row.nationalId);
      if (row.code === 'INVALID_NID') invalidFormat += 1;
      else if (row.code === 'DUPLICATE_NID_IN_FILE') duplicatesInFile += 1;
      else if (row.code === 'DUPLICATE_NID_IN_SYSTEM') duplicatesInSystem += 1;
    }
    return {
      total: rows.length,
      invalidFormat,
      duplicatesInFile,
      duplicatesInSystem,
      affectedRowsCount: affectedRows.size,
      affectedNidsCount: affectedNids.size,
    };
  }, [rows]);

  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-terra-200 bg-terra-50 px-3.5 py-2.5">
        <div className="flex items-center gap-2 text-xs text-terra-700">
          <ShieldAlert size={14} strokeWidth={1.75} aria-hidden />
          <span>
            <span className="font-numeric font-bold text-ink-900">
              {counts.total.toLocaleString('en')}
            </span>{' '}
            ملاحظة على الرقم القومي خلال{' '}
            <span className="font-numeric font-bold">
              {counts.affectedRowsCount.toLocaleString('en')}
            </span>{' '}
            صفًا. صحح الملف أو راجع قرارات التكرار قبل تأكيد الاستيراد.
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {counts.invalidFormat > 0 && (
            <Badge tone="danger">
              تنسيق غير صالح{' '}
              <span className="font-en tabular-nums">
                {counts.invalidFormat.toLocaleString('en')}
              </span>
            </Badge>
          )}
          {counts.duplicatesInFile > 0 && (
            <Badge tone="warning">
              تكرار داخل الملف{' '}
              <span className="font-en tabular-nums">
                {counts.duplicatesInFile.toLocaleString('en')}
              </span>
            </Badge>
          )}
          {counts.duplicatesInSystem > 0 && (
            <Badge tone="warning">
              مسجل بالقاعدة{' '}
              <span className="font-en tabular-nums">
                {counts.duplicatesInSystem.toLocaleString('en')}
              </span>
            </Badge>
          )}
        </div>
      </header>

      <Card>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead className="bg-ink-50/60 text-2xs uppercase text-ink-500">
                <tr>
                  <th
                    scope="col"
                    className="border-b border-border-subtle px-3 py-2 text-start font-semibold"
                    style={{ width: '72px' }}
                  >
                    صف #
                  </th>
                  <th
                    scope="col"
                    className="border-b border-border-subtle px-3 py-2 text-start font-semibold"
                  >
                    الرقم القومي
                  </th>
                  <th
                    scope="col"
                    className="border-b border-border-subtle px-3 py-2 text-start font-semibold"
                  >
                    بيانات الطالب
                  </th>
                  <th
                    scope="col"
                    className="border-b border-border-subtle px-3 py-2 text-start font-semibold"
                  >
                    نوع الخطأ
                  </th>
                  <th
                    scope="col"
                    className="border-b border-border-subtle px-3 py-2 text-start font-semibold"
                  >
                    التفاصيل
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={`${row.sourceRowIndex}-${row.code}-${row.nidIssueCode ?? ''}-${index}`}
                    className="border-t border-border-subtle align-top first:border-t-0"
                  >
                    <td className="px-3 py-2">
                      <span className="rounded-pill bg-ink-100 px-2 py-0.5 font-en text-2xs font-semibold text-ink-700">
                        #
                        <span className="tabular-nums">{row.sourceRowIndex}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        dir="ltr"
                        className="font-mono text-2xs text-ink-700"
                      >
                        {row.nationalId ?? '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-ink-900">
                          {row.nameAr ?? '—'}
                        </span>
                        <span className="text-2xs text-ink-500">
                          المجموع:{' '}
                          <span className="font-en tabular-nums">
                            {row.totalGrade ?? '—'}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        tone={
                          row.code === 'INVALID_NID'
                            ? 'danger'
                            : 'warning'
                        }
                      >
                        {row.labelAr}
                      </Badge>
                      {row.nidIssueCode && (
                        <div className="mt-1 font-mono text-2xs text-ink-400">
                          {row.nidIssueCode}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs leading-relaxed text-ink-700">
                      {row.detail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </section>
  );
}

function HardInvalidSection({ rows }: { rows: IntegrityAuditRow[] }): JSX.Element {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-terra-200 bg-terra-50 px-3.5 py-2.5">
        <div className="flex items-center gap-2 text-xs text-terra-700">
          <ShieldAlert size={14} strokeWidth={1.75} aria-hidden />
          <span>
            <span className="font-numeric font-bold text-ink-900">
              {rows.length.toLocaleString('en')}
            </span>{' '}
            صفًا به بيانات ناقصة أو غير قابلة للقراءة. هذه الصفوف مرفوضة حتى يتم تصحيح الملف.
          </span>
        </div>
        <Badge tone="danger">مرفوضة</Badge>
      </header>

      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {rows.map((row) => (
          <li key={row.sourceRowIndex}>
            <Card>
              <CardBody className="p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span
                      aria-hidden
                      className="inline-block h-6 w-1 rounded-pill bg-terra-400"
                    />
                    <span className="font-medium text-ink-900">{row.nameAr ?? '—'}</span>
                    {row.nationalId && (
                      <span className="font-mono text-2xs text-ink-500" dir="ltr">
                        {row.nationalId}
                      </span>
                    )}
                    <Badge tone="danger">
                      صف #
                      <span className="font-en tabular-nums">{row.sourceRowIndex}</span>
                    </Badge>
                    <Badge tone="danger">{row.labelAr}</Badge>
                  </div>
                  <Badge tone="danger">مرفوض</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 rounded-md border border-border-subtle bg-ink-50/60 px-3 py-2 text-xs">
                  <RowCell label="المجموع">
                    <span className="font-en text-sm font-bold text-ink-900">
                      {row.totalGrade ?? '—'}
                    </span>
                  </RowCell>
                  <RowCell label="الملاحظة">
                    <span className="text-xs text-ink-700">{row.detail}</span>
                  </RowCell>
                </div>
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>
    </section>
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
