/**
 * Step 1 — الإعدادات.
 *
 * Captures the wizard's pre-parse inputs:
 *   • Secondary type (general / azhar)
 *   • Max grade (410 / 510 + manual override)
 *   • Graduation year (default = active cycle's year)
 *   • File pick (validated by extension + size; no parsing here)
 *
 * Parsing runs in Step 2 against the picked `File`; Step 1's job is to
 * gate inputs and validate the file metadata.
 */

import { useRef, useState } from 'react';
import { Download, Sheet, Upload, X } from 'lucide-react';
import { Button, Combobox, Field } from '@/shared/components';
import { useImportWizardStore } from '../../../store/importWizard.store';
import { SUPPORTED_GRADES_EXTENSIONS } from '../../../lib/parseGradesFile';
import { downloadTemplateWorkbook } from '../../../lib/buildTemplateWorkbook';

const MB = 1024 * 1024;
const SIZE_LIMITS_MB: Record<string, number> = {
  '.mdb': 500,
  '.accdb': 500,
  '.xlsx': 500,
  '.xls': 500,
  '.csv': 500,
};

function matchExtension(fileName: string): string | null {
  const lower = fileName.toLowerCase();
  return SUPPORTED_GRADES_EXTENSIONS.find((ext) => lower.endsWith(ext)) ?? null;
}

function validateFile(file: { name: string; size: number }): string | null {
  const ext = matchExtension(file.name);
  if (!ext) {
    return `صيغة الملف غير مدعومة. الصيغ المقبولة: ${SUPPORTED_GRADES_EXTENSIONS.join('، ')}`;
  }
  const limitMb = SIZE_LIMITS_MB[ext];
  if (limitMb && file.size > limitMb * MB) {
    const actualMb = (file.size / MB).toFixed(file.size / MB >= 100 ? 0 : 1);
    return `حجم الملف (${actualMb} م.ب) يتجاوز الحد الأقصى ${limitMb} م.ب لصيغة ${ext}`;
  }
  return null;
}

function formatSize(bytes: number): string {
  if (bytes >= MB) {
    const v = bytes / MB;
    return `${v.toFixed(v >= 100 ? 0 : 1)} م.ب`;
  }
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} ك.ب`;
  return `${bytes} ب`;
}

export function Step1Settings(): JSX.Element {
  const secondaryType = useImportWizardStore((s) => s.secondaryType);
  const setSecondaryType = useImportWizardStore((s) => s.setSecondaryType);
  const maxGrade = useImportWizardStore((s) => s.maxGrade);
  const setMaxGrade = useImportWizardStore((s) => s.setMaxGrade);
  const graduationYear = useImportWizardStore((s) => s.graduationYear);
  const setGraduationYear = useImportWizardStore((s) => s.setGraduationYear);
  const file = useImportWizardStore((s) => s.file);
  const fileMeta = useImportWizardStore((s) => s.fileMeta);
  const setFile = useImportWizardStore((s) => s.setFile);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  function pick(e: React.ChangeEvent<HTMLInputElement>): void {
    const f = e.target.files?.[0];
    if (!f) return;
    const err = validateFile({ name: f.name, size: f.size });
    if (err) {
      setFileError(err);
      setFile(null);
      return;
    }
    setFileError(null);
    setFile(f);
    e.target.value = '';
  }

  function drop(e: React.DragEvent): void {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    const err = validateFile({ name: f.name, size: f.size });
    if (err) {
      setFileError(err);
      setFile(null);
      return;
    }
    setFileError(null);
    setFile(f);
  }

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 11 }, (_, i) => {
    const y = currentYear - i;
    return { value: String(y), label: String(y) };
  });

  const meta = file ?? fileMeta;

  return (
    <div className="flex flex-col gap-4">
      <Field label="نوع الثانوية" required helper="يحدد الدرجة العظمى الافتراضية">
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
            const active = secondaryType === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => setSecondaryType(v)}
                className="cursor-pointer rounded-sm border-0 px-4 py-1.5 text-sm font-medium transition-colors"
                style={{
                  background: active ? 'var(--teal-500)' : 'transparent',
                  color: active ? '#fff' : 'var(--ink-700)',
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
              value={maxGrade}
              min={1}
              max={1000}
              onChange={(e) => setMaxGrade(e.target.value === '' ? 0 : Number(e.target.value))}
              className="min-w-0 flex-1 border-0 bg-transparent p-0 font-en text-sm font-medium text-ink-900 outline-none"
            />
            <span className="text-xs text-ink-500">درجة</span>
          </label>
          <div className="flex gap-1">
            {[410, 510].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setMaxGrade(p)}
                className="cursor-pointer rounded-full border px-3 py-1 font-en text-2xs font-medium"
                style={{
                  background: maxGrade === p ? 'var(--teal-500)' : '#fff',
                  color: maxGrade === p ? '#fff' : 'var(--ink-700)',
                  borderColor: maxGrade === p ? 'var(--teal-500)' : 'var(--border-default)',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </Field>

      <Field
        label="سنة التخرج"
        required
        helper="تُطبَّق على كل صف يُستورد إن لم يحمل عمود سنة تخرّج خاص به"
      >
        <Combobox
          value={String(graduationYear)}
          onChange={(v) => setGraduationYear(v ? Number(v) : currentYear)}
          options={yearOptions}
          placeholder="اختر السنة"
          ariaLabel="سنة التخرج"
        />
      </Field>

      <Field label="ملف البيانات" required error={fileError ?? undefined}>
        <input
          ref={inputRef}
          type="file"
          accept={SUPPORTED_GRADES_EXTENSIONS.join(',')}
          onChange={pick}
          className="pointer-events-none absolute h-px w-px opacity-0"
        />
        {!meta && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                inputRef.current?.click();
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
            <div className="text-2xs text-ink-500">
              <span className="font-en" dir="ltr">
                {SUPPORTED_GRADES_EXTENSIONS.join(' · ')}
              </span>
            </div>
          </div>
        )}
        {meta && (
          <div className="flex items-center gap-3 rounded-md border border-success bg-success-bg p-3.5">
            <div className="grid h-10 w-10 place-items-center rounded-md border border-success bg-white text-success">
              <Sheet size={14} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold text-ink-900">
                {meta.name}
              </div>
              <div className="text-2xs text-ink-500">
                <span className="font-en">{formatSize(meta.size)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFile(null)}
              aria-label="إزالة"
              className="grid h-7 w-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-ink-500 hover:bg-white"
            >
              <X size={14} />
            </button>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between gap-2 text-2xs text-ink-500">
          <span>نزّل النموذج لضمان تطابق الأعمدة.</span>
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<Download size={14} strokeWidth={1.75} />}
            onClick={() => void downloadTemplateWorkbook()}
          >
            تنزيل نموذج Excel
          </Button>
        </div>
      </Field>
    </div>
  );
}
