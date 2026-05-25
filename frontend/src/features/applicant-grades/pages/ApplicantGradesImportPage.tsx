/**
 * Standalone import wizard page — `/admin/applicant-grades/import`.
 *
 * Replaces the in-page Modal that used to host the v1 wizard. Renders
 * inside `AdminLayout` chrome with `PageHeader` carrying breadcrumbs +
 * an "إلغاء" action. Six steps, top-stepper, sticky footer:
 *   1. Settings — secondary type, max grade, graduation year, file pick
 *   2. Table select — pick a sheet/table from the parsed workbook
 *   3. Column mapping — bind every required `TargetField` to a source col
 *   4. Filters — per-column value allow-lists
 *   5. Duplicate review — preflight summary + counters
 *   6. Result — grouped failure report + per-group actions + commit
 *
 * Unsaved-changes guard: cancelling mid-wizard with a parsed file in
 * memory prompts the admin via AlertDialog before bailing.
 */

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, ShieldAlert, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  Button,
  PageHeader,
  toast,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { useImportWizardStore } from '../store/importWizard.store';
import { useApplicantGradesCommit } from '../api/grades.queries';
import { normaliseRows } from '../lib/normalise';
import { isMappingComplete } from '../components/importWizard/steps/Step3ColumnMapping';
import { Step1Settings } from '../components/importWizard/steps/Step1Settings';
import { Step2TableSelect } from '../components/importWizard/steps/Step2TableSelect';
import { Step3ColumnMapping } from '../components/importWizard/steps/Step3ColumnMapping';
import { Step4Filters } from '../components/importWizard/steps/Step4Filters';
import { Step5DuplicateReview } from '../components/importWizard/steps/Step5DuplicateReview';
import { Step6ChangesReview } from '../components/importWizard/steps/Step6ChangesReview';
import { Step6Result } from '../components/importWizard/steps/Step6Result';
import {
  buildAuditCsv,
  buildDuplicateAudit,
  buildIntegrityAuditRows,
  dedupeRowsFirstOccurrence,
} from '../lib/duplicateAudit';
import { saveApplicantGradesImportHistoryRecord } from '../lib/importHistory';
import type { ImportCommitProgress, ImportGroupCode } from '../types';

type StepIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const STEPS: Array<{ index: StepIndex; label: string }> = [
  { index: 1, label: 'الإعدادات' },
  { index: 2, label: 'اختيار الجدول' },
  { index: 3, label: 'ربط الأعمدة' },
  { index: 4, label: 'تصفية القيم' },
  { index: 5, label: 'مراجعة التكرار' },
  { index: 6, label: 'مراجعة التغييرات' },
  { index: 7, label: 'النتيجة' },
];

