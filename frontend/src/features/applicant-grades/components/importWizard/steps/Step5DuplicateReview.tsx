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
import { cn } from '@/shared/lib/cn';
import { useImportWizardStore } from '../../../store/importWizard.store';
import { normaliseRows } from '../../../lib/normalise';
import { useApplicantGradesPreflight, useGrades } from '../../../api/grades.queries';
import { buildAlreadyImported } from '../../../lib/buildDiff';
import {
  buildAuditCsv,
  buildDuplicateAudit,
  buildImportValidationRules,
  buildIntegrityAuditRows,
  DUPLICATE_RATIO_THRESHOLD,
  summarizeIntegrityDecisions,
  type DuplicateAudit,
} from '../../../lib/duplicateAudit';
import { useApplicationSettingsSummary } from '@/features/admin/admission-setup/api/applicationSettings.queries';
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
  const outOfRangeDecisions = useImportWizardStore((s) => s.outOfRangeDecisions);
  const loudDuplicateAck = useImportWizardStore((s) => s.loudDuplicateAck);
  const setLoudDuplicateAck = useImportWizardStore((s) => s.setLoudDuplicateAck);
  const [progress, setProgress] = useState<ImportPreflightProgress | null>(null);
  const settingsQuery = useApplicationSettingsSummary(true);

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
  const validationRules = useMemo(
    () =>
      buildImportValidationRules({
        settings: settingsQuery.data,
        selectedSchoolCategories,
        graduationYear,
      }),
    [settingsQuery.data, selectedSchoolCategories, graduationYear],
  );
  const integrityRows = useMemo(
    () =>
      buildIntegrityAuditRows({
        rows: normalised,
        selectedSchoolCategories,
        maxGradeByCategory,
        validationRules,
      }),
    [normalised, selectedSchoolCategories, maxGradeByCategory, validationRules],
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
      { rows: normalised, graduationYear, validationRules, onProgress: setProgress },
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
  const invalidRowIndexes = new Set<number>();
  for (const row of report.groups.find((g) => g.code === 'INVALID_NID')?.rows ?? []) {
    invalidRowIndexes.add(row.sourceRowIndex);
  }
  for (const row of integrityRows) {
    if (row.code === 'INVALID_NID') invalidRowIndexes.add(row.sourceRowIndex);
  }
  const invalid = invalidRowIndexes.size;
  const genderMismatch = integrityRows.filter((row) => row.code === 'GENDER_MISMATCH').length;
  const ageOutOfRange = integrityRows.filter((row) => row.code === 'AGE_OUT_OF_RANGE').length;
  const missing = integrityRows.filter((row) => row.code === 'MISSING_REQUIRED').length;
  const outOfRange = integrityRows.filter((row) => row.code === 'GRADE_OUT_OF_RANGE').length;
  const unreadable = integrityRows.filter((row) => row.code === 'UNREADABLE_VALUE').length;
  const hardRejectedSourceRows = new Set(
    integrityRows
      .filter((row) => row.code !== 'GRADE_OUT_OF_RANGE')
      .map((row) => row.sourceRowIndex),
  );
  const outOfRangeHardRejected = integrityRows.filter(
    (row) =>
      row.code === 'GRADE_OUT_OF_RANGE' &&
      hardRejectedSourceRows.has(row.sourceRowIndex),
  ).length;
  const alreadyImported = buildAlreadyImported(normalised, allRows ?? []).length;
  const decisionSummary = summarizeIntegrityDecisions(
    integrityRows,
    outOfRangeDecisions,
  );
  const rejectedCount = Math.max(
    report.totals.failed,
    decisionSummary.rejectedSourceRows.size,
  );
  const pendingDecisionCount = decisionSummary.pendingOutOfRangeCount;
  const duplicateMatches = dup + alreadyImported;
  const skippedCount = report.totals.skipped + alreadyImported;
  const readyToWrite = Math.max(
    0,
    report.totals.received - skippedCount - rejectedCount - pendingDecisionCount,
  );

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

      <IssueOverview
        duplicateRows={audit.duplicateRowCount}
        duplicateMatches={duplicateMatches}
        invalid={invalid}
        missing={missing}
        genderMismatch={genderMismatch}
        ageOutOfRange={ageOutOfRange}
        outOfRange={outOfRange}
        unreadable={unreadable}
        isHighDuplicateRatio={audit.exceedsThreshold}
      />

      <div className="grid grid-cols-2 overflow-hidden rounded-md border border-border-subtle bg-ink-50 md:grid-cols-5">
        <Summary label="مستلمة" value={report.totals.received} />
        <Summary label="جاهزة للكتابة" value={readyToWrite} tone="success" />
        <Summary label="تحتاج قرار" value={pendingDecisionCount} tone="warning" />
        <Summary label="مرفوضة" value={rejectedCount} tone="warning" />
        <Summary label="ملغاة" value={skippedCount} />
      </div>

      <ImportCountReconciliation
        received={report.totals.received}
        ready={readyToWrite}
        pending={pendingDecisionCount}
        rejected={rejectedCount}
        skipped={skippedCount}
        outOfRangeHardRejected={outOfRangeHardRejected}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-subtle bg-white px-3.5 py-2.5">
        <div className="flex items-center gap-2 text-xs text-ink-600">
          <ShieldCheck size={14} aria-hidden className="text-teal-600" />
          <span>تقرير المراجعة متاح للحفظ.</span>
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
            {alreadyImported.toLocaleString('en')} صف موجود مسبقًا وسيُتجاهل.
          </span>
        </div>
      )}

      {!audit.exceedsThreshold && rejectedCount === 0 && audit.duplicateRowCount === 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-success bg-success-bg px-3.5 py-2.5 text-xs text-success">
          <ShieldCheck size={14} aria-hidden />
          الصفوف جاهزة للمتابعة.
        </div>
      ) : !audit.exceedsThreshold ? (
        <div className="flex items-center gap-2 rounded-md border border-gold-300 bg-gold-50 px-3.5 py-2.5 text-xs text-gold-700">
          <AlertTriangle size={14} aria-hidden />
          {audit.duplicateRowCount > 0 && (
            <span>
              {audit.duplicateRowCount.toLocaleString('en')} تكرارات داخل الملف.
            </span>
          )}
          {pendingDecisionCount > 0 && (
            <span>{pendingDecisionCount.toLocaleString('en')} صف يحتاج قرارًا.</span>
          )}
          {rejectedCount > 0 && (
            <span>{rejectedCount.toLocaleString('en')} صف مرفوض.</span>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ImportCountReconciliation({
  received,
  ready,
  pending,
  rejected,
  skipped,
  outOfRangeHardRejected,
}: {
  received: number;
  ready: number;
  pending: number;
  rejected: number;
  skipped: number;
  outOfRangeHardRejected: number;
}): JSX.Element {
  const reconciled = ready + pending + rejected + skipped;
  const matches = reconciled === received;
  return (
    <div className="rounded-md border border-border-subtle bg-white px-3.5 py-3 text-xs leading-6 text-ink-600">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <ShieldCheck
          size={14}
          aria-hidden
          className={matches ? 'text-teal-600' : 'text-terra-600'}
        />
        <span className="font-semibold text-ink-700">تطابق الأرقام:</span>
        <span>
          <span className="font-en font-semibold">{reconciled.toLocaleString('en')}</span> من{' '}
          <span className="font-en font-semibold">{received.toLocaleString('en')}</span> صف.
        </span>
      </div>
      {outOfRangeHardRejected > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-gold-700">
          <AlertTriangle size={14} aria-hidden />
          <span>{outOfRangeHardRejected.toLocaleString('en')} من درجات التجاوز مرفوضة نهائيًا.</span>
        </div>
      )}
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
      className="flex flex-col gap-3 rounded-md border border-terra-500 bg-terra-50 p-4 text-xs text-terra-700"
    >
      <div className="flex items-start gap-2.5">
        <ShieldAlert size={18} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-terra-700" />
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">تكرار مرتفع يحتاج إقرارًا</span>
          <p className="m-0 leading-relaxed">
            <strong className="font-en">{audit.duplicateRowCount.toLocaleString('en')}</strong> صف
            مكرر ({ratioPct})، والحد {thresholdPct}.
          </p>
        </div>
      </div>
      <div
        className={cn(
          'flex cursor-pointer items-center gap-3 rounded-md border bg-white p-3.5 transition-[border-color,box-shadow,background-color] duration-fast ease-standard',
          ack
            ? 'border-teal-600 bg-teal-50/60 shadow-[0_0_0_3px_var(--teal-50)]'
            : 'border-terra-500 shadow-[0_0_0_3px_var(--terra-50)] hover:border-terra-700',
        )}
        onClick={() => onToggleAck(!ack)}
      >
        <span
          className={cn(
            'grid h-11 w-11 shrink-0 place-items-center rounded-md border transition-colors duration-fast ease-standard',
            ack
              ? 'border-teal-300 bg-teal-100'
              : 'border-terra-200 bg-terra-100',
          )}
        >
          <Checkbox
            id="loud-duplicate-ack"
            checked={ack}
            onClick={(event) => event.stopPropagation()}
            onCheckedChange={(value) => onToggleAck(value === true)}
            aria-label="إقرار بتجاوز كثافة التكرار"
            className={cn(
              '[&_[role=checkbox]]:h-7 [&_[role=checkbox]]:w-7 [&_[role=checkbox]]:rounded-sm [&_[role=checkbox]]:border-2 [&_[role=checkbox]]:shadow-sm',
              ack
                ? '[&_[role=checkbox]]:border-teal-800 [&_[role=checkbox]]:bg-teal-800'
                : '[&_[role=checkbox]]:border-terra-800 [&_[role=checkbox]]:bg-white',
            )}
          />
        </span>
        <label
          htmlFor="loud-duplicate-ack"
          className="flex flex-1 cursor-pointer flex-col gap-1 text-xs text-ink-700"
          onClick={(event) => event.stopPropagation()}
        >
          <span
            className={cn(
              'inline-flex w-fit items-center rounded-sm px-2 py-0.5 text-2xs font-bold',
              ack ? 'bg-teal-100 text-teal-800' : 'bg-terra-100 text-terra-800',
            )}
          >
            {ack ? 'تم الإقرار' : 'مطلوب قبل المتابعة'}
          </span>
          <span className={cn('text-sm font-bold', ack ? 'text-teal-800' : 'text-terra-800')}>
            راجعت التكرارات وأوافق على المتابعة.
          </span>
          <span className="text-2xs text-ink-500">
            سيُستخدم الصف المختار لكل رقم قومي.
          </span>
        </label>
      </div>
    </div>
  );
}

function IssueOverview({
  duplicateRows,
  duplicateMatches,
  invalid,
  missing,
  genderMismatch,
  ageOutOfRange,
  outOfRange,
  unreadable,
  isHighDuplicateRatio,
}: {
  duplicateRows: number;
  duplicateMatches: number;
  invalid: number;
  missing: number;
  genderMismatch: number;
  ageOutOfRange: number;
  outOfRange: number;
  unreadable: number;
  isHighDuplicateRatio: boolean;
}): JSX.Element {
  const groups = [
    {
      icon: <Layers size={14} aria-hidden />,
      title: 'التكرار',
      tone: isHighDuplicateRatio ? 'danger' : 'warning',
      items: [
        { label: 'داخل الملف', value: duplicateRows },
        { label: 'مطابقات سابقة', value: duplicateMatches },
      ],
    },
    {
      icon: <AlertTriangle size={14} aria-hidden />,
      title: 'بيانات ناقصة',
      tone: 'danger',
      items: [
        { label: 'رقم قومي غير صالح', value: invalid },
        { label: 'حقول فارغة', value: missing },
        { label: 'قيم غير مقروءة', value: unreadable },
      ],
    },
    {
      icon: <Activity size={14} aria-hidden />,
      title: 'مطابقة الإعدادات',
      tone: 'danger',
      items: [
        { label: 'نوع غير مطابق', value: genderMismatch },
        { label: 'سن خارج الإعدادات', value: ageOutOfRange },
        { label: 'درجة متجاوزة', value: outOfRange },
      ],
    },
  ] as const;

  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.value > 0),
    }))
    .filter((group) => group.items.length > 0);

  if (visibleGroups.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-success bg-success-bg px-3.5 py-3 text-xs text-success">
        <ShieldCheck size={14} aria-hidden />
        لا توجد ملاحظات حرجة في المراجعة.
      </div>
    );
  }

  return (
    <section className="rounded-md border border-border-subtle bg-white px-3.5 py-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-ink-700">
        <AlertTriangle size={14} aria-hidden className="text-terra-600" />
        ملاحظات المراجعة
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {visibleGroups.map((group) => (
          <div
            key={group.title}
            className="rounded-md border border-border-subtle bg-ink-50/50 px-3 py-2.5"
          >
            <div
              className={cn(
                'mb-2 flex items-center gap-1.5 text-2xs font-bold',
                group.tone === 'warning' ? 'text-gold-700' : 'text-terra-700',
              )}
            >
              {group.icon}
              {group.title}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {group.items.map((item) => (
                <span
                  key={item.label}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-2xs',
                    group.tone === 'warning'
                      ? 'border-gold-200 bg-gold-50 text-gold-800'
                      : 'border-terra-100 bg-terra-50 text-terra-800',
                  )}
                >
                  <strong className="font-en text-xs tabular-nums">
                    {item.value.toLocaleString('en')}
                  </strong>
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
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
