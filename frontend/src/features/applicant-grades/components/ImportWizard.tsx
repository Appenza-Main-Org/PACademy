/**
 * ImportWizard — 3-step modal:
 *   A. Setup     — kind / max degree / file upload
 *   B. Review    — per-duplicate accept/reject reconciliation
 *   C. Result    — inserted / replaced / kept summary (+ deactivated banner)
 * + Error step when MISSING_REQUIRED_COLUMN comes back from staging.
 *
 * Duplicates are matched by national-id; DUPLICATE_SEATING_NO is NOT a
 * skip reason — duplicates go through the review flow so the admin can
 * see the diff before committing.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  History,
  Info,
  Pencil,
  RotateCcw,
  Sheet,
  Upload,
  X,
} from 'lucide-react';
import { Badge, Button, Field, Modal } from '@/shared/components';
import { useCommitImport, useStageImport } from '../api/grades.queries';
import {
  MissingColumnError,
  ParseError,
  parseAccessFile,
  type ImportedGradeRow,
} from '../lib/parseAccessFile';
import type {
  CommittedImport,
  ImportDuplicateRow,
  ImportResolution,
  StagedImport,
} from '../types';

type Step = 'setup' | 'review' | 'result' | 'error';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after a successful commit, when the user clicks "عرض الجدول". */
  onComplete?: () => void;
}

export function ImportWizard({ open, onClose, onComplete }: Props): JSX.Element {
  const [step, setStep] = useState<Step>('setup');
  const [setup, setSetup] = useState<{
    kind: 'general' | 'azhar';
    maxDegree: number;
    file: { name: string; size: number; rows: number } | null;
    parsedRows: ImportedGradeRow[] | null;
    missingColumns: string[] | null;
  }>({
    kind: 'general',
    maxDegree: 410,
    file: null,
    parsedRows: null,
    missingColumns: null,
  });
  const [staged, setStaged] = useState<StagedImport | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, ImportResolution>>({});
  const [committed, setCommitted] = useState<CommittedImport | null>(null);
  const [missingForErrorStep, setMissingForErrorStep] = useState<string[]>([]);

  const stageMutation = useStageImport();
  const commitMutation = useCommitImport();

  function reset() {
    setStep('setup');
    setSetup({
      kind: 'general',
      maxDegree: 410,
      file: null,
      parsedRows: null,
      missingColumns: null,
    });
    setStaged(null);
    setResolutions({});
    setCommitted(null);
    setMissingForErrorStep([]);
  }

  function handleClose() {
    onClose();
    /* Defer reset so the modal close animation doesn't show a flash of
     * the setup step. */
    setTimeout(reset, 200);
  }

  async function handleStage() {
    if (setup.missingColumns && setup.missingColumns.length > 0) {
      setMissingForErrorStep(setup.missingColumns);
      setStep('error');
      return;
    }
    if (!setup.parsedRows) return;
    const res = await stageMutation.mutateAsync({
      kind: setup.kind,
      maxDegree: setup.maxDegree,
      rows: setup.parsedRows,
    });
    if (!res.ok) {
      setMissingForErrorStep(res.missing);
      setStep('error');
      return;
    }
    const init: Record<string, ImportResolution> = {};
    for (const d of res.staged.duplicates) {
      init[d.nationalId] = d.hasChanges ? 'ACCEPT' : 'REJECT';
    }
    setResolutions(init);
    setStaged(res.staged);
    setStep(res.staged.duplicates.length > 0 ? 'review' : 'result');
  }

  async function handleCommit() {
    if (!staged) return;
    const result = await commitMutation.mutateAsync({ staged, resolutions });
    setCommitted(result);
    setStep('result');
  }

  const title =
    step === 'setup'
      ? 'استيراد درجات المتقدمين'
      : step === 'review'
        ? 'مراجعة التكرار'
        : step === 'error'
          ? 'استيراد درجات المتقدمين'
          : 'اكتمل الاستيراد';

  const subtitle =
    step === 'setup'
      ? 'ارفع ملف البيانات — سيُحلَّل أولاً وتراجَع التكرارات قبل الكتابة على قاعدة البيانات.'
      : step === 'review'
        ? 'اختر لكل صف مكرر — قبول البيانات الجديدة أو الإبقاء على القائمة. التعديلات تبقى مرتبطة بالطالب.'
        : step === 'error'
          ? 'تعذّر قبول الملف — راجع الأخطاء أدناه'
          : (
              <span>
                <span className="font-en">2026</span> ·{' '}
                {setup.kind === 'general' ? 'ثانوية عامة' : 'ثانوية أزهرية'} · الحد الأقصى{' '}
                <span className="font-en">{setup.maxDegree}</span>
              </span>
            );

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size={step === 'review' ? 'lg' : 'md'}
      transparentBackdrop={false}
      title={
        <div>
          <div className="text-md font-bold text-ink-900">{title}</div>
          <StepIndicator step={step === 'error' ? 'setup' : step} />
        </div>
      }
      subtitle={subtitle}
    >
      {step === 'setup' && (
        <SetupStep
          setup={setup}
          onChange={setSetup}
          onContinue={() => void handleStage()}
          onCancel={handleClose}
          loading={stageMutation.isPending}
        />
      )}
      {step === 'error' && (
        <ErrorStep
          missing={missingForErrorStep}
          kind={setup.kind}
          onBack={() => setStep('setup')}
          onCancel={handleClose}
        />
      )}
      {step === 'review' && staged && (
        <ReviewStep
          staged={staged}
          resolutions={resolutions}
          onResolutionsChange={setResolutions}
          onBack={() => setStep('setup')}
          onCommit={() => void handleCommit()}
          loading={commitMutation.isPending}
        />
      )}
      {step === 'result' && (
        <ResultStep
          result={committed}
          onClose={() => {
            onComplete?.();
            handleClose();
          }}
          onImportAnother={() => {
            setStaged(null);
            setCommitted(null);
            setStep('setup');
          }}
        />
      )}
    </Modal>
  );
}

/* ─── Step indicator ──────────────────────────────────────────────────── */

const STEPS = [
  { key: 'setup', label: 'الإعدادات' },
  { key: 'review', label: 'مراجعة التكرار' },
  { key: 'result', label: 'النتيجة' },
] as const;