export function ApplicantGradesImportPage(): JSX.Element {
  const navigate = useNavigate();
  const step = useImportWizardStore((s) => s.step);
  const setStep = useImportWizardStore((s) => s.setStep);
  const file = useImportWizardStore((s) => s.file);
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
  const perGroupActions = useImportWizardStore((s) => s.perGroupActions);
  const existingDiffDecisions = useImportWizardStore((s) => s.existingDiffDecisions);
  const uploadDuplicateDecisions = useImportWizardStore(
    (s) => s.uploadDuplicateDecisions,
  );
  const loudDuplicateAck = useImportWizardStore((s) => s.loudDuplicateAck);
  const fileMeta = useImportWizardStore((s) => s.fileMeta);
  const importResult = useImportWizardStore((s) => s.importResult);
  const reset = useImportWizardStore((s) => s.reset);

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showStep1Errors, setShowStep1Errors] = useState(false);
  const [commitProgress, setCommitProgress] = useState<ImportCommitProgress | null>(null);
  const commit = useApplicantGradesCommit();

  /* Safety rail: the `File` + `ParsedSheet` slices of the store are
   * deliberately not persisted (File objects can't be serialised), so
   * arriving at the wizard with a persisted `step > 1` but a missing
   * file means a prior session was abandoned. Snap back to Step 1
   * instead of rendering a broken Step 2/3/4/5/6 against null data. */
  useEffect(() => {
    if (step > 1 && file == null) {
      setStep(1);
    }
  }, [step, file, setStep]);

  const table = useMemo(
    () => parsed?.tables.find((t) => t.name === selectedTableName) ?? null,
    [parsed, selectedTableName],
  );

  /* Re-run the duplicate audit at the page level so the wizard footer
   * (Step 5 next, Step 7 commit) can gate on the same threshold the
   * loud-guard banner uses inside Step 5. Cheap: a single pass over the
   * already-normalised rows. */
  const duplicateAudit = useMemo(() => {
    if (!table || graduationYear == null) return null;
    const rows = normaliseRows(
      table,
      mapping,
      filters,
      graduationYear,
      lookupValueMappings,
      selectedSchoolCategories,
    );
    return buildDuplicateAudit(rows);
  }, [
    table,
    mapping,
    filters,
    graduationYear,
    lookupValueMappings,
    selectedSchoolCategories,
  ]);

  const integrityRows = useMemo(() => {
    if (!table || graduationYear == null) return [];
    const rows = normaliseRows(
      table,
      mapping,
      filters,
      graduationYear,
      lookupValueMappings,
      selectedSchoolCategories,
    );
    return buildIntegrityAuditRows({
      rows,
      selectedSchoolCategories,
      maxGradeByCategory,
    });
  }, [
    table,
    mapping,
    filters,
    graduationYear,
    lookupValueMappings,
    selectedSchoolCategories,
    maxGradeByCategory,
  ]);

  const loudGuardBlocks =
    duplicateAudit?.exceedsThreshold === true && !loudDuplicateAck;

  function canAdvance(): boolean {
    switch (step) {
      case 1: {
        if (file == null) return false;
        if (selectedSchoolCategories.length === 0) return false;
        if (graduationYear == null) return false;
        /* Every picked category must carry a positive integer max so
         * Step 5's preflight + Step 7's commit always have a usable
         * scale to gate `totalGrade` against. */
        return selectedSchoolCategories.every((code) => {
          const v = maxGradeByCategory[code];
          return typeof v === 'number' && v > 0 && Number.isFinite(v);
        });
      }
      case 2:
        return parsed != null && selectedTableName != null;
      case 3:
        return isMappingComplete(mapping);
      case 4:
        return true;
      case 5:
        /* Block advancement when the intra-file duplicate ratio exceeds
         * the threshold (default 1%) unless the admin has explicitly
         * acknowledged the override in the loud-guard banner. Keeps
         * pathological re-exports (e.g. 23k rows / 3 unique NIDs) from
         * flowing silently through to the commit step. */
        return !loudGuardBlocks;
      case 6:
        /* Step 6's diff review is always advanceable — the default
         * decision (reject for existing diffs, pick-higher for upload
         * duplicates) keeps the commit safe even if the admin
         * skips through. */
        return true;
      case 7:
        return false;
      default:
        return false;
    }
  }

  function bailToList(): void {
    reset();
    navigate(ROUTES.admin.applicantGrades);
  }

  function handleCancel(): void {
    if (commit.isPending) return;
    if (parsed != null) {
      setConfirmCancel(true);
      return;
    }
    bailToList();
  }

  function next(): void {
    if (!canAdvance()) {
      if (step === 1) setShowStep1Errors(true);
      return;
    }
    if (step === 1) setShowStep1Errors(false);
    if (step < 7) setStep((step + 1) as StepIndex);
  }
  function back(): void {
    if (commit.isPending) return;
    if (step > 1) setStep((step - 1) as StepIndex);
  }

  function commitImport(): void {
    if (!table) return;
    /* `graduationYear` is gated by canAdvance on Step 1; commit can only
     * fire once the wizard reached Step 6, so the non-null assertion
     * matches the actual invariant the UI enforces. */
    if (graduationYear == null) return;
    const rows = normaliseRows(
      table,
      mapping,
      filters,
      graduationYear,
      lookupValueMappings,
      selectedSchoolCategories,
    );
    const actions: Record<ImportGroupCode, 'skip' | 'override' | 'create-applicant' | undefined> = {
      DUPLICATE_NID: filterAction(perGroupActions.DUPLICATE_NID),
      INVALID_NID: filterAction(perGroupActions.INVALID_NID),
      MISSING_REQUIRED: filterAction(perGroupActions.MISSING_REQUIRED),
      NID_NOT_FOUND: filterAction(perGroupActions.NID_NOT_FOUND),
      GRADE_OUT_OF_RANGE: filterAction(perGroupActions.GRADE_OUT_OF_RANGE),
      UNREADABLE_VALUE: filterAction(perGroupActions.UNREADABLE_VALUE),
    };
    const acceptedDiffDecisions: Record<string, 'accept'> = {};
    for (const [nid, decision] of Object.entries(existingDiffDecisions)) {
      if (decision === 'accept') acceptedDiffDecisions[nid] = 'accept';
    }
    const deduped = dedupeRowsFirstOccurrence(rows);
    setCommitProgress({
      processedRows: 0,
      totalRows: deduped.uniqueRows.length,
      insertedCount: 0,
      failedCount: 0,
      alreadyImportedCount: 0,
    });
    /* Snapshot the pre-commit audit so the toast can attribute every
     * row dropped to its bucket (existing-record hit vs intra-file
     * dedupe vs preflight rejection). The commit result only reports
     * inserted/failed/alreadyImported; the duplicate-row count comes
     * from the audit. */
    const auditSnapshot = duplicateAudit;
    commit.mutate(
      {
        rows: deduped.uniqueRows,
        graduationYear,
        selectedSchoolCategories,
        maxGradeByCategory,
        perGroupActions: actions,
        existingDiffDecisions: acceptedDiffDecisions,
        uploadDuplicateDecisions,
        onProgress: setCommitProgress,
      },
      {
        onSuccess: (res) => {
          const audit = auditSnapshot ?? buildDuplicateAudit(rows);
          const auditCsv = buildAuditCsv({
            audit,
            report: importResult,
            rows,
            integrityRows,
            graduationYear,
            fileName: fileMeta?.name ?? null,
          });
          const historyRecord = saveApplicantGradesImportHistoryRecord({
            fileName: fileMeta?.name ?? null,
            graduationYear,
            report: importResult,
            audit,
            integrityRows,
            auditCsv,
            importedCount: res.insertedCount,
            skippedExistingCount: res.alreadyImportedCount,
            loudDuplicateAck,
          });
          const parts = [
            `${res.insertedCount.toLocaleString('en')} مستورد`,
            `${res.failedCount.toLocaleString('en')} مرفوض`,
            `${audit.duplicateRowCount.toLocaleString('en')} مكرر متجاوز`,
            `${integrityRows.length.toLocaleString('en')} غير صالح`,
            `${audit.totalRows.toLocaleString('en')} إجمالي`,
          ];
          if (res.alreadyImportedCount > 0) {
            parts.push(
              `${res.alreadyImportedCount.toLocaleString('en')} متجاهل (موجود مسبقًا)`,
            );
          }
          toast(`تم الاستيراد — ${parts.join(' · ')}.`, 'success');
          reset();
          navigate(`${ROUTES.admin.applicantGradesImportHistory}?record=${encodeURIComponent(historyRecord.id)}`);
        },
        onError: () => {
          toast('تعذّر إكمال الاستيراد. حاول مرة أخرى.', 'danger');
          setCommitProgress(null);
        },
      },
    );
  }

  return (
    <div>
      <PageHeader
        title="استيراد درجات المتقدمين"
        subtitle="نزّل النموذج، عبئه، ثم ارفعه — ستظهر كل أخطاء البيانات قبل الكتابة."
        breadcrumbs={[
          { label: 'لوحة القبول', href: ROUTES.admin.dashboard },
          { label: 'درجات المتقدمين', href: ROUTES.admin.applicantGrades },
          { label: 'استيراد' },
        ]}
        actions={
          <Button
            variant="ghost"
            leadingIcon={<X size={14} strokeWidth={1.75} aria-hidden />}
            onClick={handleCancel}
            disabled={commit.isPending}
          >
            إلغاء الاستيراد
          </Button>
        }
      />

      <TopStepper step={step} onJump={(s) => setStep(s)} />

      <section className="mt-6 rounded-lg border border-border-subtle bg-white p-6">
        {step === 1 && <Step1Settings showRequiredErrors={showStep1Errors} />}
        {step === 2 && <Step2TableSelect onAutoAdvance={() => setStep(3)} />}
        {step === 3 && <Step3ColumnMapping />}
        {step === 4 && <Step4Filters />}
        {step === 5 && <Step5DuplicateReview />}
        {step === 6 && <Step6ChangesReview />}
        {step === 7 && <Step6Result />}
      </section>

      {commitProgress && (
        <ImportCommitProgressPanel progress={commitProgress} />
      )}

      {loudGuardBlocks && (step === 5 || step === 6 || step === 7) && (
        <div
          role="status"
          className="mt-3 flex items-center gap-2 rounded-md border border-terra-300 border-s-[3px] border-s-terra-500 bg-terra-50 px-3.5 py-2.5 text-xs text-terra-700"
        >
          <ShieldAlert size={14} strokeWidth={1.75} aria-hidden className="shrink-0" />
          <span>
            لا يمكن المتابعة حتى تُقرّ بتجاوز كثافة التكرار في خطوة «مراجعة التكرار». ارجع إلى
            الخطوة وراجع التوزيع ثم اضغط الإقرار.
          </span>
        </div>
      )}

      <footer className="sticky bottom-0 mt-4 flex items-center justify-between gap-3 border-t border-border-subtle bg-white px-6 py-4">
        <Button
          variant="ghost"
          leadingIcon={<ChevronRight size={14} strokeWidth={1.75} aria-hidden />}
          onClick={back}
          disabled={step === 1 || commit.isPending}
        >
          السابق
        </Button>
        <div className="flex items-center gap-2">
          {step < 7 && (
            <Button
              variant="primary"
              trailingIcon={<ChevronLeft size={14} strokeWidth={1.75} aria-hidden />}
              onClick={next}
              /* Step 1 stays enabled so clicking it surfaces inline errors
               * rather than silently no-op'ing on a disabled button — the
               * prompt wants validation messages, not a dead UI. Other
               * steps keep the gating behavior. */
              disabled={step !== 1 && !canAdvance()}
            >
              متابعة
            </Button>
          )}
          {step === 7 && (
            <Button
              variant="primary"
              leadingIcon={<Check size={14} strokeWidth={1.75} aria-hidden />}
              isLoading={commit.isPending}
              loadingLabel={
                commitProgress
                  ? `جارٍ استيراد ${commitProgress.processedRows.toLocaleString('en')} / ${commitProgress.totalRows.toLocaleString('en')}`
                  : 'جارٍ الاستيراد…'
              }
              onClick={commitImport}
              disabled={loudGuardBlocks}
            >
              تأكيد الاستيراد
            </Button>
          )}
        </div>
      </footer>

      <AlertDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="إلغاء الاستيراد؟"
        description="سيُحذف ما تم اختياره وما تم تعيينه من ربط الأعمدة. هذا الإجراء لا يمكن التراجع عنه."
        actionLabel="إلغاء الاستيراد"
        tone="danger"
        onAction={() => {
          setConfirmCancel(false);
          bailToList();
        }}
      />
    </div>
  );
}

