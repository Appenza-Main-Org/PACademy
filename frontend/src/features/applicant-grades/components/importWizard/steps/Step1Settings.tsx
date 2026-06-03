/**
 * Step 1 — الإعدادات.
 *
 * Captures the wizard's pre-parse inputs:
 *   • School category — single-select from the school-categories lookup.
 *     The picked category exposes its own الدرجة العظمى input. Stored
 *     as a single-element array on the store so the downstream commit
 *     contract (which accepts `string[]`) stays stable.
 *   • Graduation year (default = active cycle's year)
 *   • File pick (validated by extension + size; no parsing here)
 *
 * Parsing runs in Step 2 against the picked `File`; Step 1's job is to
 * gate inputs and validate the file metadata.
 */

import { useRef, useState } from 'react';
import { Download, Sheet, Upload, X } from 'lucide-react';
import {
  Button,
  Combobox,
  Field,
  LoadingState,
  SearchSelect,
} from '@/shared/components';
import type { SearchSelectOption } from '@/shared/components';
import { useLookup } from '@/features/lookups';
import {
  defaultMaxFor,
  useImportWizardStore,
} from '../../../store/importWizard.store';
import { SUPPORTED_GRADES_EXTENSIONS } from '../../../lib/parseGradesFile';
import { downloadTemplateWorkbook } from '../../../lib/buildTemplateWorkbook';

const MB = 1024 * 1024;
const MAX_FILE_SIZE_MB = 500;
const IMPORT_DROPDOWN_TRIGGER_CLASS =
  '!h-11 !border-border-default !ps-3.5 !pe-3.5 text-sm font-medium shadow-sm hover:!border-border-strong focus-visible:!border-teal-500 data-[state=open]:!border-teal-500 data-[state=open]:shadow-focus-teal';

function matchExtension(fileName: string): string | null {
  const lower = fileName.toLowerCase();
  return SUPPORTED_GRADES_EXTENSIONS.find((ext) => lower.endsWith(ext)) ?? null;
}