function StepIndicator({ step }: { step: 'setup' | 'review' | 'result' }): JSX.Element {
  const idx = STEPS.findIndex((s) => s.key === step);
  return (
    <ol className="m-0 mt-3 flex list-none items-center gap-0 p-0 text-2xs">
      {STEPS.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <li key={s.key} className="contents">
            <span
              className="inline-flex items-center gap-1.5 py-1"
              style={{
                color: done ? 'var(--teal-700)' : active ? 'var(--ink-900)' : 'var(--ink-400)',
                fontWeight: active ? 700 : 500,
              }}
            >
              <span
                className="grid h-[18px] w-[18px] place-items-center rounded-full font-en text-2xs font-bold"
                style={{
                  background: done
                    ? 'var(--teal-500)'
                    : active
                      ? 'var(--teal-50)'
                      : 'var(--ink-100)',
                  color: done ? '#fff' : active ? 'var(--teal-700)' : 'var(--ink-500)',
                  border: active ? '1.5px solid var(--teal-500)' : 'none',
                }}
              >
                {done ? <Check size={11} /> : i + 1}
              </span>
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <span
                aria-hidden
                className="mx-2 h-px flex-shrink basis-7"
                style={{ background: i < idx ? 'var(--teal-300)' : 'var(--ink-200)' }}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ─── Step A — Setup ──────────────────────────────────────────────────── */

/**
 * Accepted file extensions per secondary-type. The Ministry of
 * Education ships the legacy Microsoft Access `.mdb` exports for
 * general secondary, and the Ministry of Awqaf ships the modern
 * `.accdb` exports for azhar. Hand-prepared spreadsheet variants
 * (`.xlsx`/`.xls`/`.csv`) are no longer accepted — admins must
 * upload the original Access export untouched, both to preserve the
 * source-of-truth audit trail and to avoid silent transcription
 * errors that crept in when the wizard accepted re-entered sheets.
 */
const ACCEPTED_EXTENSIONS: Record<'general' | 'azhar', readonly string[]> = {
  general: ['.mdb'],
  azhar: ['.accdb'],
};

/**
 * Maximum file size per extension, in megabytes. `.mdb` exports run
 * larger than `.accdb` because the older format doesn't compact
 * tablespace pages between writes — we cap each at the highest size
 * we've seen in practice (with a small margin) so an admin who
 * uploads the wrong DB still hits a useful error rather than a
 * silent timeout.
 */
const SIZE_LIMITS_MB: Record<string, number> = {
  '.mdb': 500,
  '.accdb': 100,
};

const MB = 1024 * 1024;

/** Returns the canonical extension (`.mdb`, `.csv`, …) of `fileName` if
 *  any of `allowed` matches, or `null` if the extension isn't allowed. */
function matchExtension(fileName: string, allowed: readonly string[]): string | null {
  const lower = fileName.toLowerCase();
  return allowed.find((ext) => lower.endsWith(ext)) ?? null;
}

/** Validate a freshly-picked file against the kind's accepted extensions
 *  and size limits. Returns `null` when the file passes, otherwise an
 *  Arabic error string suitable for the inline error chip. */
function validateFile(
  file: { name: string; size: number },
  kind: 'general' | 'azhar',
): string | null {
  const ext = matchExtension(file.name, ACCEPTED_EXTENSIONS[kind]);
  if (!ext) {
    const list = ACCEPTED_EXTENSIONS[kind].join('، ');
    return `صيغة الملف غير مدعومة. الصيغ المقبولة: ${list}`;
  }
  const limitMb = SIZE_LIMITS_MB[ext];
  if (limitMb && file.size > limitMb * MB) {
    const actualMb = (file.size / MB).toFixed(file.size / MB >= 100 ? 0 : 1);
    return `حجم الملف (${actualMb} م.ب) يتجاوز الحد الأقصى ${limitMb} م.ب لصيغة ${ext}`;
  }
  return null;
}

interface SetupProps {
  setup: {
    kind: 'general' | 'azhar';
    maxDegree: number;
    file: { name: string; size: number; rows: number } | null;
    parsedRows: ImportedGradeRow[] | null;
    missingColumns: string[] | null;
  };
  onChange: (next: SetupProps['setup']) => void;
  onContinue: () => void;
  onCancel: () => void;
  loading: boolean;
}

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

interface UploadState {
  status: UploadStatus;
  /** File metadata captured at pick time; survives across status changes. */
  meta: { name: string; size: number } | null;
  progress: number;
  errorMessage: string | null;
}

const IDLE_UPLOAD: UploadState = {
  status: 'idle',
  meta: null,
  progress: 0,
  errorMessage: null,
};

function SetupStep({ setup, onChange, onContinue, onCancel, loading }: SetupProps): JSX.Element {
  const inp = useRef<HTMLInputElement | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [upload, setUpload] = useState<UploadState>(IDLE_UPLOAD);

  /** Live FileReader pumping the picked file into memory. We keep a ref
   *  so cancel/remove/retry can abort the in-flight read deterministically
   *  (`reader.abort()` synchronously fires `onabort`). */
  const readerRef = useRef<FileReader | null>(null);
  /** Original `File` object kept so `retryUpload` can restart the read on
   *  the same file without re-prompting the picker. */
  const lastFileRef = useRef<File | null>(null);

  /* Reflect setup.file changes — when the parent clears the file (e.g. on
   * kind switch), reset the upload tile too. */
  useEffect(() => {
    if (setup.file == null && upload.status === 'success') {
      setUpload(IDLE_UPLOAD);
    }
    /* Cleanup the in-flight read when the step unmounts (modal close
     * mid-upload). `abort` is a no-op on a settled reader, so this is
     * safe in every state. */
    return () => {
      if (readerRef.current) {
        readerRef.current.abort();
        readerRef.current = null;
      }
    };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [setup.file]);

  const cols =
    setup.kind === 'general'
      ? [
          'seating_no',
          'national_no',
          'arabic_name',
          'sex_name',
          'school_name',
          'branch_desc_new',
          'total_degree',
          'student_case_desc',
        ]
      : ['StSeatNo', 'StudenName', 'DevisionName', 'National_Code', 'ZonName', 'InstituteName', 'Total2'];

  const acceptedExts = ACCEPTED_EXTENSIONS[setup.kind];
  const acceptAttr = acceptedExts.join(',');

  /** Single-extension hint: each kind now accepts exactly one Access
   *  format (`.mdb` for general, `.accdb` for azhar) with its own
   *  size cap. Read straight off `SIZE_LIMITS_MB`. */
  const sizeLimitMb = SIZE_LIMITS_MB[acceptedExts[0]!] ?? 100;

  const canSubmit =
    setup.file && setup.maxDegree > 0 && fileError === null && upload.status === 'success';

  /** Start a real `FileReader`-driven read of `file`. The reader emits
   *  `progress` events whose `loaded/total` ratio is what the UI
   *  surfaces — there's no fake `setInterval` walk any more. On `load`
   *  the file is handed off to `setup.file` so the wizard can continue
   *  to the stage step; on `error` / `abort` the UI lands in the error
   *  state with the retry affordance. */
  function startUpload(file: File): void {
    /* Abort any reader still pumping a previous file. */
    if (readerRef.current) readerRef.current.abort();
    lastFileRef.current = file;
    setUpload({
      status: 'uploading',
      meta: { name: file.name, size: file.size },
      progress: 0,
      errorMessage: null,
    });

    const reader = new FileReader();
    readerRef.current = reader;
    /* Track who initiated the abort. `reader.abort()` is the same call
     * for "user pressed cancel" (idle outcome) and "read aborted by the
     * mid-progress test trigger" (error outcome); the flag lets
     * `onabort` distinguish the two. */
    let abortReason: 'cancel' | 'fail' | null = null;

    reader.onprogress = (ev) => {
      if (!ev.lengthComputable) return;
      const pct = Math.min(99, Math.round((ev.loaded / ev.total) * 100));
      setUpload((prev) =>
        prev.status === 'uploading' ? { ...prev, progress: pct } : prev,
      );
    };
    reader.onload = () => {
      readerRef.current = null;
      const buffer = reader.result;
      if (!(buffer instanceof ArrayBuffer)) {
        setUpload((prev) => ({
          ...prev,
          status: 'error',
          errorMessage: 'تعذّر قراءة محتويات الملف.',
        }));
        return;
      }
      try {
        const rows = parseAccessFile(buffer, setup.kind);
        onChange({
          ...setup,
          file: { name: file.name, size: file.size, rows: rows.length },
          parsedRows: rows,
          missingColumns: null,
        });
        setUpload((prev) => ({ ...prev, status: 'success', progress: 100 }));
      } catch (err) {
        if (err instanceof MissingColumnError) {
          onChange({
            ...setup,
            file: { name: file.name, size: file.size, rows: 0 },
            parsedRows: null,
            missingColumns: [...err.missing],
          });
          setUpload((prev) => ({ ...prev, status: 'success', progress: 100 }));
          return;
        }
        const message =
          err instanceof ParseError
            ? err.message
            : 'تعذّر قراءة الملف. تأكد من سلامته ثم حاول مرة أخرى.';
        setUpload((prev) => ({ ...prev, status: 'error', errorMessage: message }));
      }
    };
    reader.onerror = () => {
      readerRef.current = null;
      setUpload((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: 'تعذّر قراءة الملف. تأكد من سلامته ثم حاول مرة أخرى.',
      }));
    };
    reader.onabort = () => {
      readerRef.current = null;
      if (abortReason === 'fail') {
        setUpload((prev) => ({
          ...prev,
          status: 'error',
          errorMessage: 'تعذّر رفع الملف — انقطع الاتصال بالخادم. حاول مرة أخرى.',
        }));
      }
      /* On `cancel`, `cancelUpload` has already reset `upload` to idle. */
    };

    /* Files whose name contains "خطأ"/"upload-fail" abort midway through
     * the real read so the failure / retry path stays exercisable.
     * The abort path is keyed off `abortReason` rather than file size,
     * so it lands at whatever progress% the read is at when the timer
     * fires. */
    if (/(?:خطأ|upload-fail)/i.test(file.name)) {
      window.setTimeout(() => {
        if (readerRef.current === reader && reader.readyState === FileReader.LOADING) {
          abortReason = 'fail';
          reader.abort();
        }
      }, 400);
    }

    reader.readAsArrayBuffer(file);
  }

  function cancelUpload(): void {
    if (readerRef.current) {
      readerRef.current.abort();
      readerRef.current = null;
    }
    setUpload(IDLE_UPLOAD);
    onChange({ ...setup, file: null, parsedRows: null, missingColumns: null });
  }

  function retryUpload(): void {
    if (lastFileRef.current) startUpload(lastFileRef.current);
  }

  function removeFile(): void {
    if (readerRef.current) {
      readerRef.current.abort();
      readerRef.current = null;
    }
    lastFileRef.current = null;
    setUpload(IDLE_UPLOAD);
    setFileError(null);
    onChange({ ...setup, file: null, parsedRows: null, missingColumns: null });
  }

  function acceptFile(f: File): void {
    const err = validateFile({ name: f.name, size: f.size }, setup.kind);
    if (err) {
      setFileError(err);
      setUpload(IDLE_UPLOAD);
      onChange({ ...setup, file: null, parsedRows: null, missingColumns: null });
      return;
    }
    setFileError(null);
    startUpload(f);
  }
  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) acceptFile(f);
    /* Reset the input so picking the same filename twice re-fires onChange
     * (useful when the user retries after fixing the file). */
    e.target.value = '';
  }
  function drop(e: React.DragEvent) {
    e.preventDefault();
    if (upload.status === 'uploading') return;
    const f = e.dataTransfer.files?.[0];
    if (f) acceptFile(f);
  }

  return (
    <>
      <Modal.Body>
        <div className="flex flex-col gap-4">
          <Field label="نوع الثانوية" required helper="يحدد الأعمدة المتوقعة في الملف">
            <div
              className="inline-flex w-fit gap-0.5 rounded-md border border-border-default bg-ink-50 p-0.5"
              role="group"
            >
              {(
                [
                  { v: 'general', label: 'ثانوية عامة' },
                  { v: 'azhar', label: 'ثانوية أزهرية' },
                ] as const
              ).map(({ v, label }) => {
                const a = setup.kind === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      /* Clear the file when the kind changes — the accepted
                       * extensions differ (.mdb vs .accdb), so a file picked
                       * under the previous kind may no longer pass the new
                       * extension/size validation. */
                      const fileStillValid =
                        setup.file != null
                        && validateFile(
                          { name: setup.file.name, size: setup.file.size },
                          v,
                        ) === null;
                      setFileError(null);
                      onChange({
                        ...setup,
                        kind: v,
                        maxDegree: v === 'general' ? 410 : 510,
                        file: fileStillValid ? setup.file : null,
                        parsedRows: null,
                        missingColumns: null,
                      });
                    }}
                    className="cursor-pointer rounded-sm border-0 px-4 py-1.5 text-sm font-medium transition-colors"
                    style={{
                      background: a ? 'var(--teal-500)' : 'transparent',
                      color: a ? '#fff' : 'var(--ink-700)',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="الدرجة العظمى" required helper="القيمة المستخدمة لاحتساب النسبة المئوية">
            <div className="flex items-center gap-2">
              <label
                className="inline-flex h-9 cursor-text items-center gap-2 rounded-md border border-border-default bg-white px-3 text-sm font-medium text-ink-900"
                style={{ width: 120 }}
              >
                <input
                  type="number"
                  value={setup.maxDegree}
                  min={1}
                  max={1000}
                  onChange={(e) =>
                    onChange({ ...setup, maxDegree: e.target.value === '' ? 0 : Number(e.target.value) })
                  }
                  className="min-w-0 flex-1 border-0 bg-transparent p-0 font-en text-sm font-medium text-ink-900 outline-none"
                />
                <span className="text-xs text-ink-500">درجة</span>
              </label>
              <div className="flex gap-1">
                {[410, 510].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onChange({ ...setup, maxDegree: p })}
                    className="cursor-pointer rounded-full border px-3 py-1 font-en text-2xs font-medium"
                    style={{
                      background: setup.maxDegree === p ? 'var(--teal-500)' : '#fff',
                      color: setup.maxDegree === p ? '#fff' : 'var(--ink-700)',
                      borderColor: setup.maxDegree === p ? 'var(--teal-500)' : 'var(--border-default)',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </Field>

          <Field label="ملف البيانات" required error={fileError ?? undefined}>
            <input
              ref={inp}
              type="file"
              accept={acceptAttr}
              onChange={pick}
              className="pointer-events-none absolute h-px w-px opacity-0"
            />
            {upload.status === 'idle' && (
              <div
                role="button"
                tabIndex={0}
                onClick={() => inp.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    inp.current?.click();
                  }
                }}
                onDrop={drop}
                onDragOver={(e) => e.preventDefault()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed bg-white px-4 py-5 text-ink-500 ${
                  fileError ? 'border-terra-300' : 'border-border-strong'
                }`}
              >
                <Upload size={14} className="text-ink-500" aria-hidden />
                <div className="text-sm font-medium text-ink-700">
                  اسحب الملف هنا أو انقر للاختيار
                </div>
                <div className="flex flex-col items-center gap-0.5 text-2xs text-ink-500">
                  <div>
                    <span className="font-en">{acceptedExts[0]}</span>
                  </div>
                  <div>
                    حتى <span className="font-en">{sizeLimitMb}</span> م.ب
                  </div>
                </div>
              </div>
            )}

            {upload.status === 'uploading' && upload.meta && (
              <UploadingCard
                meta={upload.meta}
                progress={upload.progress}
                onCancel={cancelUpload}
              />
            )}

            {upload.status === 'error' && upload.meta && (
              <UploadErrorCard
                meta={upload.meta}
                message={upload.errorMessage ?? 'تعذّر رفع الملف.'}
                onRetry={retryUpload}
                onRemove={removeFile}
              />
            )}

            {upload.status === 'success' && setup.file && (
              <>
                <div className="flex items-center gap-3 rounded-md border border-success bg-success-bg p-3.5">
                  <div className="grid h-10 w-10 place-items-center rounded-md border border-success bg-white text-success">
                    <Sheet size={14} aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold text-ink-900">
                      {setup.file.name}
                    </div>
                    <div className="flex gap-2 text-2xs text-ink-500">
                      <span className="font-en">{formatSize(setup.file.size)}</span>
                      <span>·</span>
                      <span className="font-en text-success">
                        {setup.file.rows.toLocaleString('en')} صف
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removeFile}
                    aria-label="إزالة"
                    className="grid h-7 w-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-ink-500 hover:bg-white"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2 overflow-hidden rounded-sm border border-border-subtle bg-ink-50 p-2 font-mono text-2xs text-ink-700">
                  <Check size={14} className="shrink-0 text-success" aria-hidden />
                  <span className="shrink-0 text-ink-500">الأعمدة:</span>
                  <span dir="ltr" className="overflow-hidden text-ellipsis">
                    {cols.join(' · ')}
                  </span>
                  <span className="ms-auto shrink-0 rounded-full bg-success-bg px-1.5 font-en text-2xs font-semibold text-success">
                    {cols.length}/{cols.length}
                  </span>
                </div>
              </>
            )}
          </Field>

          <div className="flex items-start gap-2 rounded-md border border-teal-100 bg-teal-50 px-3 py-2.5 text-xs text-teal-700">
            <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              في الخطوة التالية سيتم رصد أي صف موجود مسبقاً (مطابقة بـ <strong>الرقم القومي</strong>)
              وستراجع التغييرات قبل الكتابة. لن يُحذف أي صف قبل التأكيد.
            </span>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <div className="ms-auto flex gap-2">
          <Button variant="secondary" onClick={onCancel}>
            إلغاء
          </Button>
          <Button
            variant="primary"
            trailingIcon={<ChevronLeft size={14} />}
            disabled={!canSubmit}
            isLoading={loading}
            onClick={onContinue}
          >
            متابعة
          </Button>
        </div>
      </Modal.Footer>
    </>
  );
}

/* Format a byte count for the upload tile (e.g. "12.4 م.ب", "850 ك.ب"). */
function formatSize(bytes: number): string {
  if (bytes >= MB) {
    const v = bytes / MB;
    return `${v.toFixed(v >= 100 ? 0 : 1)} م.ب`;
  }
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} ك.ب`;
  return `${bytes} ب`;
}

function UploadingCard({
  meta,
  progress,
  onCancel,
}: {
  meta: { name: string; size: number };
  progress: number;
  onCancel: () => void;
}): JSX.Element {
  const clamped = Math.max(0, Math.min(100, progress));
  return (
    <div
      className="flex items-center gap-3 rounded-md border border-teal-200 bg-teal-50 p-3.5"
      role="status"
      aria-live="polite"
    >
      <div className="grid h-10 w-10 place-items-center rounded-md border border-teal-300 bg-white text-teal-700">
        <Sheet size={14} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold text-ink-900">
            {meta.name}
          </div>
          <span className="shrink-0 font-en text-2xs font-semibold text-teal-700">
            {clamped}٪
          </span>
        </div>
        <div className="mt-0.5 flex gap-2 text-2xs text-ink-500">
          <span className="font-en">{formatSize(meta.size)}</span>
          <span>·</span>
          <span className="text-teal-700">جارٍ الرفع…</span>
        </div>
        <div
          className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-ink-100"
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="تقدّم رفع الملف"
        >
          <div
            className="h-full rounded-full bg-teal-500 transition-all"
            style={{ width: `${clamped}%` }}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={onCancel}
        aria-label="إلغاء الرفع"
        title="إلغاء الرفع"
        className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-ink-500 hover:bg-white focus-visible:shadow-focus-teal focus-visible:outline-none"
      >
        <X size={14} />
      </button>
    </div>
  );
}

function UploadErrorCard({
  meta,
  message,
  onRetry,
  onRemove,
}: {
  meta: { name: string; size: number };
  message: string;
  onRetry: () => void;
  onRemove: () => void;
}): JSX.Element {
  return (
    <div
      className="flex items-start gap-3 rounded-md border border-terra-300 border-s-[3px] border-s-terra-500 bg-terra-50 p-3.5"
      role="alert"
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-terra-300 bg-white text-terra-700">
        <AlertTriangle size={14} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold text-ink-900">
          {meta.name}
        </div>
        <div className="mt-0.5 flex gap-2 text-2xs text-ink-500">
          <span className="font-en">{formatSize(meta.size)}</span>
          <span>·</span>
          <span className="text-terra-700">{message}</span>
        </div>
        <div className="mt-2 flex gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            leadingIcon={<RotateCcw size={12} strokeWidth={1.75} />}
            onClick={onRetry}
          >
            إعادة المحاولة
          </Button>
          <Button size="sm" variant="ghost" onClick={onRemove}>
            إزالة
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Step B — Review ─────────────────────────────────────────────────── */

interface ReviewProps {
  staged: StagedImport;
  resolutions: Record<string, ImportResolution>;
  onResolutionsChange: (next: Record<string, ImportResolution>) => void;
  onBack: () => void;
  onCommit: () => void;
  loading: boolean;
}

type DupFilter = 'all' | 'changed' | 'same' | 'accept' | 'reject';

function ReviewStep({
  staged,
  resolutions,
  onResolutionsChange,
  onBack,
  onCommit,
  loading,
}: ReviewProps): JSX.Element {
  const [filter, setFilter] = useState<DupFilter>('all');
  const dups = staged.duplicates;

  const counts = useMemo(() => {
    const accept = Object.values(resolutions).filter((r) => r === 'ACCEPT').length;
    const reject = Object.values(resolutions).filter((r) => r === 'REJECT').length;
    const changed = dups.filter((d) => d.hasChanges).length;
    const same = dups.filter((d) => !d.hasChanges).length;
    return { accept, reject, changed, same, all: dups.length };
  }, [resolutions, dups]);

  const filtered = useMemo(() => {
    if (filter === 'changed') return dups.filter((d) => d.hasChanges);
    if (filter === 'same') return dups.filter((d) => !d.hasChanges);
    if (filter === 'accept') return dups.filter((d) => resolutions[d.nationalId] === 'ACCEPT');
    if (filter === 'reject') return dups.filter((d) => resolutions[d.nationalId] === 'REJECT');
    return dups;
  }, [dups, filter, resolutions]);

  function setOne(nid: string, val: ImportResolution) {
    onResolutionsChange({ ...resolutions, [nid]: val });
  }
  function setAll(val: ImportResolution) {
    const next: Record<string, ImportResolution> = {};
    for (const d of dups) next[d.nationalId] = val;
    onResolutionsChange(next);
  }
  function smartAccept() {
    const next: Record<string, ImportResolution> = {};
    for (const d of dups) next[d.nationalId] = d.hasChanges ? 'ACCEPT' : 'REJECT';
    onResolutionsChange(next);
  }

  const finalInsert = staged.newRows + counts.accept;
  const skippedTotal = staged.skipped.reduce((s, x) => s + x.count, 0);

  return (
    <>
      <Modal.Body className="!px-0 !py-0">
        <div className="grid grid-cols-4 border-b border-border-subtle bg-ink-50">
          <SummaryCell value={staged.newRows.toLocaleString('en')} label="صف جديد" tone="ink" />
          <SummaryCell value={String(dups.length)} label="صف مكرر · للمراجعة" tone="info" big />
          <SummaryCell value={String(skippedTotal)} label="صف مرفوض" tone="warn" />
          <SummaryCell value={finalInsert.toLocaleString('en')} label="ستُكتب بعد التأكيد" tone="success" />
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-white px-6 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-2xs text-ink-500">إجراء جماعي</span>
            <Button size="sm" variant="secondary" onClick={() => setAll('ACCEPT')}>
              قبول الكل
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setAll('REJECT')}>
              رفض الكل
            </Button>
            <Button size="sm" variant="secondary" leadingIcon={<Filter size={14} />} onClick={smartAccept}>
              قبول التغييرات فقط
            </Button>
          </div>
          <div className="flex items-center gap-1 text-2xs">
            <FilterPill active={filter === 'all'} onClick={() => setFilter('all')} label="الكل" n={counts.all} />
            <FilterPill
              active={filter === 'changed'}
              onClick={() => setFilter('changed')}
              label="متغيرة"
              n={counts.changed}
              tone="gold"
            />
            <FilterPill
              active={filter === 'same'}
              onClick={() => setFilter('same')}
              label="مطابقة"
              n={counts.same}
              tone="ink"
            />
            <span className="mx-1 h-4 w-px bg-border-default" />
            <FilterPill
              active={filter === 'accept'}
              onClick={() => setFilter('accept')}
              label="مقبولة"
              n={counts.accept}
              tone="success"
            />
            <FilterPill
              active={filter === 'reject'}
              onClick={() => setFilter('reject')}
              label="مرفوضة"
              n={counts.reject}
              tone="terra"
            />
          </div>
        </div>

        {/* List */}
        <div className="bg-ink-50 px-6 py-4">
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {filtered.map((d) => (
              <li key={d.nationalId}>
                <DuplicateCard
                  dup={d}
                  resolution={resolutions[d.nationalId]}
                  onResolve={(val) => setOne(d.nationalId, val)}
                />
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="rounded-md border border-dashed border-border-default bg-white px-4 py-6 text-center text-sm text-ink-500">
                لا توجد صفوف مطابقة للتصفية الحالية.
              </li>
            )}
          </ul>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" leadingIcon={<ChevronRight size={14} />} onClick={onBack}>
          السابق
        </Button>
        <div className="ms-auto flex items-center gap-3.5">
          <span className="text-2xs text-ink-500">
            <span className="font-en font-semibold text-ink-900">{counts.accept}</span> مقبول ·{' '}
            <span className="font-en font-semibold text-ink-900">{counts.reject}</span> مرفوض
          </span>
          <Button
            variant="primary"
            leadingIcon={<Check size={14} />}
            isLoading={loading}
            onClick={onCommit}
          >
            تأكيد الاستيراد · <span className="font-en">{finalInsert.toLocaleString('en')}</span> صف
          </Button>
        </div>
      </Modal.Footer>
    </>
  );
}

function SummaryCell({
  value,
  label,
  tone,
  big,
}: {
  value: string;
  label: string;
  tone: 'success' | 'warn' | 'info' | 'ink';
  big?: boolean;
}): JSX.Element {
  const map = {
    success: { cls: 'bg-success-bg text-success', accent: 'bg-success' },
    warn: { cls: 'bg-gold-50 text-gold-700', accent: 'bg-gold-700' },
    info: { cls: 'bg-teal-50 text-teal-700', accent: 'bg-teal-700' },
    ink: { cls: 'bg-white text-ink-700', accent: 'bg-ink-700' },
  } as const;
  const t = map[tone];
  return (
    <div
      className={`relative flex flex-col gap-0.5 border-s border-border-subtle px-4 py-3 first:border-s-0 ${t.cls}`}
    >
      {big && <span aria-hidden className={`absolute inset-x-0 top-0 h-0.5 ${t.accent}`} />}
      <span
        className={`font-ar-display font-en font-bold leading-tight ${big ? 'text-2xl' : 'text-xl'}`}
      >
        {value}
      </span>
      <span className="text-2xs opacity-85">{label}</span>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  n,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  n: number;
  tone?: 'gold' | 'success' | 'terra' | 'ink';
}): JSX.Element {
  const map = {
    gold: 'bg-gold-50 text-gold-700',
    success: 'bg-success-bg text-success',
    terra: 'bg-terra-50 text-terra-700',
    ink: 'bg-ink-100 text-ink-700',
  } as const;
  const counterCls = tone ? map[tone] : 'bg-ink-100 text-ink-500';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs ${
        active
          ? 'border-border-default bg-white font-semibold text-ink-900'
          : 'border-transparent bg-transparent font-medium text-ink-500'
      }`}
    >
      {label}
      <span className={`rounded-full px-1.5 font-en text-2xs font-semibold ${counterCls}`}>{n}</span>
    </button>
  );
}

function DuplicateCard({
  dup,
  resolution,
  onResolve,
}: {
  dup: ImportDuplicateRow;
  resolution: ImportResolution | undefined;
  onResolve: (val: ImportResolution) => void;
}): JSX.Element {
  const isAccept = resolution === 'ACCEPT';
  const isReject = resolution === 'REJECT';
  const newEff = dup.incoming.total + dup.adjustmentSum;
  const willDeactivate =
    dup.adjustmentCount > 0 && isAccept && (newEff > dup.maxDegree || newEff < 0);
  const wasteful = !dup.hasChanges && isAccept;

  const borderClasses = isAccept
    ? 'border-success border-s-success'
    : isReject
      ? 'border-border-default border-s-ink-300'
      : 'border-border-subtle border-s-gold-400';
  return (
    <article className={`overflow-hidden rounded-md border bg-white border-s-[3px] ${borderClasses}`}>
      <header className="flex items-center justify-between gap-3 border-b border-border-subtle px-3.5 py-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink-900">{dup.name}</span>
            <Badge tone={dup.kind === 'general' ? 'info' : 'warning'}>
              {dup.kind === 'general' ? 'عامة' : 'أزهرية'}
            </Badge>
            {dup.hasChanges ? (
              <Badge tone="warning" icon={<Pencil size={11} aria-hidden />}>
                <span className="font-en">{dup.changedFields.length}</span> حقول متغيرة
              </Badge>
            ) : (
              <Badge tone="neutral" icon={<Check size={11} aria-hidden />}>
                مطابق
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-2xs text-ink-500">
            <span dir="ltr" className="font-en">رقم قومي {dup.nationalId}</span>
            <span>·</span>
            <span dir="ltr" className="font-en">رقم جلوس {dup.seatExisting.toLocaleString('en')}</span>
            {dup.adjustmentCount > 0 && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <History size={11} className="text-gold-600" aria-hidden />
                  <span className="font-en">{dup.adjustmentCount}</span> تعديل
                  <span
                    className="font-en"
                    style={{
                      color: dup.adjustmentSum >= 0 ? 'var(--gold-700)' : 'var(--terra-700)',
                    }}
                  >
                    ({dup.adjustmentSum >= 0 ? '+' : ''}
                    {dup.adjustmentSum})
                  </span>
                </span>
              </>
            )}
          </div>
        </div>

        <div
          className="inline-flex shrink-0 gap-0.5 rounded-md border border-border-default bg-ink-50 p-0.5"
          role="group"
        >
          <ResolveBtn
            label="قبول الجديد"
            active={isAccept}
            tone="success"
            onClick={() => onResolve('ACCEPT')}
          />
          <ResolveBtn
            label="إبقاء الحالي"
            active={isReject}
            tone="ink"
            onClick={() => onResolve('REJECT')}
          />
        </div>
      </header>

      {dup.hasChanges ? (
        <div className="flex flex-col gap-2.5 px-3.5 py-3">
          <DiffTable dup={dup} resolution={resolution} />
          {willDeactivate && (
            <div className="flex items-start gap-2 rounded-md border border-terra-300 border-s-[3px] border-s-terra-500 bg-terra-50 px-3 py-2.5 text-xs text-terra-700">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
              <div>
                <div className="mb-0.5 font-semibold">
                  التعديل النشط{' '}
                  <span className="font-en">
                    {dup.adjustmentSum >= 0 ? '+' : ''}
                    {dup.adjustmentSum}
                  </span>{' '}
                  سيُعطّل تلقائياً
                </div>
                <div>
                  لأن (المجموع الجديد <span className="font-en">{dup.incoming.total}</span> + التعديل{' '}
                  <span className="font-en">
                    {dup.adjustmentSum >= 0 ? '+' : ''}
                    {dup.adjustmentSum}
                  </span>{' '}
                  = <span className="font-en">{newEff}</span>) يتجاوز الحد الأقصى{' '}
                  <span className="font-en">{dup.maxDegree}</span>. يمكن إعادة تفعيله يدوياً من سجل
                  التعديلات.
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2.5 px-4 py-3.5 text-xs text-ink-600">
          <Info size={14} className="shrink-0 text-teal-500" aria-hidden />
          <span>
            <strong className="text-ink-700">لا توجد تغييرات بين الصفوف.</strong> الاستيراد لن
            يُحدث أي بيانات — يُقترح الإبقاء على الصف الحالي.
          </span>
        </div>
      )}

      {wasteful && (
        <div className="flex items-center gap-1.5 border-t border-gold-200 bg-gold-50 px-3.5 py-2 text-2xs text-gold-700">
          <Info size={14} aria-hidden /> القبول هنا لن يُغيّر شيئاً — الصفوف متطابقة.
        </div>
      )}
    </article>
  );
}

function ResolveBtn({
  label,
  active,
  tone,
  onClick,
}: {
  label: string;
  active: boolean;
  tone: 'success' | 'ink';
  onClick: () => void;
}): JSX.Element {
  const activeCls =
    tone === 'success' ? 'bg-success-bg text-success font-semibold' : 'bg-white text-ink-900 font-semibold';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-sm border-0 px-3 py-1 text-2xs transition-colors ${
        active ? activeCls : 'bg-transparent font-medium text-ink-700 hover:bg-ink-50'
      }`}
    >
      {active && <Check size={12} aria-hidden />}
      {label}
    </button>
  );
}

const FIELD_LABELS: Record<string, string> = {
  total: 'المجموع',
  branch: 'الشعبة',
  school: 'المدرسة / المعهد',
  region: 'المنطقة',
  status: 'الحالة',
};

function DiffTable({
  dup,
  resolution,
}: {
  dup: ImportDuplicateRow;
  resolution: ImportResolution | undefined;
}): JSX.Element {
  const fields: Array<{ key: 'total' | 'branch' | 'school' | 'region' | 'status'; numeric: boolean }> = [
    { key: 'total', numeric: true },
    { key: 'branch', numeric: false },
    { key: 'school', numeric: false },
    { key: 'region', numeric: false },
    { key: 'status', numeric: false },
  ];
  const isReject = resolution === 'REJECT';
  const gridCols = { gridTemplateColumns: '140px 1fr 1fr' };
  return (
    <div className="overflow-hidden rounded-sm border border-border-subtle">
      <div
        className="grid border-b border-border-subtle bg-ink-50 px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-500"
        style={gridCols}
      >
        <span>الحقل</span>
        <span>الحالي</span>
        <span>الجديد</span>
      </div>
      {fields.map(({ key, numeric }) => {
        const changed = dup.changedFields.includes(key);
        const exVal = String(dup.existing[key]);
        const inVal = String(dup.incoming[key]);
        const numericDelta = numeric ? Number(dup.incoming[key]) - Number(dup.existing[key]) : 0;
        return (
          <div
            key={key}
            className={`grid border-b border-border-subtle px-3 py-1.5 text-xs ${
              changed ? 'bg-gold-50 opacity-100' : 'bg-white opacity-60'
            }`}
            style={gridCols}
          >
            <span className="font-medium text-ink-600">{FIELD_LABELS[key]}</span>
            <span
              className={`${numeric ? 'font-en' : ''} ${
                changed ? 'font-medium text-ink-700' : 'text-ink-500'
              } ${changed && !isReject ? 'line-through' : ''}`}
            >
              {exVal}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 ${numeric ? 'font-en' : ''} ${
                changed ? (isReject ? 'text-ink-400' : 'font-bold text-gold-700') : 'text-ink-500'
              } ${changed && isReject ? 'line-through' : ''}`}
            >
              {inVal}
              {numeric && changed && numericDelta !== 0 && (
                <span
                  className={`inline-flex items-center gap-0.5 rounded-full px-1.5 font-en text-2xs font-semibold ${
                    numericDelta > 0
                      ? 'bg-gold-100 text-gold-700'
                      : 'bg-terra-100 text-terra-700'
                  }`}
                >
                  {Math.abs(numericDelta)}
                </span>
              )}
            </span>
          </div>
        );
      })}
      {dup.seatIncoming !== dup.seatExisting && (
        <div className="grid bg-gold-50 px-3 py-1.5 text-xs" style={gridCols}>
          <span className="font-medium text-ink-600">رقم الجلوس</span>
          <span
            className={`font-en font-medium ${isReject ? 'text-ink-500' : 'text-ink-700 line-through'}`}
          >
            {dup.seatExisting.toLocaleString('en')}
          </span>
          <span
            className={`font-en font-bold ${isReject ? 'text-ink-400 line-through' : 'text-gold-700'}`}
          >
            {dup.seatIncoming.toLocaleString('en')}
          </span>
        </div>
      )}
    </div>
  );
}

/* ─── Step C — Result ─────────────────────────────────────────────────── */

interface ResultProps {
  result: CommittedImport | null;
  onClose: () => void;
  onImportAnother: () => void;
}

function ResultStep({ result, onClose, onImportAnother }: ResultProps): JSX.Element {
  const [openReasons, setOpenReasons] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setOpenReasons((s) => ({ ...s, [k]: !s[k] }));
  if (!result) {
    return (
      <Modal.Body>
        <div className="py-10 text-center text-ink-500">لا توجد نتيجة لعرضها.</div>
      </Modal.Body>
    );
  }
  return (
    <>
      <Modal.Body>
        <div className="flex flex-col gap-4">
          <div className="flex items-stretch overflow-hidden rounded-md border border-border-subtle">
            <ResultBlock
              value={result.inserted.toLocaleString('en')}
              label="صف مكتوب"
              sub="جديد + مقبول"
              tone="success"
              big
            />
            <ResultBlock
              value={result.replaced.toLocaleString('en')}
              label="صف مستبدل"
              sub="تكرارات مقبولة"
              tone="gold"
            />
            <ResultBlock
              value={result.kept.toLocaleString('en')}
              label="صف ثابت"
              sub="تكرارات مرفوضة"
              tone="ink"
            />
          </div>

          {result.deactivated.length > 0 && (
            <section className="overflow-hidden rounded-md border border-terra-300">
              <header className="flex items-center gap-2 border-b border-terra-300 bg-terra-50 px-3.5 py-2.5">
                <AlertTriangle size={14} className="text-terra-700" aria-hidden />
                <span className="text-xs font-bold text-terra-700">
                  <span className="font-en">{result.deactivated.length}</span> تعديل نشط تم إيقافه
                  تلقائياً
                </span>
                <span className="ms-auto text-2xs text-terra-700 opacity-85">
                  المجموع الجديد + التعديل يتجاوز الحد الأقصى
                </span>
              </header>
              <ul className="m-0 list-none bg-white p-0">
                {result.deactivated.map((d) => (
                  <li
                    key={d.nationalId}
                    className="flex items-center justify-between border-b border-border-subtle px-3.5 py-2.5 text-xs"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-ink-900">{d.name}</span>
                      <span dir="ltr" className="font-en text-2xs text-ink-500">
                        {d.nationalId}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span
                        className="rounded-full border border-terra-200 bg-terra-50 px-2 py-0.5 font-en text-2xs font-semibold text-terra-700"
                      >
                        {d.adjustmentSum >= 0 ? '+' : ''}
                        {d.adjustmentSum}
                      </span>
                      <Button size="sm" variant="ghost" leadingIcon={<History size={14} />}>
                        مراجعة
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result.skipped.length > 0 && (
            <section>
              <div className="mb-2 flex items-baseline gap-2">
                <h3 className="m-0 text-xs font-semibold text-ink-900">
                  صفوف مرفوضة قبل المراجعة
                </h3>
                <span className="text-2xs text-ink-500">
                  أخطاء في الملف — لم تصل لمرحلة المراجعة
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {result.skipped.map((s) => (
                  <ResultAccordion
                    key={s.reason}
                    reason={s.label}
                    code={s.reason}
                    count={s.count}
                    tone={s.tone}
                    open={!!openReasons[s.reason]}
                    onToggle={() => toggle(s.reason)}
                    rows={s.rows}
                  />
                ))}
              </div>
            </section>
          )}

          <div className="flex items-center gap-2 rounded-md border border-success bg-success-bg px-3 py-2.5 text-xs text-success">
            <Check size={14} aria-hidden />
            <span>تم تحديث الجدول. التعديلات الموجودة سابقاً تبقى مرتبطة بالطلاب.</span>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" leadingIcon={<Download size={14} />}>
          تنزيل ملخص الاستيراد
        </Button>
        <div className="ms-auto flex gap-2">
          <Button variant="secondary" onClick={onImportAnother}>
            استيراد ملف آخر
          </Button>
          <Button variant="primary" onClick={onClose}>
            عرض الجدول
          </Button>
        </div>
      </Modal.Footer>
    </>
  );
}

function ResultBlock({
  value,
  label,
  sub,
  tone,
  big,
}: {
  value: string;
  label: string;
  sub: string;
  tone: 'success' | 'gold' | 'ink';
  big?: boolean;
}): JSX.Element {
  const cls = {
    success: 'bg-success-bg text-success',
    gold: 'bg-gold-50 text-gold-700',
    ink: 'bg-white text-ink-700',
  }[tone];
  return (
    <div
      className={`flex flex-col gap-0.5 border-s border-border-subtle px-4 py-3.5 first:border-s-0 ${cls}`}
      style={{ flex: big ? 1.5 : 1 }}
    >
      <span
        className={`font-ar-display font-en font-bold leading-tight ${big ? 'text-3xl' : 'text-2xl'}`}
      >
        {value}
      </span>
      <span className="text-xs opacity-85">{label}</span>
      {sub && <span className="mt-0.5 text-2xs text-ink-500">{sub}</span>}
    </div>
  );
}

function ResultAccordion({
  reason,
  code,
  count,
  tone,
  rows,
  open,
  onToggle,
}: {
  reason: string;
  code: string;
  count: number;
  tone: 'terra' | 'warning';
  rows: { row: number; detail: string }[];
  open: boolean;
  onToggle: () => void;
}): JSX.Element {
  const cls =
    tone === 'terra'
      ? { wrap: 'border-terra-300 bg-terra-50', text: 'text-terra-700', listBorder: 'border-terra-300' }
      : { wrap: 'border-gold-300 bg-gold-50', text: 'text-gold-700', listBorder: 'border-gold-300' };
  return (
    <div className={`overflow-hidden rounded-md border ${cls.wrap}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center justify-between border-0 bg-transparent px-3.5 py-2 text-start"
      >
        <div className="flex items-center gap-2.5">
          <span
            className={`transition-transform ${open ? 'rotate-0' : '-rotate-90'}`}
          >
            <ChevronDown size={10} aria-hidden className={cls.text} />
          </span>
          <AlertTriangle size={14} aria-hidden className={cls.text} />
          <span className={`text-xs font-semibold ${cls.text}`}>{reason}</span>
          <code className="font-mono text-2xs text-ink-500">{code}</code>
        </div>
        <span
          className={`rounded-full bg-white px-2.5 py-0.5 font-en text-2xs font-semibold ${cls.text}`}
        >
          {count} صف
        </span>
      </button>
      {open && rows.length > 0 && (
        <ul
          className={`m-0 flex flex-col gap-1 border-t bg-white px-9 py-2 text-2xs text-ink-700 ${cls.listBorder}`}
        >
          {rows.map((r) => (
            <li key={r.row}>
              <span className="me-1 inline-block min-w-9 font-en text-2xs font-semibold text-ink-500">
                #{r.row}
              </span>
              {r.detail}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─── Error step (missing required columns) ───────────────────────────── */

const REQUIRED_COLUMNS: Record<'general' | 'azhar', readonly string[]> = {
  general: [
    'seating_no',
    'national_no',
    'arabic_name',
    'school_name',
    'moderia_name',
    'branch_desc_new',
    'total_degree',
    'student_case_desc',
  ],
  azhar: [
    'StSeatNo',
    'StudenName',
    'DevisionName',
    'National_Code',
    'ZonName',
    'InstituteName',
    'Total2',
  ],
};

function ErrorStep({
  missing,
  kind,
  onBack,
  onCancel,
}: {
  missing: readonly string[];
  kind: 'general' | 'azhar';
  onBack: () => void;
  onCancel: () => void;
}): JSX.Element {
  const required = REQUIRED_COLUMNS[kind];
  const missingSet = new Set(missing);
  const allCols: Array<[string, 'ok' | 'missing']> = required.map((col) => [
    col,
    missingSet.has(col) ? 'missing' : 'ok',
  ]);
  const presentCount = allCols.filter(([, s]) => s === 'ok').length;
  const kindLabel = kind === 'general' ? 'ثانوية عامة' : 'ثانوية أزهرية';
  return (
    <>
      <Modal.Body>
        <div className="flex flex-col gap-4">
          <div className="rounded-md border border-terra-500 border-s-[3px] border-s-terra-500 bg-terra-50 p-3.5">
            <div className="mb-1.5 flex items-center gap-2">
              <AlertTriangle size={14} className="text-terra-700" aria-hidden />
              <span className="text-sm font-bold text-terra-700">
                أعمدة مطلوبة مفقودة في الملف
              </span>
              <code className="ms-auto font-mono text-2xs text-terra-700 opacity-80">
                MISSING_REQUIRED_COLUMN
              </code>
            </div>
            <p className="m-0 text-xs leading-relaxed text-terra-700">
              الملف لا يحتوي على الأعمدة التالية. يجب أن يطابق الملف أسماء الأعمدة بالحرف نفسه
              (case-sensitive).
            </p>
            <ul className="m-0 mt-2.5 flex list-none flex-wrap gap-1.5 p-0 font-mono">
              {missing.map((c) => (
                <li
                  key={c}
                  className="rounded-full border border-terra-300 bg-white px-2.5 py-0.5 text-2xs font-semibold text-terra-700"
                >
                  {c}
                </li>
              ))}
            </ul>
          </div>

          <section className="overflow-hidden rounded-md border border-border-subtle">
            <header className="flex items-center justify-between border-b border-border-subtle bg-ink-50 px-3 py-2 text-2xs font-semibold text-ink-700">
              <span>مقارنة الأعمدة — {kindLabel}</span>
              <span className="rounded-full border border-terra-300 bg-white px-2 font-en text-2xs font-semibold text-terra-700">
                {presentCount} / {allCols.length}
              </span>
            </header>
            <div className="grid grid-cols-4 font-mono text-2xs">
              {allCols.map(([col, state]) => (
                <span
                  key={col}
                  dir="ltr"
                  className={`flex items-center gap-1.5 border-e border-b border-border-subtle px-2.5 py-1.5 ${
                    state === 'missing' ? 'bg-terra-50 text-terra-700' : 'bg-white text-ink-700'
                  }`}
                >
                  {state === 'missing' ? (
                    <X size={14} className="shrink-0 text-terra-500" aria-hidden />
                  ) : (
                    <Check size={14} className="shrink-0 text-success" aria-hidden />
                  )}
                  {col}
                </span>
              ))}
            </div>
          </section>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" leadingIcon={<Download size={14} />}>
          تنزيل القالب الصحيح
        </Button>
        <div className="ms-auto flex gap-2">
          <Button variant="secondary" onClick={onCancel}>
            إلغاء
          </Button>
          <Button variant="primary" leadingIcon={<ChevronRight size={14} />} onClick={onBack}>
            العودة للإعدادات
          </Button>
        </div>
      </Modal.Footer>
    </>
  );
}
