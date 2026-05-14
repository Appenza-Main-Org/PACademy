/**
 * ApplicantGradesPage — admin landing for the grades import + adjustment
 * surface.
 *
 * Three states served by the same component:
 *   • loading  — LoadingState (page variant) while initial query is in flight
 *   • empty    — illustration + import CTA + required-columns hint card
 *   • full     — StatCard strip + Card-wrapped filters + DataTable<DerivedRow>
 *                with inline row-level actions (add adj / log / details).
 *
 * Conforms to the existing admin chrome: `.filters` + `.input` + `.select`
 * legacy CSS classes for the toolbar, shared `Card` / `StatCard` /
 * `DataTable` primitives instead of bespoke ones.
 */

import { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Eye,
  FileSpreadsheet,
  History,
  Info,
  Layers,
  Plus,
  Search,
  Upload,
  X,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  DataTable,
  EmptyState,
  LoadingState,
  PageHeader,
  StatCard,
} from '@/shared/components';
import type { DataTableColumn } from '@/shared/components';
import { useGrades } from '../api/grades.queries';
import { AddAdjustmentDialog } from '../components/AddAdjustmentDialog';
import { ImportWizard } from '../components/ImportWizard';
import { LogDrawer } from '../components/LogDrawer';
import { StudentDetailsDrawer } from '../components/StudentDetailsDrawer';
import { arNormalize, deriveRow, type DerivedRow } from '../lib/derive';

type OverlayState =
  | { kind: 'import' }
  | { kind: 'add-adj'; seat: number }
  | { kind: 'log'; seat: number }
  | { kind: 'student'; seat: number }
  | null;

