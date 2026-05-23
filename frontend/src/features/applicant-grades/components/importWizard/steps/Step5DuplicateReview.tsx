/**
 * Step 5 — مراجعة التكرار.
 *
 * Runs the v2 preflight against the filtered + mapped rowset and renders
 * a top-line summary plus three high-signal counters:
 *   • مطابقات سابقة بالرقم القومي  (DUPLICATE_NID)
 *   • أرقام قومية غير صالحة         (INVALID_NID)
 *   • صفوف بحقول مطلوبة فارغة      (MISSING_REQUIRED)
 *
 * The actual per-row resolution UI is Step 6's job — Step 5 is the
 * pre-commit hint that lets the admin know whether they want to step
 * back to Step 4 and tighten filters before running the preflight.
 */

import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Layers, ShieldCheck } from 'lucide-react';
import { useImportWizardStore } from '../../../store/importWizard.store';
import { normaliseRows } from '../../../lib/normalise';
import { useApplicantGradesPreflight, useGrades } from '../../../api/grades.queries';
import { buildAlreadyImported, buildUploadDuplicates } from '../../../lib/buildDiff';
import type { ImportPreflightProgress } from '../../../types';

export function Step5DuplicateReview(): JSX.Element {
  const parsed = useImportWizardStore((s) => s.parsed);
  const selectedTableName = useImportWizardStore((s) => s.selectedTableName);
  const mapping = useImportWizardStore((s) => s.mapping);
  const filters = useImportWizardStore((s) => s.filters);
  const lookupValueMappings = useImportWizardStore((s) => s.lookupValueMappings);
  const graduationYear = useImportWizardStore((s) => s.graduationYear);
  const selectedSchoolCategories = useImportWizardStore(
    (s) => s.selectedSchoolCategories,
  );
  const importResult = useImportWizardStore((s) => s.importResult);
  const setImportResult = useImportWizardStore((s) => s.setImportResult);
  const [progress, setProgress] = useState<ImportPreflightProgress | null>(null);

  const table = useMemo(
    () => parsed?.tables.find((t) => t.name === selectedTableName) ?? null,
    [parsed, selectedTableName],
  );

  const normalised = useMemo(
    () =>
      table && graduationYear != null
        ? normaliseRows(
            table,
            mapping,
            filters,
            graduationYear,
            lookupValueMappings,
            selectedSchoolCategories,
          )
        : [],
    [table, mapping, filters, graduationYear, lookupValueMappings, selectedSchoolCategories],
  );

  const { data: allRows } = useGrades();
  const preflight = useApplicantGradesPreflight();

  /* Re-run preflight every time Step 5 mounts with a different
   * normalised rowset. The mutation is idempotent against the same
   * input so navigating back/forward doesn't double-charge. */
  useEffect(() => {
    if (normalised.length === 0 || graduationYear == null) {
      setProgress(null);
      setImportResult({
        totals: { received: 0, imported: 0, skipped: 0, failed: 0 },
        groups: [],
      });
      return;
    }
    setProgress({ processedRows: 0, totalRows: normalised.length });
    preflight.mutate(
      { rows: normalised, graduationYear, onProgress: setProgress },
      {
        onSuccess: (report) => {
          setImportResult(report);
          setProgress(null);
        },
        onError: () => setProgress(null),
      },
    );
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [normalised, graduationYear]);

  const report = importResult;

  if (preflight.isPending && !report) {
    return (
      <PreflightProgress progress={progress} />
    );
  }

  if (!report) {
    return (
      <div className="rounded-md border border-border-subtle bg-white py-12 text-center text-sm text-ink-500">
        لا توجد بيانات للمراجعة.
      </div>
    );
  }

  const dup = report.groups.find((g) => g.code === 'DUPLICATE_NID')?.rows.length ?? 0;
  const invalid = report.groups.find((g) => g.code === 'INVALID_NID')?.rows.length ?? 0;
  const missing = report.groups.find((g) => g.code === 'MISSING_REQUIRED')?.rows.length ?? 0;
  const intraFileDup = buildUploadDuplicates(normalised).length;
  const alreadyImported = buildAlreadyImported(normalised, allRows ?? []).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-5 overflow-hidden rounded-md border border-border-subtle bg-white">
        <Counter
          icon={<CheckCircle2 size={14} aria-hidden />}
          label="موجود مسبقًا بنفس سنة التخرج — سيُتجاهل"
          value={alreadyImported}
          tone="info"
        />
        <Counter
          icon={<Layers size={14} aria-hidden />}
          label="تكرار داخل الملف بنفس الرقم القومي"
          value={intraFileDup}
          tone="warning"
        />
        <Counter
          icon={<Activity size={14} aria-hidden />}
          label="مطابقات سابقة بالرقم القومي"
          value={dup}
          tone="warning"
        />
        <Counter
          icon={<AlertTriangle size={14} aria-hidden />}
          label="أرقام قومية غير صالحة"
          value={invalid}
          tone="danger"
        />
        <Counter
          icon={<AlertTriangle size={14} aria-hidden />}
          label="صفوف بحقول مطلوبة فارغة"
          value={missing}
          tone="danger"
        />
      </div>

      <div className="grid grid-cols-4 overflow-hidden rounded-md border border-border-subtle bg-ink-50">
        <Summary label="مستلمة" value={report.totals.received} />
        <Summary label="جاهزة للكتابة" value={report.totals.imported} tone="success" />
        <Summary label="مرفوضة" value={report.totals.failed} tone="warning" />
        <Summary label="ملغاة" value={report.totals.skipped} />
      </div>

      {report.totals.failed === 0 && intraFileDup === 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-success bg-success-bg px-3.5 py-2.5 text-xs text-success">
          <ShieldCheck size={14} aria-hidden />
          لا توجد مشاكل في الصفوف المُختارة — يمكن الانتقال لعرض النتيجة وتأكيد الاستيراد.
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-md border border-gold-300 bg-gold-50 px-3.5 py-2.5 text-xs text-gold-700">
          <AlertTriangle size={14} aria-hidden />
          {intraFileDup > 0 && (
            <span>
              يوجد {intraFileDup.toLocaleString('en')} رقم قومي مكرر داخل الملف — اختر الصف
              المعتمد لكل طالب في خطوة «مراجعة التغييرات».
            </span>
          )}
          {report.totals.failed > 0 && (
            <span>
              توجد {report.totals.failed.toLocaleString('en')} صفًا تحتاج إلى قرار — راجعها في
              خطوة «النتيجة».
            </span>
          )}
        </div>
      )}

      {alreadyImported > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-teal-200 bg-teal-50 px-3.5 py-2.5 text-xs text-teal-700">
          <CheckCircle2 size={14} aria-hidden />
          <span>
            {alreadyImported.toLocaleString('en')} صفًا موجود مسبقًا بنفس الرقم القومي وبنفس سنة التخرج —
            سيُتجاهل تلقائيًا أثناء التأكيد. كل طالب يبقى بسجل واحد لكل سنة تخرج في النظام.
          </span>
        </div>
      )}
    </div>
  );
}

