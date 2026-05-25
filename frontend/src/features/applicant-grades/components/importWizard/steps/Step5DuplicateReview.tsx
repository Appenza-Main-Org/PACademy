/**
 * Step 5 — مراجعة التكرار.
 *
 * Runs the v2 preflight against the filtered + mapped rowset and renders
 * a top-line summary plus high-signal counters covering both intra-file
 * duplicates and existing-record matches:
 *   • مطابقات سابقة بالرقم القومي  (DUPLICATE_NID)
 *   • أرقام قومية غير صالحة         (INVALID_NID)
 *   • صفوف بحقول مطلوبة فالغة      (MISSING_REQUIRED)
 *
 * When intra-file duplicate density exceeds `DUPLICATE_RATIO_THRESHOLD`
 * (1%) the step escalates the warning to a hard guard: a destructive
 * banner with an acknowledgement checkbox blocks advancement until the
 * admin explicitly accepts the risk. The same gate is mirrored on Step 7
 * above the commit button so the override is reaffirmed at write time.
 *
 * Every issue surfaced by the preflight is exportable as a single
 * audit-report CSV from this step, so the decision trail survives the
 * import even before the backend grows a server-side history table.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Download,
  Hash,
  Layers,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Button, Checkbox } from '@/shared/components';
import { downloadBlob } from '@/shared/lib/download';
import { useImportWizardStore } from '../../../store/importWizard.store';
import { normaliseRows } from '../../../lib/normalise';
import { useApplicantGradesPreflight, useGrades } from '../../../api/grades.queries';
import { buildAlreadyImported } from '../../../lib/buildDiff';
import {
  buildAuditCsv,
  buildDuplicateAudit,
  buildIntegrityAuditRows,
  DUPLICATE_RATIO_THRESHOLD,
  type DuplicateAudit,
} from '../../../lib/duplicateAudit';
import type { ImportPreflightProgress } from '../../../types';

export function Step5DuplicateReview(): JSX.Element {
  const parsed = useImportWizardStore((s) => s.parsed);
  const selectedTableName = useImportWizardStore((s) => s.selectedTableName);
  const mapping = useImportWizardStore((s) => s.mapping);
  const filters = useImportWizardStore((s) => s.filters);
  const lookupValueMappings = useImportWizardStore((s) => s.lookupValueMappings);
  const graduationYear = useImportWizardStore((s) => s.graduationYear);
  const fileMeta = useImportWizardStore((s) => s.fileMeta);
  const selectedSchoolCategories = useImportWizardStore(
    (s) => s.selectedSchoolCategories,
  );
  const maxGradeByCategory = useImportWizardStore((s) => s.maxGradeByCategory);
  const importResult = useImportWizardStore((s) => s.importResult);
  const setImportResult = useImportWizardStore((s) => s.setImportResult);
  const loudDuplicateAck = useImportWizardStore((s) => s.loudDuplicateAck);
  const setLoudDuplicateAck = useImportWizardStore((s) => s.setLoudDuplicateAck);
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

  const audit = useMemo(() => buildDuplicateAudit(normalised), [normalised]);
  const integrityRows = useMemo(
    () =>
      buildIntegrityAuditRows({
        rows: normalised,
        selectedSchoolCategories,
        maxGradeByCategory,
      }),
    [normalised, selectedSchoolCategories, maxGradeByCategory],
  );

  /* Auto-clear the acknowledgement whenever the audit shape stops being
   * dangerous (e.g. admin tightened filters in Step 4). Stays sticky
   * while the threshold is still exceeded so an in-flight ack survives
   * a re-mount / re-preflight. */
  useEffect(() => {
    if (!audit.exceedsThreshold && loudDuplicateAck) {
      setLoudDuplicateAck(false);
    }
  }, [audit.exceedsThreshold, loudDuplicateAck, setLoudDuplicateAck]);

  const { data: allRows } = useGrades();
  const preflight = useApplicantGradesPreflight();

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
    return <PreflightProgress progress={progress} />;
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
  const missing = integrityRows.filter((row) => row.code === 'MISSING_REQUIRED').length;
  const outOfRange = integrityRows.filter((row) => row.code === 'GRADE_OUT_OF_RANGE').length;
  const unreadable = integrityRows.filter((row) => row.code === 'UNREADABLE_VALUE').length;
  const alreadyImported = buildAlreadyImported(normalised, allRows ?? []).length;
  const rejectedCount = Math.max(
    report.totals.failed,
    new Set(integrityRows.map((row) => row.sourceRowIndex)).size,
  );
  const duplicateMatches = dup + alreadyImported;
  const skippedCount = report.totals.skipped + alreadyImported;
  const readyToWrite = Math.max(0, report.totals.received - skippedCount - rejectedCount);

  function handleDownloadAudit(): void {
    const csv = buildAuditCsv({
      audit,
      report,
      rows: normalised,
      integrityRows,
      graduationYear,
      fileName: fileMeta?.name ?? null,
    });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadBlob(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      `applicant-grades-audit-${stamp}.csv`,
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <AuditSummaryRow audit={audit} />

      {audit.exceedsThreshold && (
        <LoudDuplicateGuard
          audit={audit}
          ack={loudDuplicateAck}
          onToggleAck={setLoudDuplicateAck}
        />
      )}

      <div className="grid grid-cols-2 overflow-hidden rounded-md border border-border-subtle bg-white md:grid-cols-4">
        <Counter
          icon={<Layers size={14} aria-hidden />}
          label="صفوف مكررة داخل الملف"
          value={audit.duplicateRowCount}
          tone={audit.exceedsThreshold ? 'danger' : 'warning'}
        />
        <Counter
          icon={<Activity size={14} aria-hidden />}
          label="مطابقات سابقة بالرقم القومي"
          value={duplicateMatches}
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

      <div className="grid grid-cols-2 overflow-hidden rounded-md border border-border-subtle bg-white">
        <Counter
          icon={<AlertTriangle size={14} aria-hidden />}
          label="درجات تتجاوز الدرجة العظمى"
          value={outOfRange}
          tone="danger"
        />
        <Counter
          icon={<AlertTriangle size={14} aria-hidden />}
          label="قيم غير رقمية / غير مقروءة"
          value={unreadable}
          tone="danger"
        />
      </div>

      <div className="grid grid-cols-4 overflow-hidden rounded-md border border-border-subtle bg-ink-50">
        <Summary label="مستلمة" value={report.totals.received} />
        <Summary label="جاهزة للكتابة" value={readyToWrite} tone="success" />
        <Summary label="مرفوضة" value={rejectedCount} tone="warning" />
        <Summary label="ملغاة" value={skippedCount} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-subtle bg-white px-3.5 py-2.5">
        <div className="flex items-center gap-2 text-xs text-ink-600">
          <ShieldCheck size={14} aria-hidden className="text-teal-600" />
          <span>
            احفظ نسخة من تقرير المراجعة (يتضمّن التكرارات، الحقول الناقصة،
            وأي تجاوز للحد الأقصى) قبل تأكيد الاستيراد.
          </span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          leadingIcon={<Download size={12} strokeWidth={1.75} aria-hidden />}
          onClick={handleDownloadAudit}
        >
          تحميل تقرير المراجعة
        </Button>
      </div>

      {audit.distribution.length > 0 && (
        <DuplicateDistributionTable audit={audit} totalRows={audit.totalRows} />
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

      {!audit.exceedsThreshold && rejectedCount === 0 && audit.duplicateRowCount === 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-success bg-success-bg px-3.5 py-2.5 text-xs text-success">
          <ShieldCheck size={14} aria-hidden />
          لا توجد مشاكل في الصفوف المُختارة — يمكن الانتقال لعرض النتيجة وتأكيد الاستيراد.
        </div>
      ) : !audit.exceedsThreshold ? (
        <div className="flex items-center gap-2 rounded-md border border-gold-300 bg-gold-50 px-3.5 py-2.5 text-xs text-gold-700">
          <AlertTriangle size={14} aria-hidden />
          {audit.duplicateRowCount > 0 && (
            <span>
              {audit.duplicateNidGroups.toLocaleString('en')} طلاب يحملون أرقام قومية مكررة —{' '}
              {audit.duplicateRowCount.toLocaleString('en')} صف سيُتم تجاوزه ضمنيًا. اختر الصف
              المعتمد في خطوة «مراجعة التغييرات».
            </span>
          )}
          {rejectedCount > 0 && (
            <span>
              توجد {rejectedCount.toLocaleString('en')} صفًا تحتاج إلى قرار — راجعها في خطوة
              «النتيجة».
            </span>
          )}
          {outOfRange > 0 && (
            <span>
              {outOfRange.toLocaleString('en')} صفًا تتجاوز الحد الأقصى — راجعها في «النتيجة».
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}

function AuditSummaryRow({ audit }: { audit: DuplicateAudit }): JSX.Element {
  const ratioPct =
    audit.totalRows === 0
      ? '0٪'
      : `${(audit.duplicateRatio * 100).toFixed(audit.duplicateRatio < 0.1 ? 2 : 1)}٪`;
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-md border border-border-subtle bg-white md:grid-cols-4">
      <SummaryStat
        icon={<Hash size={14} aria-hidden />}
        label="إجمالي الصفوف"
        value={audit.totalRows.toLocaleString('en')}
      />
      <SummaryStat
        icon={<Users size={14} aria-hidden />}
        label="أرقام قومية فريدة"
        value={audit.uniqueNidCount.toLocaleString('en')}
      />
      <SummaryStat
        icon={<Layers size={14} aria-hidden />}
        label="أرقام قومية مكررة"
        value={audit.duplicateNidGroups.toLocaleString('en')}
        tone={audit.exceedsThreshold ? 'danger' : audit.duplicateNidGroups > 0 ? 'warning' : undefined}
      />
      <SummaryStat
        icon={<ShieldAlert size={14} aria-hidden />}
        label="نسبة التكرار"
        value={ratioPct}
        tone={audit.exceedsThreshold ? 'danger' : audit.duplicateRowCount > 0 ? 'warning' : undefined}
      />
    </div>
  );
}

interface LoudDuplicateGuardProps {
  audit: DuplicateAudit;
  ack: boolean;
  onToggleAck: (ack: boolean) => void;
}

function LoudDuplicateGuard({
  audit,
  ack,
  onToggleAck,
}: LoudDuplicateGuardProps): JSX.Element {
  const ratioPct = `${(audit.duplicateRatio * 100).toFixed(2)}٪`;
  const thresholdPct = `${(DUPLICATE_RATIO_THRESHOLD * 100).toFixed(0)}٪`;
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-md border-2 border-terra-500 bg-terra-50 p-4 text-xs text-terra-700"
    >
      <div className="flex items-start gap-2.5">
        <ShieldAlert size={18} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0" />
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">
            تنبيه — كثافة تكرار غير معتادة في الملف
          </span>
          <p className="m-0 leading-relaxed">
            من بين <strong className="font-en">{audit.totalRows.toLocaleString('en')}</strong> صفًا في
            هذا الملف، هناك فقط{' '}
            <strong className="font-en">{audit.uniqueNidCount.toLocaleString('en')}</strong> رقم قومي
            فريد — أي أن{' '}
            <strong className="font-en">{audit.duplicateRowCount.toLocaleString('en')}</strong> صفًا
            (<strong className="font-en">{ratioPct}</strong>) ستُتجاوز ضمنيًا أثناء الاستيراد
            (يُحتفظ بأول ظهور لكل رقم قومي). يتجاوز هذا الحد الأقصى المسموح به{' '}
            <strong className="font-en">{thresholdPct}</strong> ويُشير في الغالب إلى ملف مُصدَّر
            بشكل خاطئ أو إلى تحديد عمود الرقم القومي بشكل غير صحيح في الخطوات السابقة.
          </p>
          <p className="m-0 leading-relaxed">
            راجع توزيع التكرار بالأسفل قبل المتابعة. لا يمكن إكمال الاستيراد إلا بعد إقرار صريح
            بالتجاوز.
          </p>
        </div>
      </div>
      <div className="flex cursor-pointer items-start gap-2 rounded-md border border-terra-300 bg-white p-3">
        <Checkbox
          id="loud-duplicate-ack"
          checked={ack}
          onCheckedChange={(value) => onToggleAck(value === true)}
          aria-label="إقرار بتجاوز كثافة التكرار"
        />
        <label htmlFor="loud-duplicate-ack" className="flex cursor-pointer flex-col gap-0.5 text-xs text-ink-700">
          <span className="font-semibold text-terra-700">
            أُقرّ بأنني راجعت توزيع التكرار وأرغب بإكمال الاستيراد على مسؤوليتي.
          </span>
          <span className="text-2xs text-ink-500">
            سيتم استيراد أول ظهور لكل رقم قومي فقط (
            <span className="font-en">{audit.uniqueNidCount.toLocaleString('en')}</span> صف)، وسيُسجّل
            هذا الإقرار في تقرير المراجعة.
          </span>
        </label>
      </div>
    </div>
  );
}

function DuplicateDistributionTable({
  audit,
  totalRows,
}: {
  audit: DuplicateAudit;
  totalRows: number;
}): JSX.Element {
  const [sortKey, setSortKey] = useState<'nationalId' | 'nameAr' | 'count'>('count');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const sorted = useMemo(() => {
    const rows = [...audit.distribution];
    rows.sort((a, b) => {
      const av = sortKey === 'nameAr' ? a.nameAr ?? '' : a[sortKey];
      const bv = sortKey === 'nameAr' ? b.nameAr ?? '' : b[sortKey];
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv), 'ar');
      return direction === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [audit.distribution, direction, sortKey]);
  const toggleSort = (key: 'nationalId' | 'nameAr' | 'count'): void => {
    if (sortKey === key) {
      setDirection((cur) => (cur === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setDirection(key === 'count' ? 'desc' : 'asc');
  };
  const sortMark = (key: 'nationalId' | 'nameAr' | 'count'): string =>
    sortKey === key ? (direction === 'asc' ? ' ↑' : ' ↓') : '';

  return (
    <section className="overflow-hidden rounded-md border border-border-subtle bg-white">
      <header className="flex items-center justify-between border-b border-border-subtle bg-ink-50/60 px-3.5 py-2 text-2xs font-semibold text-ink-700">
        <span>توزيع التكرار — أعلى الأرقام القومية تكرارًا</span>
        <span className="font-en text-ink-500">
          {audit.distribution.length.toLocaleString('en')}
          {audit.duplicateNidGroups > audit.distribution.length && (
            <span className="text-ink-400">
              {' '}
              / {audit.duplicateNidGroups.toLocaleString('en')}
            </span>
          )}
        </span>
      </header>
      <table className="w-full border-collapse text-xs">
        <thead className="bg-ink-50/30 text-2xs uppercase text-ink-500">
          <tr>
            <th scope="col" className="px-3 py-1.5 text-start font-semibold" style={{ width: 48 }}>
              #
            </th>
            <th scope="col" className="px-3 py-1.5 text-start font-semibold">
              <button type="button" onClick={() => toggleSort('nationalId')} className="hover:text-ink-900">
                الرقم القومي{sortMark('nationalId')}
              </button>
            </th>
            <th scope="col" className="px-3 py-1.5 text-start font-semibold">
              <button type="button" onClick={() => toggleSort('nameAr')} className="hover:text-ink-900">
                الاسم{sortMark('nameAr')}
              </button>
            </th>
            <th scope="col" className="px-3 py-1.5 text-end font-semibold" style={{ width: 120 }}>
              <button type="button" onClick={() => toggleSort('count')} className="hover:text-ink-900">
                عدد مرات التكرار{sortMark('count')}
              </button>
            </th>
            <th scope="col" className="px-3 py-1.5 text-end font-semibold" style={{ width: 100 }}>
              نسبة الملف
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((d, i) => {
            const pct = totalRows === 0 ? 0 : (d.count / totalRows) * 100;
            return (
              <tr key={d.nationalId} className="border-t border-border-subtle">
                <td className="px-3 py-1.5 font-en text-2xs text-ink-500 tabular-nums">{i + 1}</td>
                <td className="px-3 py-1.5">
                  <span className="font-mono text-2xs text-ink-700" dir="ltr">
                    {d.nationalId}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-ink-700">{d.nameAr ?? '—'}</td>
                <td className="px-3 py-1.5 text-end font-en text-xs font-semibold text-ink-900 tabular-nums">
                  {d.count.toLocaleString('en')}
                </td>
                <td className="px-3 py-1.5 text-end font-en text-2xs text-ink-500 tabular-nums">
                  {pct.toFixed(pct < 1 ? 2 : 1)}٪
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
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

function SummaryStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: JSX.Element;
  label: string;
  value: string;
  tone?: 'warning' | 'danger';
}): JSX.Element {
  const cls =
    tone === 'danger'
      ? 'text-terra-700 bg-terra-50'
      : tone === 'warning'
        ? 'text-gold-700 bg-gold-50'
        : 'text-ink-700 bg-white';
  return (
    <div
      className={`flex flex-col gap-1 border-s border-border-subtle px-4 py-3 first:border-s-0 ${cls}`}
    >
      <span className="flex items-center gap-1.5 text-2xs uppercase opacity-80">
        {icon}
        {label}
      </span>
      <span className="font-en text-xl font-bold tabular-nums">{value}</span>
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