export function ApplicantGradesPage(): JSX.Element {
  const { data, isLoading } = useGrades();
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | 'general' | 'azhar'>('all');
  const [overlay, setOverlay] = useState<OverlayState>(null);

  const derived = useMemo<DerivedRow[]>(() => (data ?? []).map(deriveRow), [data]);

  const searchN = useMemo(() => arNormalize(search), [search]);
  const filtered = useMemo(() => {
    let out = derived;
    if (kindFilter !== 'all') out = out.filter((r) => r.kind === kindFilter);
    if (searchN) {
      const s = search.trim();
      out = out.filter((r) => {
        if (arNormalize(r.name).includes(searchN)) return true;
        if (r.nid.includes(s)) return true;
        if (String(r.seat).includes(s)) return true;
        /* Seat / school / region / status are no longer visible columns
         * (per the polish pass), but stay searchable from the toolbar
         * so admins can still locate a student by any of them. */
        if (arNormalize(r.school).includes(searchN)) return true;
        if (arNormalize(r.region).includes(searchN)) return true;
        if (arNormalize(r.status).includes(searchN)) return true;
        return false;
      });
    }
    return out;
  }, [derived, kindFilter, searchN, search]);

  const matchCounts = useMemo(() => {
    if (!search.trim()) return { name: 0, nid: 0, seat: 0, other: 0 };
    const s = search.trim();
    const n = arNormalize(s);
    return {
      name: derived.filter((r) => arNormalize(r.name).includes(n)).length,
      nid: derived.filter((r) => r.nid.includes(s)).length,
      seat: derived.filter((r) => String(r.seat).includes(s)).length,
      /* Aggregate match count for the three hidden but searchable fields. */
      other: derived.filter((r) =>
        arNormalize(r.school).includes(n)
        || arNormalize(r.region).includes(n)
        || arNormalize(r.status).includes(n),
      ).length,
    };
  }, [derived, search]);

  const stats = useMemo(() => {
    const total = derived.length;
    const general = derived.filter((r) => r.kind === 'general').length;
    const azhar = derived.filter((r) => r.kind === 'azhar').length;
    const withAdj = derived.filter((r) => r.adj !== 0).length;
    return { total, general, azhar, withAdj };
  }, [derived]);

  const activeRow =
    overlay && 'seat' in overlay ? derived.find((r) => r.seat === overlay.seat) ?? null : null;

  const columns: DataTableColumn<DerivedRow>[] = [
    {
      key: 'nid',
      label: 'الرقم القومي',
      render: (r) => (
        <span className="font-mono text-2xs text-ink-600" dir="ltr">
          {r.nid}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'الاسم',
      render: (r) => <span className="font-medium text-ink-900">{r.name}</span>,
    },
    {
      key: 'kind',
      label: 'النوع',
      align: 'center',
      render: (r) => (
        <Badge tone={r.kind === 'general' ? 'info' : 'warning'}>
          {r.kind === 'general' ? 'عامة' : 'أزهرية'}
        </Badge>
      ),
    },
    {
      key: 'branch',
      label: 'الشعبة',
      hideOn: 'md',
      render: (r) => <span className="text-xs">{r.branch}</span>,
    },
    {
      key: 'total',
      label: 'المجموع',
      numeric: true,
      render: (r) => (
        <span className="inline-flex items-baseline justify-end gap-1">
          <span className="font-numeric font-semibold tabular-nums">{r.total}</span>
          <span className="text-2xs text-ink-300">/</span>
          <span
            className={`font-numeric tabular-nums text-2xs ${r.isOverridden ? 'font-semibold text-gold-700' : 'text-ink-400'}`}
            title={r.isOverridden ? `الأصلي: ${r.importMax} · المعدّل: ${r.max}` : undefined}
          >
            {r.max}
          </span>
          {r.isOverridden && (
            <Badge tone="warning" className="ms-1 !px-1.5 !py-0 !text-2xs">
              معدّل
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: 'pct',
      label: 'النسبة',
      numeric: true,
      render: (r) => (
        <>
          <span className="font-numeric font-semibold tabular-nums text-ink-900">
            {r.pct.toFixed(2)}
          </span>
          <span className="text-2xs text-ink-400">٪</span>
        </>
      ),
    },
    {
      key: 'eff',
      label: 'الفعلي',
      numeric: true,
      render: (r) => (
        <div className="inline-flex flex-col items-end leading-tight">
          <span className="inline-flex items-center gap-1">
            {r.adj !== 0 && (
              <Badge
                tone={r.adj > 0 ? 'warning' : 'danger'}
                icon={
                  r.adj > 0 ? (
                    <ArrowUpRight size={9} strokeWidth={2.5} aria-hidden />
                  ) : (
                    <ArrowDownRight size={9} strokeWidth={2.5} aria-hidden />
                  )
                }
                className="!px-1.5 !py-0 !text-2xs"
              >
                <span className="font-numeric tabular-nums">{Math.abs(r.adj)}</span>
              </Badge>
            )}
            <span
              className={`font-numeric font-bold tabular-nums ${
                r.adj > 0 ? 'text-gold-700' : r.adj < 0 ? 'text-terra-700' : 'text-ink-900'
              }`}
            >
              {r.eff}
            </span>
          </span>
          <span
            className={`font-numeric tabular-nums text-2xs ${
              r.adj > 0 ? 'text-gold-700' : r.adj < 0 ? 'text-terra-700' : 'text-ink-500'
            }`}
          >
            {r.effPct.toFixed(2)}٪
          </span>
        </div>
      ),
    },
    {
      key: 'actions',
      label: <span className="sr-only">إجراءات</span>,
      align: 'center',
      render: (r) => (
        <div
          className="inline-flex justify-center gap-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon"
            aria-label="إضافة تعديل"
            title="إضافة تعديل"
            className="!h-7 !w-7 !text-teal-700 hover:!bg-teal-50"
            onClick={() => setOverlay({ kind: 'add-adj', seat: r.seat })}
          >
            <Plus size={14} strokeWidth={1.75} />
          </Button>
          <span className="relative inline-flex">
            <Button
              variant="ghost"
              size="icon"
              aria-label="عرض السجل"
              title="عرض السجل"
              className="!h-7 !w-7 !text-gold-700 hover:!bg-gold-50"
              onClick={() => setOverlay({ kind: 'log', seat: r.seat })}
            >
              <History size={14} strokeWidth={1.75} />
            </Button>
            {r.log.length > 0 && (
              <span
                aria-hidden
                className="absolute -end-0.5 -top-0.5 grid h-3 min-w-[12px] place-items-center rounded-full border border-white bg-gold-500 px-1 font-numeric text-[9px] font-bold tabular-nums text-white"
              >
                {r.log.length}
              </span>
            )}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="تفاصيل الطالب"
            title="تفاصيل الطالب"
            className="!h-7 !w-7"
            onClick={() => setOverlay({ kind: 'student', seat: r.seat })}
          >
            <Eye size={14} strokeWidth={1.75} />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div>
        <PageHeader
          title="درجات المتقدمين"
          subtitle="استيراد درجات الطلاب من ملفات Excel وإدارة التعديلات"
        />
        <LoadingState variant="page" />
      </div>
    );
  }

  const isEmpty = derived.length === 0;

  return (
    <div>
      <PageHeader
        title="درجات المتقدمين"
        subtitle="استيراد درجات الطلاب من ملفات Excel وإدارة التعديلات"
        actions={
          <>
            {!isEmpty && (
              <Button variant="secondary" leadingIcon={<Download size={14} strokeWidth={1.75} />}>
                تصدير
              </Button>
            )}
            {isEmpty && (
              <Button variant="ghost" leadingIcon={<Download size={14} strokeWidth={1.75} />}>
                تنزيل القالب
              </Button>
            )}
            <Button
              variant="primary"
              leadingIcon={<Upload size={14} strokeWidth={1.75} />}
              onClick={() => setOverlay({ kind: 'import' })}
            >
              استيراد ملف
            </Button>
          </>
        }
      />

      {isEmpty ? (
        <EmptyGradesCard onImport={() => setOverlay({ kind: 'import' })} />
      ) : (
        <>
          <div
            className="mb-6 grid gap-5"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
          >
            <StatCard
              label="إجمالي الصفوف"
              value={stats.total}
              icon={<Layers size={16} strokeWidth={1.75} />}
            />
            <StatCard
              label="ثانوية عامة"
              value={stats.general}
              icon={<FileSpreadsheet size={16} strokeWidth={1.75} />}
              iconBg="var(--teal-50)"
              iconColor="var(--teal-700)"
              trend={pctTrend(stats.general, stats.total)}
            />
            <StatCard
              label="ثانوية أزهرية"
              value={stats.azhar}
              icon={<FileSpreadsheet size={16} strokeWidth={1.75} />}
              iconBg="var(--gold-50)"
              iconColor="var(--gold-700)"
              trend={pctTrend(stats.azhar, stats.total)}
            />
            <StatCard
              label="صفوف بها تعديلات"
              value={stats.withAdj}
              icon={<History size={16} strokeWidth={1.75} />}
              iconBg="var(--gold-50)"
              iconColor="var(--gold-700)"
            />
          </div>

          <Card>
            <CardBody className="card-body">
              <div className="filters">
                <div className="search flex-1">
                  <input
                    className="input"
                    type="search"
                    placeholder="بحث بالاسم / الرقم القومي / رقم الجلوس"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="بحث"
                  />
                  <Search size={18} />
                </div>
                <select
                  className="select"
                  value={kindFilter}
                  onChange={(e) => setKindFilter(e.target.value as typeof kindFilter)}
                  aria-label="تصفية حسب نوع الثانوية"
                >
                  <option value="all">كل الأنواع · {stats.total}</option>
                  <option value="general">ثانوية عامة · {stats.general}</option>
                  <option value="azhar">ثانوية أزهرية · {stats.azhar}</option>
                </select>
                <span className="ms-auto self-center text-2xs text-ink-500">
                  <span className="font-numeric font-medium tabular-nums text-ink-700">
                    {filtered.length}
                  </span>{' '}
                  نتيجة من{' '}
                  <span className="font-numeric font-medium tabular-nums text-ink-700">
                    {stats.total}
                  </span>
                </span>
              </div>

              {search.trim() && (
                <div className="mb-4 flex flex-wrap items-center gap-1.5 text-2xs text-ink-500">
                  <span>طابق</span>
                  <MatchChip label="الاسم" count={matchCounts.name} />
                  <MatchChip label="الرقم القومي" count={matchCounts.nid} />
                  <MatchChip label="رقم الجلوس" count={matchCounts.seat} />
                  <MatchChip label="المدرسة / المنطقة / الحالة" count={matchCounts.other} />
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="ms-1 inline-flex cursor-pointer items-center gap-1 rounded-full border-0 bg-transparent px-1.5 py-0.5 text-2xs text-teal-700 hover:bg-teal-50"
                  >
                    <X size={11} strokeWidth={1.75} aria-hidden /> مسح
                  </button>
                </div>
              )}

              <DataTable<DerivedRow>
                data={filtered}
                columns={columns}
                rowKey={(r) => r.seat}
                onRowClick={(r) => setOverlay({ kind: 'student', seat: r.seat })}
                empty={
                  <EmptyState
                    variant="generic"
                    title="لا نتائج مطابقة"
                    description={
                      search.trim()
                        ? `لا توجد صفوف مطابقة للبحث «${search}»`
                        : 'لا توجد صفوف مطابقة للتصفية الحالية'
                    }
                    icon={<Search size={28} strokeWidth={1.5} />}
                    action={
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setSearch('');
                          setKindFilter('all');
                        }}
                      >
                        مسح التصفية
                      </Button>
                    }
                  />
                }
                zebraStripes
                stickyHeader
                density="compact"
              />
            </CardBody>
          </Card>
        </>
      )}

      <ImportWizard open={overlay?.kind === 'import'} onClose={() => setOverlay(null)} />

      {activeRow && (
        <>
          <AddAdjustmentDialog
            open={overlay?.kind === 'add-adj'}
            onClose={() => setOverlay(null)}
            row={activeRow}
          />
          <LogDrawer
            open={overlay?.kind === 'log'}
            onClose={() => setOverlay(null)}
            row={activeRow}
            onAddAdjustment={() => setOverlay({ kind: 'add-adj', seat: activeRow.seat })}
            onOpenDetails={() => setOverlay({ kind: 'student', seat: activeRow.seat })}
          />
          <StudentDetailsDrawer
            open={overlay?.kind === 'student'}
            onClose={() => setOverlay(null)}
            row={activeRow}
            onAddAdjustment={() => setOverlay({ kind: 'add-adj', seat: activeRow.seat })}
          />
        </>
      )}
    </div>
  );
}

function pctTrend(part: number, total: number): { label: string; tone: 'neutral' } | undefined {
  if (!total) return undefined;
  const v = Math.round((part / total) * 100);
  return { label: `${v}٪ من الإجمالي`, tone: 'neutral' };
}

/* ────────────────────────────────────────────────────────────────────── */

function MatchChip({ label, count }: { label: string; count: number }): JSX.Element {
  const active = count > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs ${
        active
          ? 'border-teal-100 bg-teal-50 font-semibold text-teal-700'
          : 'border-transparent bg-ink-50 font-medium text-ink-500'
      }`}
    >
      {label}
      <span
        className={`font-numeric text-2xs font-semibold tabular-nums ${
          active ? 'text-teal-700' : 'text-ink-400'
        }`}
      >
        {count}
      </span>
    </span>
  );
}

function EmptyGradesCard({ onImport }: { onImport: () => void }): JSX.Element {
  return (
    <Card>
      <CardBody className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <svg width="120" height="96" viewBox="0 0 120 96" aria-hidden>
          <rect width="120" height="96" rx="8" fill="var(--ink-50)" />
          <rect
            x="22"
            y="18"
            width="76"
            height="60"
            rx="4"
            fill="#fff"
            stroke="var(--gold-500)"
            strokeWidth="1.25"
          />
          <path
            d="M86 18 L98 30 L86 30 Z"
            fill="var(--gold-100)"
            stroke="var(--gold-500)"
            strokeWidth="1.25"
          />
          <line x1="22" y1="32" x2="98" y2="32" stroke="var(--ink-200)" strokeWidth="0.75" />
          <line x1="22" y1="44" x2="98" y2="44" stroke="var(--ink-200)" strokeWidth="0.75" />
          <line x1="22" y1="56" x2="98" y2="56" stroke="var(--ink-200)" strokeWidth="0.75" />
          <line x1="22" y1="68" x2="98" y2="68" stroke="var(--ink-200)" strokeWidth="0.75" />
          <line x1="48" y1="32" x2="48" y2="78" stroke="var(--ink-200)" strokeWidth="0.75" />
          <line x1="72" y1="32" x2="72" y2="78" stroke="var(--ink-200)" strokeWidth="0.75" />
          <circle cx="60" cy="48" r="14" fill="var(--teal-50)" stroke="var(--teal-500)" strokeWidth="1.25" />
          <path
            d="M60 54 L60 42 M55 47 L60 42 L65 47"
            fill="none"
            stroke="var(--teal-600)"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <h2 className="mb-1.5 mt-5 font-ar-display text-lg font-bold text-ink-900">
          لا توجد درجات مستوردة بعد
        </h2>
        <p className="m-0 max-w-[420px] text-sm text-ink-500">
          ابدأ بـ«استيراد ملف» لرفع كشف درجات الثانوية العامة أو الأزهرية. يدعم الملف صيغ{' '}
          <span className="font-numeric tabular-nums">.xlsx</span> و
          <span className="font-numeric tabular-nums">.xls</span> حتى ١٠ ميجا.
        </p>
        <div className="mt-6 flex gap-2.5">
          <Button variant="primary" leadingIcon={<Upload size={14} strokeWidth={1.75} />} onClick={onImport}>
            استيراد ملف
          </Button>
          <Button variant="ghost" leadingIcon={<Download size={14} strokeWidth={1.75} />}>
            تنزيل قالب نموذجي
          </Button>
        </div>

        <div className="mt-8 w-full max-w-[600px] rounded-md border border-gold-200 bg-gold-50 px-5 py-3.5 text-start">
          <div className="mb-2.5 flex items-center gap-2">
            <Info size={14} strokeWidth={1.75} className="text-gold-700" aria-hidden />
            <span className="text-xs font-semibold text-gold-700">
              أسماء الأعمدة المطلوبة في الملف
            </span>
          </div>
          <div className="grid gap-3.5 text-xs sm:grid-cols-2">
            <div>
              <div className="mb-1 font-semibold text-gold-700">ثانوية عامة</div>
              <div className="font-mono text-2xs leading-relaxed text-ink-600">
                seating_no · national_no · arabic_name · sex_name · school_name · branch_desc_new
                · total_degree · student_case_desc
              </div>
            </div>
            <div>
              <div className="mb-1 font-semibold text-gold-700">ثانوية أزهرية</div>
              <div className="font-mono text-2xs leading-relaxed text-ink-600">
                StSeatNo · StudenName · DevisionName · National_Code · ZonName · InstituteName · Total2
              </div>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