function PreflightProgress({
  progress,
}: {
  progress: ImportPreflightProgress | null;
}): JSX.Element {
  const pct =
    progress && progress.totalRows > 0
      ? Math.min(100, Math.round((progress.processedRows / progress.totalRows) * 100))
      : 0;

  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-md border border-border-subtle bg-white px-6 py-12 text-sm text-ink-500"
      role="status"
      aria-live="polite"
    >
      <span>جارٍ مراجعة الصفوف…</span>
      {progress && (
        <div className="flex w-full max-w-sm flex-col gap-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
            <div
              className="h-full bg-teal-500 transition-[inline-size]"
              style={{ inlineSize: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-2xs text-ink-500">
            <span className="font-en tabular-nums" dir="ltr">
              {progress.processedRows.toLocaleString('en')} / {progress.totalRows.toLocaleString('en')}
            </span>
            <span className="font-en tabular-nums" dir="ltr">
              {pct}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function Counter({
  icon,
  label,
  value,
  tone,
}: {
  icon: JSX.Element;
  label: string;
  value: number;
  tone: 'info' | 'warning' | 'danger';
}): JSX.Element {
  const cls =
    tone === 'info'
      ? 'text-teal-700 bg-teal-50'
      : tone === 'warning'
        ? 'text-gold-700 bg-gold-50'
        : 'text-terra-700 bg-terra-50';
  return (
    <div className={`flex flex-col gap-1.5 border-s border-border-subtle px-4 py-3.5 first:border-s-0 ${cls}`}>
      <span className="flex items-center gap-1.5 text-2xs font-semibold uppercase">
        {icon}
        {label}
      </span>
      <span className="font-en text-2xl font-bold">{value.toLocaleString('en')}</span>
    </div>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'success' | 'warning';
}): JSX.Element {
  const cls =
    tone === 'success'
      ? 'text-success bg-success-bg'
      : tone === 'warning'
        ? 'text-gold-700 bg-gold-50'
        : 'text-ink-700 bg-white';
  return (
    <div className={`flex flex-col gap-0.5 border-s border-border-subtle px-3 py-2 first:border-s-0 ${cls}`}>
      <span className="text-2xs uppercase opacity-80">{label}</span>
      <span className="font-en text-lg font-bold">{value.toLocaleString('en')}</span>
    </div>
  );
}