function ImportCommitProgressPanel({
  progress,
}: {
  progress: ImportCommitProgress;
}): JSX.Element {
  const pct =
    progress.totalRows > 0
      ? Math.min(100, Math.round((progress.processedRows / progress.totalRows) * 100))
      : 0;

  return (
    <div
      className="mt-4 rounded-md border border-teal-200 bg-teal-50 px-4 py-3"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-teal-800">
        <span className="font-semibold">جارٍ كتابة الصفوف في قاعدة البيانات</span>
        <span className="font-en tabular-nums" dir="ltr">
          {progress.processedRows.toLocaleString('en')} / {progress.totalRows.toLocaleString('en')} · {pct}%
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white">
        <div
          className="h-full rounded-full bg-teal-500 transition-[inline-size] duration-base ease-standard"
          style={{ inlineSize: `${pct}%` }}
        />
      </div>
      <div className="mt-2 grid gap-2 text-2xs text-teal-700 sm:grid-cols-3">
        <span>
          تم إدخال:{' '}
          <b className="font-en tabular-nums" dir="ltr">
            {progress.insertedCount.toLocaleString('en')}
          </b>
        </span>
        <span>
          موجود مسبقًا:{' '}
          <b className="font-en tabular-nums" dir="ltr">
            {progress.alreadyImportedCount.toLocaleString('en')}
          </b>
        </span>
        <span>
          مرفوض:{' '}
          <b className="font-en tabular-nums" dir="ltr">
            {progress.failedCount.toLocaleString('en')}
          </b>
        </span>
      </div>
    </div>
  );
}