function validateFile(file: { name: string; size: number }): string | null {
  const ext = matchExtension(file.name);
  if (!ext) {
    return `صيغة الملف غير مدعومة. الصيغ المقبولة: ${SUPPORTED_GRADES_EXTENSIONS.join('، ')}`;
  }
  if (file.size > MAX_FILE_SIZE_MB * MB) {
    const actualMb = (file.size / MB).toFixed(file.size / MB >= 100 ? 0 : 1);
    return `حجم الملف (${actualMb} م.ب) يتجاوز الحد الأقصى ${MAX_FILE_SIZE_MB} م.ب`;
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

interface Step1SettingsProps {
  /** When true, render inline "required" errors under fields whose value
   *  is still empty. Driven by the wizard page: errors are suppressed on
   *  initial render and switched on once the admin attempts to advance. */
  showRequiredErrors?: boolean;
}

export function Step1Settings({ showRequiredErrors = false }: Step1SettingsProps = {}): JSX.Element {
  const selectedSchoolCategories = useImportWizardStore(
    (s) => s.selectedSchoolCategories,
  );
  const setSelectedSchoolCategories = useImportWizardStore(
    (s) => s.setSelectedSchoolCategories,
  );
  const maxGradeByCategory = useImportWizardStore((s) => s.maxGradeByCategory);
  const setMaxGradeForCategory = useImportWizardStore(
    (s) => s.setMaxGradeForCategory,
  );
  const graduationYear = useImportWizardStore((s) => s.graduationYear);
  const setGraduationYear = useImportWizardStore((s) => s.setGraduationYear);
  const file = useImportWizardStore((s) => s.file);
  const fileMeta = useImportWizardStore((s) => s.fileMeta);
  const setFile = useImportWizardStore((s) => s.setFile);

  const schoolCategoriesQuery = useLookup('school-categories');
  const graduationYearsQuery = useLookup('graduation-years');
  const activeCategories = (schoolCategoriesQuery.data ?? []).filter(
    (r) => r.isActive,
  );
  const pickedCode = selectedSchoolCategories[0] ?? null;
  const pickedCategory = pickedCode
    ? activeCategories.find((c) => c.code === pickedCode) ?? null
    : null;
  const pickedMax = pickedCode
    ? maxGradeByCategory[pickedCode] ?? defaultMaxFor(pickedCode)
    : null;

  function pickCategory(code: string | null): void {
    /* Single-select. Passing `null` clears (used by Combobox's clear
     * action). Passing the active code is a no-op to keep the
     * Combobox's option-click semantics straightforward. */
    if (code === null) {
      setSelectedSchoolCategories([]);
      return;
    }
    setSelectedSchoolCategories([code]);
  }

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

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
    setIsDraggingFile(false);
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

  const yearOptions: SearchSelectOption[] = (graduationYearsQuery.data ?? [])
    .filter((row) => row.isActive)
    .sort((a, b) => b.year - a.year)
    .map((row) => ({ value: String(row.year), label: row.name }));

  const schoolCategoryOptions = activeCategories.map((c) => ({
    value: c.code,
    label: c.name,
  }));
  const categoryError =
    showRequiredErrors && pickedCode == null ? 'الرجاء اختيار فئة المدرسة' : undefined;
  const yearError =
    showRequiredErrors && graduationYear == null ? 'الرجاء اختيار سنة التخرج' : undefined;
  const requiredFileError =
    showRequiredErrors && !file && !fileMeta ? 'الرجاء رفع ملف البيانات' : undefined;

  const meta = file ?? fileMeta;

  return (
    <div className="flex flex-col gap-4">
      <Field
        label="فئة المدرسة"
        required
        error={categoryError}
      >
        {schoolCategoriesQuery.isLoading ? (
          <LoadingState variant="list" />
        ) : activeCategories.length === 0 ? (
          <div className="rounded-md border border-dashed border-border-default bg-ink-50/40 px-3 py-3 text-2xs text-ink-500">
            لا توجد فئات مدارس مفعّلة. أضف الفئات من «الأكواد المرجعية» أولاً.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <Combobox
              value={pickedCode}
              onChange={pickCategory}
              options={schoolCategoryOptions}
              placeholder="اختر فئة المدرسة"
              ariaLabel="فئة المدرسة"
              clearable
              triggerClassName={IMPORT_DROPDOWN_TRIGGER_CLASS}
            />
            {pickedCategory && pickedCode && pickedMax != null && (
              <div className="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-ink-50/40 px-3 py-2">
                <span className="text-sm font-medium text-ink-900">
                  {pickedCategory.name}
                </span>
                <label
                  className="inline-flex h-8 cursor-text items-center gap-2 rounded-md border border-border-default bg-white px-2.5 text-sm font-medium text-ink-900"
                  style={{ width: 160 }}
                >
                  <span className="text-2xs text-ink-500">الدرجة العظمى</span>
                  <input
                    type="number"
                    value={pickedMax}
                    min={1}
                    max={1000}
                    onChange={(e) =>
                      setMaxGradeForCategory(
                        pickedCode,
                        e.target.value === '' ? 0 : Number(e.target.value),
                      )
                    }
                    className="min-w-0 flex-1 border-0 bg-transparent p-0 font-en text-sm font-semibold text-ink-900 outline-none"
                    aria-label={`الدرجة العظمى لفئة ${pickedCategory.name}`}
                  />
                </label>
              </div>
            )}
          </div>
        )}
      </Field>

      <Field
        label="سنة التخرج"
        required
        error={yearError}
      >
        {graduationYearsQuery.isLoading ? (
          <LoadingState variant="list" />
        ) : yearOptions.length === 0 ? (
          <div className="rounded-md border border-dashed border-border-default bg-ink-50/40 px-3 py-3 text-2xs text-ink-500">
            لا توجد سنوات تخرج مفعّلة. أضف السنوات من «الأكواد المرجعية» أولاً.
          </div>
        ) : (
          <SearchSelect
            value={graduationYear == null ? null : String(graduationYear)}
            onChange={(v) => setGraduationYear(v == null ? null : Number(v))}
            options={yearOptions}
            placeholder="اختر السنة"
            ariaLabel="سنة التخرج"
            invalid={Boolean(yearError)}
            className="!h-11 !ps-3.5 !pe-9 text-sm font-medium shadow-sm"
          />
        )}
      </Field>

      <Field label="ملف البيانات" required error={fileError ?? requiredFileError}>
        <input
          ref={inputRef}
          type="file"
          accept={SUPPORTED_GRADES_EXTENSIONS.join(',')}
          onChange={pick}
          className="sr-only"
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
            onDragEnter={() => setIsDraggingFile(true)}
            onDragLeave={() => setIsDraggingFile(false)}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingFile(true);
            }}
            className={`flex min-h-[152px] cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-6 text-center transition-colors duration-fast ease-standard focus-visible:shadow-focus-teal focus-visible:outline-none ${
              fileError || requiredFileError
                ? 'border-terra-300 bg-terra-50 text-terra-700'
                : isDraggingFile
                  ? 'border-teal-500 bg-teal-50 text-teal-700'
                  : 'border-border-strong bg-white text-ink-500 hover:border-teal-500 hover:bg-teal-50/40'
            }`}
          >
            <div className="grid h-11 w-11 place-items-center rounded-md border border-border-subtle bg-white text-teal-700 shadow-xs">
              <Upload size={18} strokeWidth={1.75} aria-hidden />
            </div>
            <div className="text-sm font-semibold text-ink-900">
              اسحب الملف أو اختره
            </div>
            <div className="max-w-md text-2xs leading-relaxed text-ink-500">
              Access / Excel / CSV حتى <span className="font-en">{MAX_FILE_SIZE_MB}</span> م.ب.
            </div>
            <div className="rounded-pill bg-ink-50 px-3 py-1 text-2xs text-ink-600">
              <span className="font-en" dir="ltr">
                {SUPPORTED_GRADES_EXTENSIONS.join(' · ')}
              </span>
            </div>
          </div>
        )}
        {meta && (
          <div className="flex items-center gap-3 rounded-md border border-success bg-success-bg p-3.5 shadow-xs">
            <div className="grid h-11 w-11 place-items-center rounded-md border border-success bg-white text-success">
              <Sheet size={16} strokeWidth={1.75} aria-hidden />
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
              className="grid h-8 w-8 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-ink-500 hover:bg-white focus-visible:shadow-focus-teal focus-visible:outline-none"
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
