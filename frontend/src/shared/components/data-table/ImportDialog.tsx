/**
 * ImportDialog — three-step (file → preview → commit) import flow used by
 * every list page that opts into `ImportConfig`. Built on the `Modal`
 * primitive; relies on the `FileUpload` primitive for the picker.
 *
 * Step UI:
 *   1. اختر الملف   — drag-drop + parse → preview rows
 *   2. مراجعة       — `ImportPreviewTable` showing per-row validation
 *   3. حفظ          — running commit, then success summary + error report
 *
 * Audit: emits `entity_imported` on commit with `attempted/success/failed`.
 */

import { useEffect, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import type { ZodSchema } from 'zod';
import { Button, FileUpload, Modal, toast } from '@/shared/components';
import type { UploadFile } from '@/shared/components';
import { downloadBlob } from '@/shared/lib/download';
import { emitAudit } from '@/shared/lib/audit';
import { parseCsv, serializeCsv } from '@/shared/lib/csv';
import { parseXlsx } from '@/shared/lib/xlsx';
import type { AuditModule } from '@/shared/types/domain';
import type {
  ImportConfig,
  ImportPreviewRow,
  ImportResult,
} from './list-actions.types';
import { ImportPreviewTable } from './ImportPreviewTable';

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  config: ImportConfig<unknown>;
  entityKey: string;
  entityLabelAr: string;
  auditModule: AuditModule;
  /** Optional callback fired after a successful commit so the host page can
   *  refetch its query. */
  onSuccess?: (result: ImportResult) => void;
}

type Step = 'pick' | 'review' | 'committing' | 'done';

interface ParsedState {
  headers: readonly string[];
  rows: readonly ImportPreviewRow[];
}

