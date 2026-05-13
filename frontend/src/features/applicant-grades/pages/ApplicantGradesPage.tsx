/**
 * ApplicantGradesPage — admin landing for the grades import + adjustment
 * surface.
 *
 * Three states served by the same component:
 *   • loading  — Skeleton card while the initial query is in flight
 *   • empty    — illustration + import CTA + required-columns hint card
 *   • full     — stats strip + toolbar (search + kind segmented filter) +
 *                table with inline row-level actions (add adj / log / details)
 *
 * Per the design's interactive prototype, clicking a row anywhere outside
 * the action column opens the StudentDetailsDrawer; the three icon actions
 * stop event propagation so they don't also open the drawer.
 */

import { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  History,
  Info,
  Plus,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { Badge, Button, Input, LoadingState, PageHeader } from '@/shared/components';
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
      out = out.filter((r) => {
        if (arNormalize(r.name).includes(searchN)) return true;
        if (r.nid.includes(search.trim())) return true;
        if (String(r.seat).includes(search.trim())) return true;
        return false;
      });
    }
    return out;
  }, [derived, kindFilter, searchN, search]);

  const matchCounts = useMemo(() => {
    if (!search.trim()) return { name: 0, nid: 0, seat: 0 };
    const s = search.trim();
    const n = arNormalize(s);
    return {
      name: derived.filter((r) => arNormalize(r.name).includes(n)).length,
      nid: derived.filter((r) => r.nid.includes(s)).length,
      seat: derived.filter((r) => String(r.seat).includes(s)).length,
    };
  }, [derived, search]);

  const stats = useMemo(() => {
    const total = derived.length;
    const general = derived.filter((r) => r.kind === 'general').length;
    const azhar = derived.filter((r) => r.kind === 'azhar').length;
    const withAdj = derived.filter((r) => r.adj !== 0).length;
    const ups = derived.filter((r) => r.adj > 0).length;
    const downs = derived.filter((r) => r.adj < 0).length;
    return { total, general, azhar, withAdj, ups, downs };
  }, [derived]);

  const activeRow =
    overlay && 'seat' in overlay ? derived.find((r) => r.seat === overlay.seat) ?? null : null;

  if (isLoading) {
    return (
      <>
        <PageHeader
          title="درجات المتقدمين"
          subtitle="استيراد درجات الطلاب من ملفات Excel وإدارة التعديلات."
          breadcrumbs={[
            { label: 'الإدارة' },
            { label: 'التقديم' },
            { label: 'درجات المتقدمين' },
          ]}
        />
        <LoadingState variant="table" />
      </>
    );
  }

  const isEmpty = derived.length === 0;

  return (
    <>
      <PageHeader
        title="درجات المتقدمين"
        subtitle="استيراد درجات الطلاب من ملفات Excel وإدارة التعديلات."
        breadcrumbs={[
          { label: 'الإدارة' },
          { label: 'التقديم' },
          { label: 'درجات المتقدمين' },
        ]}
        actions={
          <>
            {!isEmpty && (
              <Button variant="secondary" leadingIcon={<Download size={14} />}>
                تصدير
              </Button>
            )}
            {isEmpty && (
              <Button variant="ghost" leadingIcon={<Download size={14} />}>
                تنزيل القالب
              </Button>
            )}
            <Button
              variant="primary"
              leadingIcon={<Upload size={14} />}
              onClick={() => setOverlay({ kind: 'import' })}
            >
              استيراد ملف
            </Button>
          </>
        }
      />

      {isEmpty ? (
        <EmptyState onImport={() => setOverlay({ kind: 'import' })} />
      ) : (
        <>
          {/* Stats */}
          <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <StatCard label="إجمالي الصفوف" value={String(stats.total)} />
            <StatCard
              label="ثانوية عامة"
              value={String(stats.general)}
              fg="var(--teal-700)"
              sub={pct(stats.general, stats.total)}
            />
            <StatCard
              label="ثانوية أزهرية"
              value={String(stats.azhar)}
              fg="var(--gold-700)"
              sub={pct(stats.azhar, stats.total)}
            />
            <StatCard
              label="صفوف بها تعديلات"
              value={String(stats.withAdj)}
              fg="var(--gold-700)"
              bg="var(--gold-50)"
              sub={
                <span>
                  <span className="font-en">{stats.ups}</span>+ ·{' '}
                  <span className="font-en">{stats.downs}</span>−
                </span>
              }
            />
          </div>

          {/* Toolbar */}
          <div className="mt-3.5 flex flex-wrap items-start gap-2.5 rounded-md border border-border-subtle bg-surface-card px-3 py-2.5">
            <div className="flex max-w-[460px] flex-1 basis-[360px] flex-col gap-1.5">
              <Input
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
                leadingIcon={<Search size={14} />}
                placeholder="ابحث بالاسم أو الرقم القومي أو رقم الجلوس…"
                trailingIcon={
                  search ? (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      aria-label="مسح"
                      className="grid h-4 w-4 cursor-pointer place-items-center border-0 bg-transparent p-0 text-ink-500"
                    >
                      <X size={14} />
                    </button>
                  ) : (
                    <kbd className="rounded-sm border border-border-default bg-ink-50 px-1.5 py-px font-en text-2xs text-ink-500">
                      ⌘K
                    </kbd>
                  )
                }
              />
              {search.trim() && (
                <div className="flex items-center gap-1.5 text-2xs text-ink-500">
                  <span>طابق</span>
                  <MatchChip label="الاسم" count={matchCounts.name} />
                  <MatchChip label="الرقم القومي" count={matchCounts.nid} />
                  <MatchChip label="رقم الجلوس" count={matchCounts.seat} />
                </div>
              )}
            </div>

            <div
              role="group"
              className="inline-flex gap-0.5 self-start rounded-full border border-border-default bg-ink-50 p-0.5"
            >
              {(
                [
                  { v: 'all', label: 'الكل', count: stats.total },
                  { v: 'general', label: 'ثانوية عامة', count: stats.general },
                  { v: 'azhar', label: 'ثانوية أزهرية', count: stats.azhar },
                ] as const
              ).map(({ v, label, count }) => {
                const active = kindFilter === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setKindFilter(v)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border-0 px-3 py-1 text-xs font-medium transition-colors"
                    style={{
                      background: active ? 'var(--teal-500)' : 'transparent',
                      color: active ? '#fff' : 'var(--ink-700)',
                    }}
                  >
                    {label}
                    <span
                      className="rounded-full px-1.5 py-0 font-en text-2xs"
                      style={{
                        background: active ? 'rgba(255,255,255,0.18)' : 'var(--ink-100)',
                        color: active ? '#fff' : 'var(--ink-500)',
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <span className="ms-auto self-start pt-2 text-2xs text-ink-500">
              <span className="font-en font-medium text-ink-700">{filtered.length}</span> نتيجة من{' '}
              <span className="font-en font-medium text-ink-700">{stats.total}</span>
            </span>
          </div>

          {/* Table */}
          <div className="mt-3.5 overflow-hidden rounded-md border border-border-subtle bg-surface-card">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: 80 }} />
                  <col style={{ width: 128 }} />
                  <col style={{ width: 200 }} />
                  <col style={{ width: 64 }} />
                  <col style={{ width: 96 }} />
                  <col style={{ width: 'auto' }} />
                  <col style={{ width: 96 }} />
                  <col style={{ width: 76 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 124 }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-sunken">
                    <Th numeric>رقم الجلوس</Th>
                    <Th>الرقم القومي</Th>
                    <Th>الاسم</Th>
                    <Th>النوع</Th>
                    <Th>الشعبة</Th>
                    <Th>المدرسة / المنطقة</Th>
                    <Th numeric>المجموع</Th>
                    <Th numeric>النسبة</Th>
                    <Th numeric>الفعلي</Th>
                    <Th>الحالة</Th>
                    <Th align="center">إجراءات</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={11}
                        className="bg-white px-4 py-12 text-center text-ink-500"
                      >
                        <div className="mb-1.5 text-sm font-semibold text-ink-700">
                          لا نتائج مطابقة
                        </div>
                        <div className="text-xs">
                          جرّب تعديل البحث «<strong>{search}</strong>» أو تصفية مختلفة.{' '}
                          <button
                            onClick={() => {
                              setSearch('');
                              setKindFilter('all');
                            }}
                            className="ms-1.5 cursor-pointer border-0 bg-transparent text-xs font-semibold text-teal-700"
                          >
                            مسح التصفية
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r, i) => (
                      <Row
                        key={r.seat}
                        r={r}
                        index={i}
                        onAddAdj={() => setOverlay({ kind: 'add-adj', seat: r.seat })}
                        onOpenLog={() => setOverlay({ kind: 'log', seat: r.seat })}
                        onOpenDetails={() => setOverlay({ kind: 'student', seat: r.seat })}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-border-subtle px-3.5 py-2.5 text-2xs text-ink-600">
              <div className="flex items-center gap-3">
                <span>الصفوف لكل صفحة</span>
                <select
                  defaultValue="25"
                  className="h-7 cursor-pointer rounded-md border border-border-default bg-white px-2 font-en text-xs text-ink-900 outline-none"
                  aria-label="عدد الصفوف لكل صفحة"
                >
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
                <span>·</span>
                <span>
                  الصفحة <span className="font-en font-semibold text-ink-900">1</span> من{' '}
                  <span className="font-en">1</span>
                </span>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="secondary" disabled leadingIcon={<ChevronRight size={14} />}>
                  السابق
                </Button>
                <Button size="sm" variant="secondary" disabled trailingIcon={<ChevronLeft size={14} />}>
                  التالي
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Overlays */}
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
    </>
  );
}

function pct(part: number, total: number): string | null {
  if (!total) return null;
  return Math.round((part / total) * 100) + '٪';
}

/* ────────────────────────────────────────────────────────────────────── */

function EmptyState({ onImport }: { onImport: () => void }): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border-subtle bg-surface-card px-6 py-16 text-center shadow-xs">
      <svg width="120" height="96" viewBox="0 0 120 96" aria-hidden>
        <rect width="120" height="96" rx="8" fill="var(--ink-50)" />
        <rect x="22" y="18" width="76" height="60" rx="4" fill="#fff" stroke="var(--gold-500)" strokeWidth="1.25" />
        <path d="M86 18 L98 30 L86 30 Z" fill="var(--gold-100)" stroke="var(--gold-500)" strokeWidth="1.25" />
        <line x1="22" y1="32" x2="98" y2="32" stroke="var(--ink-200)" strokeWidth="0.75" />
        <line x1="22" y1="44" x2="98" y2="44" stroke="var(--ink-200)" strokeWidth="0.75" />
        <line x1="22" y1="56" x2="98" y2="56" stroke="var(--ink-200)" strokeWidth="0.75" />
        <line x1="22" y1="68" x2="98" y2="68" stroke="var(--ink-200)" strokeWidth="0.75" />
        <line x1="48" y1="32" x2="48" y2="78" stroke="var(--ink-200)" strokeWidth="0.75" />
        <line x1="72" y1="32" x2="72" y2="78" stroke="var(--ink-200)" strokeWidth="0.75" />
        <circle cx="60" cy="48" r="14" fill="var(--teal-50)" stroke="var(--teal-500)" strokeWidth="1.25" />
        <path d="M60 54 L60 42 M55 47 L60 42 L65 47" fill="none" stroke="var(--teal-600)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <h2 className="mb-1.5 mt-5 text-md font-bold text-ink-900">لا توجد درجات مستوردة بعد</h2>
      <p className="m-0 max-w-[420px] text-sm text-ink-500">
        ابدأ بـ«استيراد ملف» لرفع كشف درجات الثانوية العامة أو الأزهرية. يدعم الملف صيغ{' '}
        <span className="font-en">.xlsx</span> و<span className="font-en">.xls</span> حتى ١٠ ميجا.
      </p>
      <div className="mt-6 flex gap-2.5">
        <Button variant="primary" leadingIcon={<Upload size={14} />} onClick={onImport}>
          استيراد ملف
        </Button>
        <Button variant="ghost" leadingIcon={<Download size={14} />}>
          تنزيل قالب نموذجي
        </Button>
      </div>

      <div className="mt-8 max-w-[600px] rounded-md border border-gold-200 bg-gold-50 px-5 py-3.5 text-start">
        <div className="mb-2.5 flex items-center gap-2">
          <Info size={14} className="text-gold-700" aria-hidden />
          <span className="text-xs font-semibold text-gold-700">
            أسماء الأعمدة المطلوبة في الملف
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3.5 text-xs">
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
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  sub,
  fg,
  bg,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  fg?: string;
  bg?: string;
}): JSX.Element {
  return (
    <div
      className="flex flex-col gap-0.5 rounded-md border border-border-subtle px-3.5 py-3"
      style={{ background: bg ?? '#fff' }}
    >
      <span className="text-2xs text-ink-500">{label}</span>
      <div className="flex items-baseline gap-2">
        <span
          className="font-ar-display font-en text-xl font-bold leading-tight"
          style={{ color: fg ?? 'var(--ink-900)' }}
        >
          {value}
        </span>
        {sub && <span className="text-2xs text-ink-500">{sub}</span>}
      </div>
    </div>
  );
}

function MatchChip({ label, count }: { label: string; count: number }): JSX.Element {
  const active = count > 0;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs"
      style={{
        background: active ? 'var(--teal-50)' : 'var(--ink-50)',
        color: active ? 'var(--teal-700)' : 'var(--ink-500)',
        border: `1px solid ${active ? 'var(--teal-100)' : 'transparent'}`,
        fontWeight: active ? 600 : 500,
      }}
    >
      {label}
      <span
        className="font-en text-2xs font-semibold"
        style={{ color: active ? 'var(--teal-700)' : 'var(--ink-400)' }}
      >
        {count}
      </span>
    </span>
  );
}

function Th({
  children,
  numeric,
  align,
}: {
  children: React.ReactNode;
  numeric?: boolean;
  align?: 'center';
}): JSX.Element {
  return (
    <th
      className="px-2.5 py-2 text-2xs font-bold uppercase tracking-wider text-ink-500"
      style={{ textAlign: align ?? (numeric ? 'end' : 'start') }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  numeric,
  align,
  onClick,
}: {
  children: React.ReactNode;
  numeric?: boolean;
  align?: 'center';
  onClick?: (e: React.MouseEvent) => void;
}): JSX.Element {
  return (
    <td
      onClick={onClick}
      className="overflow-hidden text-ellipsis whitespace-nowrap px-2.5 py-2.5 text-xs text-ink-800"
      style={{
        textAlign: align ?? (numeric ? 'end' : 'start'),
        fontFamily: numeric ? 'var(--font-en)' : 'var(--font-ar)',
      }}
    >
      {children}
    </td>
  );
}

function Row({
  r,
  index,
  onAddAdj,
  onOpenLog,
  onOpenDetails,
}: {
  r: DerivedRow;
  index: number;
  onAddAdj: () => void;
  onOpenLog: () => void;
  onOpenDetails: () => void;
}): JSX.Element {
  return (
    <tr
      onClick={onOpenDetails}
      className="cursor-pointer border-b border-border-subtle transition-colors"
      style={{ background: index % 2 === 1 ? 'var(--ink-50)' : '#fff' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--teal-50)')}
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = index % 2 === 1 ? 'var(--ink-50)' : '#fff')
      }
    >
      <Td numeric>{r.seat.toLocaleString('en')}</Td>
      <Td>
        <span dir="ltr" className="font-en text-2xs text-ink-600">
          {r.nid}
        </span>
      </Td>
      <Td>
        <span className="font-medium text-ink-900">{r.name}</span>
      </Td>
      <Td>
        <Badge tone={r.kind === 'general' ? 'info' : 'warning'}>
          {r.kind === 'general' ? 'عامة' : 'أزهرية'}
        </Badge>
      </Td>
      <Td>{r.branch}</Td>
      <Td>
        <div className="flex min-w-0 flex-col">
          <span className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-ink-900">
            {r.school}
          </span>
          <span className="text-2xs text-ink-500">{r.region}</span>
        </div>
      </Td>
      <Td numeric>
        <span className="inline-flex items-baseline justify-end gap-1">
          <span className="font-en font-semibold">{r.total}</span>
          <span className="text-2xs text-ink-300">/</span>
          <span
            className="font-en text-2xs"
            title={r.isOverridden ? `الأصلي: ${r.importMax} · المعدّل: ${r.max}` : undefined}
            style={{
              color: r.isOverridden ? 'var(--gold-700)' : 'var(--ink-400)',
              fontWeight: r.isOverridden ? 600 : 400,
            }}
          >
            {r.max}
          </span>
          {r.isOverridden && (
            <span
              className="ms-1 rounded-full border border-gold-200 bg-gold-50 px-1.5 text-2xs font-semibold text-gold-700"
              title={`الأصلي: ${r.importMax} · المعدّل: ${r.max}`}
            >
              معدّل
            </span>
          )}
        </span>
      </Td>
      <Td numeric>
        <span className="font-en font-semibold text-ink-900">{r.pct.toFixed(2)}</span>
        <span className="text-2xs text-ink-400">٪</span>
      </Td>
      <Td numeric>
        <div className="inline-flex flex-col items-end leading-tight">
          <span className="inline-flex items-center gap-1">
            {r.adj !== 0 && (
              <span
                className="inline-flex items-center gap-0.5 rounded-full border px-1.5 font-en text-2xs font-semibold"
                style={{
                  background: r.adj > 0 ? 'var(--gold-50)' : 'var(--terra-50)',
                  color: r.adj > 0 ? 'var(--gold-700)' : 'var(--terra-700)',
                  borderColor: r.adj > 0 ? 'var(--gold-200)' : 'var(--terra-100)',
                }}
              >
                {r.adj > 0 ? '↑' : '↓'}
                <span>{Math.abs(r.adj)}</span>
              </span>
            )}
            <span
              className="font-en font-bold"
              style={{
                color:
                  r.adj !== 0
                    ? r.adj > 0
                      ? 'var(--gold-700)'
                      : 'var(--terra-700)'
                    : 'var(--ink-900)',
              }}
            >
              {r.eff}
            </span>
          </span>
          <span
            className="font-en text-2xs"
            style={{
              color:
                r.adj !== 0
                  ? r.adj > 0
                    ? 'var(--gold-700)'
                    : 'var(--terra-700)'
                  : 'var(--ink-500)',
            }}
          >
            {r.effPct.toFixed(2)}٪
          </span>
        </div>
      </Td>
      <Td>
        {r.status === '—' ? (
          <span className="text-ink-300">—</span>
        ) : (
          <Badge tone={r.status === 'مستجد' ? 'success' : 'warning'} dot>
            {r.status}
          </Badge>
        )}
      </Td>
      <Td align="center" onClick={(e) => e.stopPropagation()}>
        <div className="inline-flex justify-center gap-0.5">
          <IconAction label="إضافة تعديل" tone="teal" onClick={onAddAdj}>
            <Plus size={14} />
          </IconAction>
          <IconAction
            label="عرض السجل"
            tone="gold"
            badge={r.log.length > 0 ? r.log.length : null}
            onClick={onOpenLog}
          >
            <History size={14} />
          </IconAction>
          <IconAction label="تفاصيل الطالب" onClick={onOpenDetails}>
            <Eye size={14} />
          </IconAction>
        </div>
      </Td>
    </tr>
  );
}

function IconAction({
  children,
  label,
  tone,
  badge,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  tone?: 'teal' | 'gold';
  badge?: number | null;
  onClick: () => void;
}): JSX.Element {
  const fg =
    tone === 'teal' ? 'var(--teal-700)' : tone === 'gold' ? 'var(--gold-700)' : 'var(--ink-600)';
  const hov =
    tone === 'teal' ? 'var(--teal-50)' : tone === 'gold' ? 'var(--gold-50)' : 'var(--ink-100)';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = hov)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      className="relative inline-grid h-7 w-7 cursor-pointer place-items-center rounded-md border border-transparent bg-transparent transition-colors"
      style={{ color: fg }}
    >
      {children}
      {badge != null && (
        <span
          aria-hidden
          className="absolute grid place-items-center rounded-full border border-white bg-gold-500 font-en text-2xs font-bold text-white"
          style={{ top: -2, insetInlineEnd: -2, minWidth: 12, height: 12, padding: '0 3px' }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