function filterAction(
  a: 'skip' | 'override' | 'create-applicant' | undefined,
): 'skip' | 'override' | 'create-applicant' | undefined {
  return a;
}

function TopStepper({
  step,
  onJump,
}: {
  step: StepIndex;
  onJump: (s: StepIndex) => void;
}): JSX.Element {
  return (
    <ol className="m-0 flex list-none items-center gap-0 overflow-auto p-0 text-2xs">
      {STEPS.map((s, i) => {
        const done = s.index < step;
        const active = s.index === step;
        return (
          <li key={s.index} className="contents">
            <button
              type="button"
              onClick={() => onJump(s.index)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border-0 bg-transparent px-2 py-1"
              style={{
                color: done ? 'var(--teal-700)' : active ? 'var(--ink-900)' : 'var(--ink-400)',
                fontWeight: active ? 700 : 500,
              }}
            >
              <span
                className="grid h-6 w-6 place-items-center rounded-full font-en text-2xs font-bold"
                style={{
                  background: done
                    ? 'var(--teal-500)'
                    : active
                      ? 'var(--teal-50)'
                      : 'var(--ink-100)',
                  color: done ? 'var(--text-inverse)' : active ? 'var(--teal-700)' : 'var(--ink-500)',
                  border: active ? '1.5px solid var(--teal-500)' : 'none',
                }}
              >
                {done ? <Check size={12} /> : s.index}
              </span>
              {s.label}
            </button>
            {i < STEPS.length - 1 && (
              <span
                aria-hidden
                className="mx-1 h-px flex-shrink basis-6"
                style={{ background: done ? 'var(--teal-300)' : 'var(--ink-200)' }}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