export function ImportDialog({
  open,
  onClose,
  config,
  entityKey,
  entityLabelAr,
  auditModule,
  onSuccess,
}: ImportDialogProps): JSX.Element {
  const [step, setStep] = useState<Step>('pick');
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [parsed, setParsed] = useState<ParsedState | null>(null);
  const [parseBusy, setParseBusy] = useState(false);
  const [commitOnlyValid, setCommitOnlyValid] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);

  /* Reset state every time the dialog re-opens. */
  useEffect(() => {
    if (open) {
      setStep('pick');
      setFiles([]);
      setParsed(null);
      setCommitOnlyValid(true);
      setResult(null);
    }
  }, [open]);

  const successCount = (parsed?.rows ?? []).filter((r) => r.errors.length === 0).length;
  const failedCount = (parsed?.rows ?? []).filter((r) => r.errors.length > 0).length;

  const handleFileChange = async (next: UploadFile[]): Promise<void> => {
    setFiles(next);
    const file = next[0]?.file;
    if (!file) {
      setParsed(null);
      return;
    }
    setParseBusy(true);
    try {
      const isXlsx = /\.xlsx?$/i.test(file.name);
      const parsedResult = isXlsx ? await parseXlsx(file) : parseCsv(await file.text());
      const previewRows: ImportPreviewRow[] = parsedResult.rows.map((source, rowIndex) => {
        const errors: string[] = [];
        const parseError = parsedResult.parseErrors.find((p) => p.rowIndex === rowIndex);
        if (parseError) errors.push(parseError.message);
        const mapped = config.mapRow ? config.mapRow(source) : source;
        const validation = (config.schema).safeParse(mapped);
        if (!validation.success) {
          for (const issue of validation.error.errors) {
            const path = issue.path.length > 0 ? issue.path.join('.') : '';
            errors.push(path ? `${path}: ${issue.message}` : issue.message);
          }
        }
        return {
          rowIndex,
          source,
          parsed: validation.success ? validation.data : undefined,
          errors,
        };
      });
      setParsed({ headers: parsedResult.headers, rows: previewRows });
      setStep('review');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذّر قراءة الملف.';
      toast(msg, 'danger');
      setParsed(null);
    } finally {
      setParseBusy(false);
    }
  };

  const handleCommit = async (): Promise<void> => {
    if (!parsed) return;
    const toCommit = parsed.rows
      .filter((r) => (commitOnlyValid ? r.errors.length === 0 : true))
      .map((r) => r.parsed)
      .filter((v): v is unknown => v !== undefined);
    if (toCommit.length === 0) {
      toast('لا توجد صفوف صالحة للاستيراد.', 'warning');
      return;
    }
    setStep('committing');
    try {
      const commitResult = await config.onCommit(toCommit);
      setResult(commitResult);
      emitAudit({
        action: 'entity_imported',
        module: auditModule,
        entityType: entityKey,
        entityLabel: entityLabelAr,
        entityId: `IMPORT-${Date.now()}`,
        details: `استيراد ${entityLabelAr}: ${commitResult.successCount} ناجح، ${commitResult.failedRows.length} فشل من إجمالي ${commitResult.attemptedCount}.`,
        after: {
          attempted: commitResult.attemptedCount,
          success: commitResult.successCount,
          failed: commitResult.failedRows.length,
        },
      });
      setStep('done');
      onSuccess?.(commitResult);
      if (commitResult.failedRows.length === 0) {
        toast(`تم استيراد ${commitResult.successCount} سجل بنجاح.`, 'success');
      } else {
        toast(
          `استيراد جزئي: ${commitResult.successCount} نجاح · ${commitResult.failedRows.length} فشل.`,
          'warning',
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذّر تنفيذ الاستيراد.';
      toast(msg, 'danger');
      setStep('review');
    }
  };

  const downloadErrorReport = (): void => {
    if (!parsed) return;
    const errorRows = parsed.rows.filter((r) => r.errors.length > 0);
    if (errorRows.length === 0) return;
    const headers = [...parsed.headers, 'errors'];
    const body = errorRows.map((r) => [
      ...parsed.headers.map((h) => r.source[h] ?? ''),
      r.errors.join(' · '),
    ]);
    const csv = serializeCsv(headers, body);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, `import-errors-${entityKey}-${Date.now()}.csv`);
  };

  const downloadTemplate = (): void => {
    if (!config.templateColumns) return;
    const headers = config.templateColumns.map((c) => c.labelAr);
    const sample = config.templateColumns.map((c) => c.sample ?? '');
    const csv = serializeCsv(headers, [sample]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, `${entityKey}-template.csv`);
  };

  const acceptAttr = (() => {
    const exts: string[] = [];
    if (config.formats.includes('csv')) exts.push('.csv', 'text/csv');
    if (config.formats.includes('xlsx')) {
      exts.push(
        '.xlsx',
        '.xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      );
    }
    return exts.join(',');
  })();

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      transparentBackdrop={false}
      title={`استيراد ${entityLabelAr}`}
      subtitle={`خطوة ${step === 'pick' ? '١' : step === 'review' ? '٢' : '٣'} من ٣`}
    >
      <Modal.Body className="flex flex-col gap-4">
        <StepIndicator step={step} />

        {step === 'pick' && (
          <div className="flex flex-col gap-3">
            <FileUpload
              accept={acceptAttr}
              files={files}
              onFilesChange={handleFileChange}
              title="اسحب ملف CSV أو XLSX هنا"
              helper={
                parseBusy
                  ? 'جارٍ قراءة الملف…'
                  : 'الصف الأول يجب أن يكون عناوين الأعمدة. الأعمدة المطلوبة موضّحة في قالب التحميل.'
              }
              disabled={parseBusy}
            />
            {config.templateColumns && config.templateColumns.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={downloadTemplate}
                leadingIcon={<Download size={14} strokeWidth={1.75} />}
              >
                تنزيل قالب الأعمدة
              </Button>
            )}
          </div>
        )}

        {step === 'review' && parsed && (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1 rounded-md bg-success-bg px-2 py-1 text-success">
                <span className="font-numeric tnum">{successCount}</span> صالح
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-terra-50 px-2 py-1 text-terra-700">
                <span className="font-numeric tnum">{failedCount}</span> فشل
              </span>
              {failedCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={downloadErrorReport}
                  leadingIcon={<Download size={14} strokeWidth={1.75} />}
                >
                  تنزيل تقرير الأخطاء
                </Button>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <ImportPreviewTable rows={parsed.rows} headerLabels={parsed.headers} />
            </div>
            {failedCount > 0 && (
              <label className="flex items-center gap-2 rounded-md border border-dashed border-gold-300 bg-gold-50 px-3 py-2 text-2xs text-gold-700">
                <input
                  type="checkbox"
                  checked={commitOnlyValid}
                  onChange={(e) => setCommitOnlyValid(e.target.checked)}
                  className="accent-teal-500"
                />
                استيراد الصفوف الصالحة فقط ({successCount}) وتجاهل الأخطاء.
              </label>
            )}
          </div>
        )}

        {step === 'committing' && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-ink-500">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-ink-200 border-t-teal-500" />
            <p className="text-sm">جارٍ تنفيذ الاستيراد…</p>
          </div>
        )}

        {step === 'done' && result && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-700">
              تم تنفيذ الاستيراد. <span className="font-numeric tnum">{result.successCount}</span> سجل
              تم إضافته بنجاح من إجمالي{' '}
              <span className="font-numeric tnum">{result.attemptedCount}</span>.
            </p>
            {result.failedRows.length > 0 && (
              <div className="rounded-md border border-terra-300 bg-terra-50 p-3">
                <p className="text-2xs font-medium text-terra-700">
                  فشل <span className="font-numeric tnum">{result.failedRows.length}</span> صف:
                </p>
                <ul className="mt-1 list-disc ps-4 text-2xs text-terra-700">
                  {result.failedRows.slice(0, 5).map((r) => (
                    <li key={r.rowIndex}>
                      الصف <span className="font-numeric tnum">{r.rowIndex + 1}</span>:{' '}
                      {r.errors.join(' · ')}
                    </li>
                  ))}
                  {result.failedRows.length > 5 && (
                    <li>… و {result.failedRows.length - 5} صفوف أخرى.</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        {step === 'pick' && (
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
        )}
        {step === 'review' && (
          <>
            <Button variant="ghost" onClick={() => setStep('pick')}>
              العودة
            </Button>
            <Button variant="ghost" onClick={onClose}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              leadingIcon={<Upload size={14} strokeWidth={1.75} />}
              onClick={handleCommit}
              disabled={successCount === 0}
            >
              تأكيد الاستيراد
            </Button>
          </>
        )}
        {step === 'committing' && (
          <Button variant="ghost" disabled>
            جارٍ المعالجة…
          </Button>
        )}
        {step === 'done' && (
          <Button variant="primary" onClick={onClose}>
            تم
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}

function StepIndicator({ step }: { step: Step }): JSX.Element {
  const steps: { key: Step; label: string }[] = [
    { key: 'pick', label: '١. اختر الملف' },
    { key: 'review', label: '٢. مراجعة' },
    { key: 'done', label: '٣. حفظ' },
  ];
  const currentIndex = step === 'committing' ? 2 : steps.findIndex((s) => s.key === step);
  return (
    <ol className="flex items-center gap-2 text-2xs text-ink-500">
      {steps.map((s, i) => {
        const isActive = i === currentIndex;
        const isDone = i < currentIndex;
        return (
          <li key={s.key} className="flex items-center gap-2">
            <span
              className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 ${
                isActive
                  ? 'bg-teal-500 text-white'
                  : isDone
                    ? 'bg-success-bg text-success'
                    : 'bg-ink-50 text-ink-500'
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && <span aria-hidden className="h-px w-4 bg-border-subtle" />}
          </li>
        );
      })}
    </ol>
  );
}
