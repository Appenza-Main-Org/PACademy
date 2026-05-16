/**
 * Step 2 — اختيار الجدول / الورقة.
 *
 * Runs `parseGradesFile` against the picked File the first time the step
 * is mounted (or the file changes), then renders a RadioGroup of every
 * detected table/sheet. CSV files auto-advance because they only ever
 * have one synthetic table.
 *
 * Errors bubble through the shared `ErrorState` with a retry button that
 * reruns the parser.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Sheet as SheetIcon } from 'lucide-react';
import { ErrorState } from '@/shared/components';
import { useImportWizardStore } from '../../../store/importWizard.store';
import { parseGradesFile, type ParsedSheet } from '../../../lib/parseGradesFile';
import { autoMapColumns } from '../../../lib/targetFields';

interface Step2Props {
  /** When the parser resolves and we have ≥1 table, the wizard caller
   *  can read `parsed`/`selectedTableName` from the store and advance. */
  onAutoAdvance?: () => void;
}

export function Step2TableSelect({ onAutoAdvance }: Step2Props): JSX.Element {
  const file = useImportWizardStore((s) => s.file);
  const parsed = useImportWizardStore((s) => s.parsed);
  const setParsed = useImportWizardStore((s) => s.setParsed);
  const selectedTableName = useImportWizardStore((s) => s.selectedTableName);
  const setSelectedTableName = useImportWizardStore((s) => s.setSelectedTableName);
  const setMapping = useImportWizardStore((s) => s.setMapping);

  const [status, setStatus] = useState<'idle' | 'parsing' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const lastParsedFileRef = useRef<File | null>(null);

  const runParse = useCallback(
    async (f: File): Promise<void> => {
      setStatus('parsing');
      setError(null);
      try {
        const result: ParsedSheet = await parseGradesFile(f);
        setParsed(result);
        lastParsedFileRef.current = f;
        /* If exactly one table → auto-pick and fast-forward. */
        if (result.tables.length === 1) {
          const only = result.tables[0]!;
          setSelectedTableName(only.name);
          setMapping(autoMapColumns(only.columns));
          onAutoAdvance?.();
        }
        setStatus('idle');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'تعذّر قراءة الملف.');
        setStatus('error');
      }
    },
    [setParsed, setSelectedTableName, setMapping, onAutoAdvance],
  );

  useEffect(() => {
    if (!file) return;
    /* Only re-parse when the file actually changes — avoid re-parsing
     * across step navigations. */
    if (lastParsedFileRef.current === file && parsed) return;
    void runParse(file);
  }, [file, parsed, runParse]);

  if (!file) {
    return (
      <ErrorState
        title="لم يتم اختيار ملف"
        description="عد إلى الخطوة السابقة واختر ملف البيانات أولاً."
        icon={<AlertTriangle size={24} strokeWidth={1.5} aria-hidden />}
      />
    );
  }

  if (status === 'parsing') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-border-subtle bg-white py-12 text-sm text-ink-500">
        <SheetIcon size={20} className="animate-pulse text-teal-500" aria-hidden />
        جارٍ قراءة الملف…
      </div>
    );
  }

  if (status === 'error') {
    return (
      <ErrorState
        title="تعذّر قراءة الملف"
        description={error ?? 'تأكد من سلامة الملف ثم أعد المحاولة.'}
        icon={<AlertTriangle size={24} strokeWidth={1.5} aria-hidden />}
        onRetry={() => void runParse(file)}
      />
    );
  }

  if (!parsed) {
    return <div className="py-12 text-center text-sm text-ink-500">جارٍ التحضير…</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-border-subtle bg-white p-3.5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md border border-teal-200 bg-teal-50 text-teal-700">
            <SheetIcon size={14} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold text-ink-900">
              {parsed.sourceName}
            </div>
            <div className="text-2xs uppercase text-ink-500">
              <span className="font-en">{parsed.format}</span> · {parsed.tables.length} جدول/ورقة
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 text-2xs font-semibold uppercase text-ink-500">
          اختر الجدول / الورقة
        </div>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {parsed.tables.map((t) => {
            const checked = t.name === selectedTableName;
            return (
              <li key={t.name}>
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-md border bg-white p-3.5 transition-colors ${
                    checked
                      ? 'border-teal-500 bg-teal-50/40 shadow-[inset_3px_0_0_var(--teal-500)]'
                      : 'border-border-subtle hover:border-border-default'
                  }`}
                >
                  <input
                    type="radio"
                    name="parsed-table"
                    value={t.name}
                    checked={checked}
                    onChange={() => {
                      setSelectedTableName(t.name);
                      setMapping(autoMapColumns(t.columns));
                    }}
                    className="h-4 w-4 cursor-pointer accent-teal-500"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-ink-900">{t.name}</div>
                    <div className="text-2xs text-ink-500">
                      <span className="font-en">{t.columns.length}</span> عمود ·{' '}
                      <span className="font-en">{t.rowCount.toLocaleString('en')}</span> صف
                    </div>
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
