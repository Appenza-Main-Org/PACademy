/**
 * ImportWizard — 3-step modal for bulk Excel import of bank questions.
 *
 * 1. Download template (xlsx)
 * 2. Upload + parse + per-row validation preview
 * 3. Confirm + import → batch service call → invalidates query cache
 *
 * Imported rows land as `draft` per RFP §9.A (same lifecycle as a manually
 * created question — chief approval before publishing).
 */

import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileUp,
  Sparkles,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import { Badge, Button, Modal, toast } from '@/shared/components';
import { num } from '@/shared/lib/format';
import { downloadBlob } from '@/shared/lib/download';
import { useImportQuestionsMutation } from '../api/exams.queries';
import {
  ALLOWED_CATEGORIES,
  MAX_IMPORT_ROWS,
  buildValidationCsv,
  downloadTemplate,
  parseImportFile,
  rowsToDrafts,
  summarize,
  validateSheet,
} from '../lib/import-questions';
import type { ImportRow, ImportSummary } from '../lib/import-questions';
import { ImportPreviewTable } from './ImportPreviewTable';

type Step = 1 | 2 | 3;

interface ImportWizardProps {
  open: boolean;
  onClose: () => void;
}

const STEP_LABELS: Record<Step, string> = {
  1: 'تنزيل القالب',
  2: 'الرفع والمعاينة',
  3: 'التأكيد والاستيراد',
};

