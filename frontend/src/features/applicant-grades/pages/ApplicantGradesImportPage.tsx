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
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
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
import type { ImportGroupCode } from '../types';

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
  const reset = useImportWizardStore((s) => s.reset);

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showStep1Errors, setShowStep1Errors] = useState(false);
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
        return true;
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
    if (step > 1) setStep((step - 1) as StepIndex);
  }

  function commitImport(): void {
    if (!table) return;
    /* `graduationYear` is gated by canAdvance on Step 1; commit can only
     * fire once the wizard reached Step 6, so the non-null assertion
     * matches the actual invariant the UI enforces. */
    if (graduationYear == null) return;
    const rows = normaliseRows(table, mapping, filters, graduationYear);
    const actions: Record<ImportGroupCode, 'skip' | 'override' | 'create-applicant' | undefined> = {
      DUPLICATE_NID: filterAction(perGroupActions.DUPLICATE_NID),
      INVALID_NID: filterAction(perGroupActions.INVALID_NID),
      MISSING_REQUIRED: filterAction(perGroupActions.MISSING_REQUIRED),
      NID_NOT_FOUND: filterAction(perGroupActions.NID_NOT_FOUND),
      GRADE_OUT_OF_RANGE: filterAction(perGroupActions.GRADE_OUT_OF_RANGE),
      UNREADABLE_VALUE: filterAction(perGroupActions.UNREADABLE_VALUE),
    };
    commit.mutate(
      {
        rows,
        graduationYear,
        selectedSchoolCategories,
        maxGradeByCategory,
        perGroupActions: actions,
        existingDiffDecisions,
        uploadDuplicateDecisions,
      },
      {
        onSuccess: (res) => {
          const skippedSuffix =
            res.alreadyImportedCount > 0
              ? ` · ${res.alreadyImportedCount.toLocaleString('en')} متجاهل (موجود مسبقًا بنفس سنة التخرج)`
              : '';
          toast(
            `تم استيراد ${res.insertedCount.toLocaleString('en')} صفًا (${res.failedCount.toLocaleString('en')} مرفوض)${skippedSuffix}.`,
            'success',
          );
          reset();
          navigate(ROUTES.admin.applicantGrades);
        },
        onError: () => {
          toast('تعذّر إكمال الاستيراد. حاول مرة أخرى.', 'danger');
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

      <footer className="sticky bottom-0 mt-4 flex items-center justify-between gap-3 border-t border-border-subtle bg-white px-6 py-4">
        <Button
          variant="ghost"
          leadingIcon={<ChevronRight size={14} strokeWidth={1.75} aria-hidden />}
          onClick={back}
          disabled={step === 1}
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
              onClick={commitImport}
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
