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
  MoreVertical,
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
  DropdownMenu,
  EmptyState,
  LoadingState,
  PageHeader,
  StatCard,
} from '@/shared/components';
import type { DataTableColumn, DataTableSort } from '@/shared/components';
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
  /**
   * Sort state. `null` means "use the default", which sorts by effective
   * percentage descending (the most useful default for admins triaging
   * who's at risk on the cutoff). Clicking a sortable header cycles
   * asc → desc → null (back to default) — DataTable already emits the
   * null transition on the third click.
   */
  const [sort, setSort] = useState<DataTableSort<DerivedRow> | null>(null);

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

  /**
   * Apply the active sort. When no explicit sort is set, fall back to
   * effective-percentage descending so the table always lands on a
   * meaningful order. Arabic name sort uses `localeCompare` with the
   * `ar` locale + `sensitivity: 'base'` so the canonical Arabic
   * collation rules apply (matching the SQL Server `Arabic_CI_AI`
   * collation we'll plug into on integration day).
   */
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const active = sort ?? ({ key: 'effPct', direction: 'desc' } as const);
    const dir = active.direction === 'asc' ? 1 : -1;
    const cmp = (a: DerivedRow, b: DerivedRow): number => {
      switch (active.key) {
        case 'name':
          return a.name.localeCompare(b.name, 'ar', { sensitivity: 'base' }) * dir;
        case 'branch':
          return a.branch.localeCompare(b.branch, 'ar', { sensitivity: 'base' }) * dir;
        case 'kind':
          return a.kind.localeCompare(b.kind) * dir;
        case 'nid':
          return a.nid.localeCompare(b.nid) * dir;
        case 'total':
          return (a.total - b.total) * dir;
        case 'pct':
          return (a.pct - b.pct) * dir;
        case 'eff':
          return (a.eff - b.eff) * dir;
        case 'effPct':
          return (a.effPct - b.effPct) * dir;
        default:
          return 0;
      }
    };
    arr.sort(cmp);
    return arr;
  }, [filtered, sort]);

  const columns: DataTableColumn<DerivedRow>[] = [
    {
      key: 'nid',
      label: 'الرقم القومي',
      sortable: true,
      className: 'min-w-[14ch]',
      render: (r) => (
        <span className="font-mono text-2xs text-ink-600" dir="ltr">
          {r.nid}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'الاسم',
      sortable: true,
      className: 'min-w-[18ch] whitespace-normal',
      render: (r) => <span className="font-medium text-ink-900">{r.name}</span>,
    },
    {
      key: 'kind',
      label: 'النوع',
      align: 'center',
      sortable: true,
      className: 'min-w-[6ch]',
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
      sortable: true,
      className: 'min-w-[10ch]',
      render: (r) => <span className="text-xs">{r.branch}</span>,
    },
    {
      key: 'total',
      label: 'المجموع',
      numeric: true,
      sortable: true,
      className: 'min-w-[8ch]',
      render: (r) => (
        /* Plain inline content. The cell already applies `text-end` +
         * `font-numeric tnum` via `numeric: true`, so the line naturally
         * end-aligns to the column edge — same edge the header label
         * sits on. No inline-flex wrapper here (it was anchoring to a
         * shrink-to-fit width that drifted off the header position). */
        <>
          <span className="font-semibold text-ink-900">{r.total}</span>
          {r.isOverridden && (
            <span
              className="mx-1 rounded-full bg-gold-100 px-1.5 py-px text-2xs font-semibold text-gold-700"
              title={`الأصلي: ${r.importMax} · المعدّل: ${r.max}`}
            >
              معدّل
            </span>
          )}
          <span className="text-2xs text-ink-300"> / </span>
          <span
            className={`text-2xs ${r.isOverridden ? 'font-semibold text-gold-700' : 'text-ink-400'}`}
            title={r.isOverridden ? `الأصلي: ${r.importMax} · المعدّل: ${r.max}` : undefined}
          >
            {r.max}
          </span>
        </>
      ),
    },
    {
      key: 'pct',
      label: 'النسبة',
      numeric: true,
      sortable: true,
      className: 'min-w-[8ch]',
      render: (r) => (
        <>
          <span className="font-semibold text-ink-900">{r.pct.toFixed(2)}</span>
          <span className="text-2xs text-ink-400">٪</span>
        </>
      ),
    },
    {
      key: 'eff',
      label: 'الفعلي',
      numeric: true,
      sortable: true,
      className: 'min-w-[8ch]',
      render: (r) => (
        /* Two-line stack + optional diff badge. Use a full-width flex
         * so the stack's end edge lands at the cell's end (= the same
         * column edge the header label sits on). The badge sits to the
         * inline-start of the stack and never pushes the numbers. */
        <span className="flex items-center justify-end gap-2">
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
          <span className="flex flex-col items-end gap-px leading-tight">
            <span
              className={`font-bold ${
                r.adj > 0 ? 'text-gold-700' : r.adj < 0 ? 'text-terra-700' : 'text-ink-900'
              }`}
            >
              {r.eff}
            </span>
            <span
              className={`text-2xs ${
                r.adj > 0 ? 'text-gold-700' : r.adj < 0 ? 'text-terra-700' : 'text-ink-500'
              }`}
            >
              {r.effPct.toFixed(2)}٪
            </span>
          </span>
        </span>
      ),
    },
    {
      key: 'actions',
      label: <span className="sr-only">إجراءات</span>,
      align: 'center',
      className: 'min-w-[5ch]',
      render: (r) => <RowActions row={r} onSelect={setOverlay} />,
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
              label="إجمالي الطلاب"
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
                <div className="search flex-1" style={{ minInlineSize: 420 }}>
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
                  /* Default `.select` is 180-200px; the longest option
                   * "ثانوية أزهرية · NNN" wraps at that width on every
                   * viewport — widen to 220px so the chevron and the
                   * label have breathing room. */
                  style={{ minWidth: 220, flexBasis: 220 }}
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
                data={sorted}
                columns={columns}
                rowKey={(r) => r.seat}
                sort={sort}
                onSortChange={setSort}
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

/**
 * RowActions — three-dots-vertical kebab opening a DropdownMenu with
 * the three per-row affordances (add-adjustment / log / details).
 *
 * The kebab itself is always visible so the affordance can be discovered
 * at rest (unlike the earlier amber dot, which was too subtle on
 * non-overridden rows). Rows that already carry adjustments show a 6×6
 * gold dot on the top-end corner with a `يوجد تعديلات` tooltip — same
 * pattern as the notification-bell unread indicator in AppShell.
 *
 * The wrapping `<span>` stops click-bubble so opening the menu doesn't
 * also fire the row's `onRowClick` (which opens the details drawer).
 */
function RowActions({
  row,
  onSelect,
}: {
  row: DerivedRow;
  onSelect: (next: OverlayState) => void;
}): JSX.Element {
  const hasAdjustments = row.log.length > 0;
  return (
    <span
      className="relative inline-flex"
      onClick={(e) => e.stopPropagation()}
      title={hasAdjustments ? 'يوجد تعديلات' : undefined}
    >
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="إجراءات"
            className="!h-8 !w-8 !text-ink-500 hover:!bg-ink-100/60 hover:!text-ink-900 focus-visible:!bg-ink-100/60"
          >
            <MoreVertical size={16} strokeWidth={1.75} aria-hidden />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content sideOffset={6}>
          <DropdownMenu.Item
            leadingIcon={<Plus size={14} strokeWidth={1.75} className="text-teal-700" aria-hidden />}
            onSelect={() => onSelect({ kind: 'add-adj', seat: row.seat })}
          >
            إضافة تعديل
          </DropdownMenu.Item>
          <DropdownMenu.Item
            leadingIcon={<History size={14} strokeWidth={1.75} className="text-gold-700" aria-hidden />}
            shortcut={
              hasAdjustments ? (
                <span className="font-en font-semibold text-gold-700 tabular-nums">
                  {row.log.length}
                </span>
              ) : undefined
            }
            onSelect={() => onSelect({ kind: 'log', seat: row.seat })}
          >
            عرض السجل
          </DropdownMenu.Item>
          <DropdownMenu.Item
            leadingIcon={<Eye size={14} strokeWidth={1.75} className="text-ink-600" aria-hidden />}
            onSelect={() => onSelect({ kind: 'student', seat: row.seat })}
          >
            تفاصيل الطالب
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
      {hasAdjustments && (
        <span
          aria-hidden
          className="pointer-events-none absolute -end-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-gold-500 ring-2 ring-white"
        />
      )}
    </span>
  );
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