export function ImportWizard({ open, onClose }: ImportWizardProps): JSX.Element {
  const [step, setStep] = useState<Step>(1);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const importMutation = useImportQuestionsMutation();

  const summary: ImportSummary = useMemo(() => summarize(rows), [rows]);

  const reset = (): void => {
    setStep(1);
    setRows([]);
    setFileName(null);
    setParseError(null);
    setParsing(false);
  };

  const handleClose = (): void => {
    if (importMutation.isPending) return;
    reset();
    onClose();
  };

  const handleDownloadTemplate = (): void => {
    try {
      downloadTemplate();
      toast('تم تنزيل قالب الأسئلة', 'success');
    } catch {
      toast('تعذّر تنزيل القالب', 'danger');
    }
  };

  const ingestFile = async (file: File): Promise<void> => {
    setParseError(null);
    setParsing(true);
    setFileName(file.name);
    try {
      const matrix = await parseImportFile(file);
      const validated = validateSheet(matrix);
      if (validated.length === 0) {
        setParseError('الملف فارغ أو لا يحتوي على صفوف صالحة.');
        setRows([]);
        return;
      }
      setRows(validated);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'تعذّر قراءة الملف';
      setParseError(message);
      setRows([]);
    } finally {
      setParsing(false);
    }
  };

  const handleFileSelect = (file: File | undefined): void => {
    if (!file) return;
    void ingestFile(file);
  };

  const handleDownloadReport = (): void => {
    if (rows.length === 0) return;
    const csv = buildValidationCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, 'import-validation-report.csv');
  };

  const handleImport = (): void => {
    const drafts = rowsToDrafts(rows);
    if (drafts.length === 0) {
      toast('لا توجد صفوف صالحة للاستيراد', 'warning');
      return;
    }
    importMutation.mutate(drafts, {
      onSuccess: (res) => {
        toast(`تم استيراد ${num(res.created)} سؤال كمسوّدات`, 'success');
        reset();
        onClose();
      },
      onError: (err) => {
        toast(err instanceof Error ? err.message : 'فشل الاستيراد', 'danger');
      },
    });
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="lg"
      title="استيراد أسئلة من Excel"
      subtitle="حمِّل القالب، ارفع الأسئلة، ثم راجع وأكِّد قبل الإضافة لبنك الأسئلة."
      withFlourishes={false}
      transparentBackdrop={false}
      closeOnBackdrop={!importMutation.isPending}
    >
      <Modal.Body>
        <Stepper step={step} />
        {step === 1 && (
          <Step1Download onDownload={handleDownloadTemplate} onNext={() => setStep(2)} />
        )}
        {step === 2 && (
          <Step2Upload
            fileName={fileName}
            parsing={parsing}
            parseError={parseError}
            rows={rows}
            summary={summary}
            dragOver={dragOver}
            onPick={() => inputRef.current?.click()}
            onDragEnter={() => setDragOver(true)}
            onDragLeave={() => setDragOver(false)}
            onDrop={(file) => {
              setDragOver(false);
              handleFileSelect(file);
            }}
            onDownloadReport={handleDownloadReport}
            onReset={reset}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <Step3Confirm summary={summary} />
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="sr-only"
          onChange={(e) => handleFileSelect(e.target.files?.[0] ?? undefined)}
        />
      </Modal.Body>
      <Modal.Footer>
        <Button type="button" variant="ghost" onClick={handleClose} disabled={importMutation.isPending}>
          إلغاء
        </Button>
        {step > 1 && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setStep((s) => (Math.max(1, s - 1) as Step))}
            disabled={importMutation.isPending}
          >
            السابق
          </Button>
        )}
        {step === 1 && (
          <Button
            type="button"
            variant="primary"
            trailingIcon={<UploadCloud size={14} strokeWidth={1.75} />}
            onClick={() => setStep(2)}
          >
            انتقل للرفع
          </Button>
        )}
        {step === 2 && (
          <Button
            type="button"
            variant="primary"
            trailingIcon={<Sparkles size={14} strokeWidth={1.75} />}
            onClick={() => setStep(3)}
            disabled={rows.length === 0 || summary.valid === 0}
          >
            متابعة
          </Button>
        )}
        {step === 3 && (
          <Button
            type="button"
            variant="primary"
            isLoading={importMutation.isPending}
            loadingLabel="جارٍ الاستيراد…"
            onClick={handleImport}
            disabled={summary.valid === 0}
          >
            استيراد {num(summary.valid)} سؤال
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}

/* ─────────── Internals ─────────── */

function Stepper({ step }: { step: Step }): JSX.Element {
  const steps: Step[] = [1, 2, 3];
  return (
    <ol className="mb-6 flex items-center gap-2">
      {steps.map((s, i) => {
        const state: 'complete' | 'current' | 'upcoming' =
          s < step ? 'complete' : s === step ? 'current' : 'upcoming';
        return (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-2xs font-bold"
              style={
                state === 'current'
                  ? { background: 'var(--accent-500)', color: '#fff' }
                  : state === 'complete'
                    ? { background: 'var(--accent-50)', color: 'var(--accent-700)' }
                    : { background: 'var(--ink-100)', color: 'var(--ink-500)' }
              }
            >
              {state === 'complete' ? <CheckCircle2 size={14} strokeWidth={2} /> : s}
            </span>
            <span
              className="text-xs"
              style={{
                color: state === 'upcoming' ? 'var(--ink-500)' : 'var(--ink-900)',
                fontWeight: state === 'current' ? 600 : 500,
              }}
            >
              {STEP_LABELS[s]}
            </span>
            {i < steps.length - 1 && (
              <span aria-hidden className="h-px flex-1" style={{ background: 'var(--border-subtle)' }} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Step1Download({ onDownload, onNext }: { onDownload: () => void; onNext: () => void }): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex items-start gap-4 rounded-md border p-4"
        style={{ borderColor: 'var(--accent-500)', background: 'var(--accent-50)' }}
      >
        <span
          aria-hidden
          className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md"
          style={{ background: 'var(--accent-500)', color: '#fff' }}
        >
          <Download size={18} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-ink-900">قالب رفع الأسئلة (Excel)</h3>
          <p className="mt-1 text-2xs text-ink-700">
            يحتوي القالب على الأعمدة المطلوبة وصف مثال لتسهيل التعبئة.
          </p>
          <Button
            variant="accent"
            size="sm"
            className="mt-2"
            leadingIcon={<Download size={14} strokeWidth={1.75} />}
            onClick={onDownload}
          >
            تحميل قالب Excel
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-border-subtle bg-surface-card p-4">
        <h4 className="text-2xs font-bold uppercase tracking-wide text-ink-500">قبل الرفع — تحقّق من النقاط التالية</h4>
        <ul className="mt-2 grid gap-x-4 gap-y-1.5 text-2xs text-ink-700 sm:grid-cols-2">
          <Bullet>
            الفئات: {ALLOWED_CATEGORIES.map((c) => `«${c}»`).join('، ')}.
          </Bullet>
          <Bullet>
            الصعوبة <span dir="ltr" className="font-numeric tnum">1</span>–<span dir="ltr" className="font-numeric tnum">5</span>.
          </Bullet>
          <Bullet>
            نص السؤال ≤ <span dir="ltr" className="font-numeric tnum">500</span> حرف.
          </Bullet>
          <Bullet>
            كل إجابة ≤ <span dir="ltr" className="font-numeric tnum">200</span> حرف.
          </Bullet>
          <Bullet>
            رقم الإجابة الصحيحة <span dir="ltr" className="font-numeric tnum">1</span>–<span dir="ltr" className="font-numeric tnum">4</span>.
          </Bullet>
          <Bullet>
            <span dir="ltr">UTF-8</span> · حتى <span dir="ltr" className="font-numeric tnum">{num(MAX_IMPORT_ROWS)}</span> صف.
          </Bullet>
        </ul>
        <div
          className="mt-3 flex items-start gap-2 rounded-md border border-dashed p-2 text-2xs"
          style={{ borderColor: 'var(--gold-300)', background: 'var(--gold-50)', color: 'var(--gold-700)' }}
        >
          <AlertTriangle size={12} strokeWidth={1.75} className="mt-0.5 flex-shrink-0" aria-hidden />
          <p>تُحفظ الصفوف كـ <strong>مسودّات</strong> ولا تظهر للمتقدمين قبل اعتمادها.</p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          variant="primary"
          trailingIcon={<UploadCloud size={14} strokeWidth={1.75} />}
          onClick={onNext}
        >
          انتقل للرفع
        </Button>
      </div>
    </div>
  );
}

function Step2Upload(props: {
  fileName: string | null;
  parsing: boolean;
  parseError: string | null;
  rows: readonly ImportRow[];
  summary: ImportSummary;
  dragOver: boolean;
  onPick: () => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDrop: (file: File | undefined) => void;
  onDownloadReport: () => void;
  onReset: () => void;
  onBack: () => void;
  onNext: () => void;
}): JSX.Element {
  const { fileName, parsing, parseError, rows, summary, dragOver, onPick, onDragEnter, onDragLeave, onDrop, onDownloadReport, onReset, onBack, onNext } = props;
  const canContinue = rows.length > 0 && summary.valid > 0;

  return (
    <div className="flex flex-col gap-5">
      <div
        role="button"
        tabIndex={0}
        onClick={onPick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(); } }}
        onDragOver={(e) => { e.preventDefault(); }}
        onDragEnter={(e) => { e.preventDefault(); onDragEnter(); }}
        onDragLeave={onDragLeave}
        onDrop={(e) => { e.preventDefault(); onDrop(e.dataTransfer.files?.[0]); }}
        className="flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-8 text-center transition-colors duration-fast ease-standard focus-visible:outline-none"
        style={{
          borderColor: dragOver ? 'var(--accent-500)' : 'var(--border-strong)',
          background: dragOver ? 'var(--accent-50)' : 'var(--surface-card)',
          cursor: 'pointer',
        }}
        aria-label="رفع ملف الأسئلة"
      >
        <span
          aria-hidden
          className="inline-flex h-10 w-10 items-center justify-center rounded-md"
          style={{ background: 'var(--accent-50)', color: 'var(--accent-700)' }}
        >
          <FileUp size={20} strokeWidth={1.75} />
        </span>
        <p className="text-sm font-medium text-ink-900">اسحب ملف Excel هنا أو انقر للاختيار</p>
        <p className="text-2xs text-ink-500">الصيغ المدعومة: <span dir="ltr">.xlsx · .xls · .csv</span></p>
        {fileName && !parsing && (
          <p className="mt-2 text-2xs text-ink-700">
            الملف الحالي: <span className="font-medium" dir="ltr">{fileName}</span>
          </p>
        )}
      </div>

      {parsing && <p className="text-sm text-ink-500">جاري قراءة الملف…</p>}

      {parseError && (
        <div
          className="flex items-start gap-2 rounded-md border p-3 text-sm"
          style={{ borderColor: 'var(--terra-300)', background: 'var(--terra-50)', color: 'var(--terra-700)' }}
        >
          <XCircle size={14} strokeWidth={2} className="mt-0.5 flex-shrink-0" aria-hidden />
          <span>{parseError}</span>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <SummaryStrip summary={summary} />
          {summary.errors > 0 && (
            <p className="text-2xs text-terra-700">
              يجب تصحيح صفوف الخطأ في الملف الأصلي وإعادة الرفع. التحذيرات يمكن استيرادها كما هي.
            </p>
          )}
          <ImportPreviewTable rows={rows} />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<Download size={14} strokeWidth={1.75} />}
              onClick={onDownloadReport}
            >
              تنزيل تقرير التحقق (CSV)
            </Button>
            <Button variant="ghost" size="sm" onClick={onReset}>
              مسح وإعادة الرفع
            </Button>
          </div>
        </>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <Button variant="secondary" size="sm" onClick={onBack}>
          ← السابق
        </Button>
        <Button
          variant="primary"
          size="sm"
          trailingIcon={<Sparkles size={14} strokeWidth={1.75} />}
          onClick={onNext}
          disabled={!canContinue}
        >
          متابعة
        </Button>
      </div>
    </div>
  );
}

function Step3Confirm({ summary }: { summary: ImportSummary }): JSX.Element {
  const categoryEntries = Object.entries(summary.perCategory);
  return (
    <div className="flex flex-col gap-5">
      <div
        className="rounded-md border p-5"
        style={{ borderColor: 'var(--accent-500)', background: 'var(--accent-50)' }}
      >
        <h3 className="text-md font-bold text-ink-900">جاهز للاستيراد</h3>
        <p className="mt-1 text-sm text-ink-700">
          سيتم إضافة <span className="font-numeric tnum font-bold">{num(summary.valid)}</span> سؤال إلى بنك الأسئلة كمسودّات.
        </p>
        {summary.warnings > 0 && (
          <p className="mt-2 text-2xs text-gold-700">
            من بينها <span dir="ltr" className="font-numeric tnum font-medium">{num(summary.warnings)}</span> صفوف بتحذيرات يمكن مراجعتها بعد الاستيراد.
          </p>
        )}
      </div>

      <div className="rounded-md border border-border-subtle bg-surface-card p-5">
        <h4 className="text-sm font-bold text-ink-900">التوزيع حسب الفئة</h4>
        {categoryEntries.length === 0 ? (
          <p className="mt-3 text-2xs text-ink-500">لا توجد صفوف صالحة.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {categoryEntries.map(([cat, count]) => (
              <li key={cat} className="flex items-center justify-between gap-3">
                <span className="text-ink-700">{cat}</span>
                <Badge tone="neutral">
                  <span className="font-numeric tnum">{num(count)}</span> سؤال
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div
        className="flex items-start gap-2 rounded-md border border-dashed p-3 text-2xs"
        style={{ borderColor: 'var(--gold-300)', background: 'var(--gold-50)', color: 'var(--gold-700)' }}
      >
        <AlertTriangle size={13} strokeWidth={1.75} className="mt-0.5 flex-shrink-0" aria-hidden />
        <p>
          ستظهر الأسئلة المُستوردة في تبويب «مسودّات» مع شارة «قيد المراجعة» حتى يعتمدها رئيس الاختبارات.
        </p>
      </div>
    </div>
  );
}

function SummaryStrip({ summary }: { summary: ImportSummary }): JSX.Element {
  const cells: { label: string; value: number; tone: 'neutral' | 'success' | 'warning' | 'danger' }[] = [
    { label: 'إجمالي الصفوف', value: summary.total, tone: 'neutral' },
    { label: 'صالح', value: summary.valid - summary.warnings, tone: 'success' },
    { label: 'تحذيرات', value: summary.warnings, tone: 'warning' },
    { label: 'أخطاء', value: summary.errors, tone: 'danger' },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {cells.map((c) => (
        <div
          key={c.label}
          className="rounded-md border border-border-subtle bg-surface-card px-3 py-2"
        >
          <p className="text-2xs text-ink-500">{c.label}</p>
          <p
            className="mt-1 font-numeric tnum text-lg font-bold"
            style={{
              color:
                c.tone === 'success' ? 'var(--success)'
                  : c.tone === 'warning' ? 'var(--gold-700)'
                    : c.tone === 'danger' ? 'var(--terra-700)'
                      : 'var(--ink-900)',
            }}
          >
            {num(c.value)}
          </p>
        </div>
      ))}
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <li className="flex items-start gap-2">
      <span aria-hidden className="mt-1.5 inline-block h-1 w-1 flex-shrink-0 rounded-full" style={{ background: 'var(--accent-500)' }} />
      <span>{children}</span>
    </li>
  );
}
