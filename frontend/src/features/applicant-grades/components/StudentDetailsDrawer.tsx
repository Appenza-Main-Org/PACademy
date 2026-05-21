/**
 * StudentDetailsDrawer — tabbed drawer with pinned grades summary.
 *   • بيانات أساسية — essential imported fields (5 general / 4 azhar)
 *   • الدرجات       — 5 stat cards including the "الحد الأقصى ✎" editable card
 *   • سجل التعديلات — read-only timeline
 *
 * The edit-max card opens EditMaxDegreeDialog above the drawer.
 */

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  GraduationCap,
  History,
  IdCard,
  Pencil,
  Percent,
  Plus,
  School,
  Sheet,
  Sigma,
} from 'lucide-react';
import { Badge, Button, Drawer } from '@/shared/components';
import { initials } from '@/shared/lib/format';
import { useLookup } from '@/features/lookups';
import { EditMaxDegreeDialog } from './EditMaxDegreeDialog';
import type { DerivedRow } from '../lib/derive';

type Tab = 'basic' | 'grades' | 'log';

interface Props {
  open: boolean;
  onClose: () => void;
  row: DerivedRow;
  onAddAdjustment: () => void;
}

export function StudentDetailsDrawer({
  open,
  onClose,
  row,
  onAddAdjustment,
}: Props): JSX.Element {
  const [tab, setTab] = useState<Tab>('basic');
  const [editMaxOpen, setEditMaxOpen] = useState(false);

  const tabs: Array<{ v: Tab; label: string; count: number | null }> = [
    { v: 'basic', label: 'بيانات أساسية', count: 9 },
    { v: 'grades', label: 'الدرجات', count: null },
    { v: 'log', label: 'سجل التعديلات', count: row.log.length },
  ];

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        size="lg"
        transparentBackdrop={false}
        title={
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
            <div
              className="grid h-14 w-14 shrink-0 place-items-center rounded-lg border border-gold-200 bg-gold-50 font-ar-display text-lg font-bold text-gold-700"
            >
              {initials(row.name)}
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="min-w-0 truncate text-lg font-bold text-ink-900">{row.name}</span>
                <Badge tone={row.kind === 'general' ? 'info' : 'warning'}>
                  {row.kind === 'general' ? 'ثانوية عامة' : 'ثانوية أزهرية'}
                </Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-2xs text-ink-500">
                <span className="inline-flex items-center gap-1">
                  <GraduationCap size={13} strokeWidth={1.75} aria-hidden />
                  رقم الجلوس{' '}
                  <span dir="ltr" className="font-en text-ink-700">
                    {row.seatingNumber ?? String(row.seat)}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <IdCard size={13} strokeWidth={1.75} aria-hidden />
                  الرقم القومي{' '}
                  <span dir="ltr" className="font-en text-ink-700">
                    {row.nid}
                  </span>
                </span>
              </div>
            </div>
          </div>
        }
        subtitle={
          /* Tabs nav — `gap-6` between triggers (≈ `gap-lg` on our 4px-step
           * scale), `gap-1` between label and count (≈ `gap-xs`). The count
           * uses the shared `Badge tone="neutral"` so it picks up the
           * project's muted-ink palette (`bg-ink-100 text-ink-700`) and
           * standard pill chrome — `min-w-5` keeps the 1-vs-15 widths even
           * so the active-tab underline doesn't shift. The underline binds
           * to `border-accent-500` so it picks up the per-app accent
           * token from `data-app="admin"`. */
          <nav className="mt-3 flex gap-1 overflow-x-auto border-b border-border-subtle pb-px">
            {tabs.map((t) => {
              const active = tab === t.v;
              return (
                <button
                  key={t.v}
                  onClick={() => setTab(t.v)}
                  className={`-mb-px inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-t-md border-0 border-b-2 px-3 py-2 text-sm transition-colors ${
                    active
                      ? 'border-accent-500 bg-surface-card font-semibold text-ink-900'
                      : 'border-transparent bg-transparent font-medium text-ink-500 hover:bg-ink-50 hover:text-ink-700'
                  }`}
                >
                  {t.label}
                  {t.count != null && (
                    <Badge tone="neutral" className="min-w-5 justify-center !px-2 font-en tabular-nums">
                      {t.count}
                    </Badge>
                  )}
                </button>
              );
            })}
          </nav>
        }
      >
        <Drawer.Body className="bg-surface-subtle">
          {/* Pinned summary */}
          <div className="-mx-6 -mt-6 mb-5 grid grid-cols-2 gap-2 border-b border-border-subtle bg-ink-50 px-6 py-4 lg:grid-cols-4">
            <PinStat
              label="المجموع"
              value={String(Math.round(row.total))}
              sub={`من ${Math.round(row.max)}`}
              overrideHint={row.isOverridden}
              icon={<Sigma size={14} strokeWidth={1.75} aria-hidden />}
            />
            <PinStat
              label="النسبة"
              value={`${row.pct.toFixed(2)}٪`}
              icon={<Percent size={14} strokeWidth={1.75} aria-hidden />}
            />
            <PinStat
              label="الفعلي"
              value={String(Math.round(row.eff))}
              tone="gold"
              sub={(row.eff - row.total >= 0 ? '+' : '') + Math.round(row.eff - row.total)}
              icon={<Sigma size={14} strokeWidth={1.75} aria-hidden />}
            />
            <PinStat
              label="الفعلي %"
              value={`${row.effPct.toFixed(2)}٪`}
              tone="gold-strong"
              icon={<Percent size={14} strokeWidth={1.75} aria-hidden />}
            />
          </div>

          {tab === 'basic' && <BasicTab row={row} />}
          {tab === 'grades' && <GradesTab row={row} onEditMax={() => setEditMaxOpen(true)} />}
          {tab === 'log' && <LogTab row={row} />}
        </Drawer.Body>
        <Drawer.Footer>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" leadingIcon={<History size={14} />} onClick={() => setTab('log')}>
              عرض السجل ({row.log.length})
            </Button>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose}>
                إغلاق
              </Button>
              <Button variant="primary" leadingIcon={<Plus size={14} />} onClick={onAddAdjustment}>
                إضافة تعديل
              </Button>
            </div>
          </div>
        </Drawer.Footer>
      </Drawer>

      <EditMaxDegreeDialog
        open={editMaxOpen}
        onClose={() => setEditMaxOpen(false)}
        row={row}
      />
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────── */

function PinStat({
  label,
  value,
  sub,
  overrideHint,
  tone,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  overrideHint?: boolean;
  tone?: 'gold' | 'gold-strong';
  icon?: ReactNode;
}): JSX.Element {
  const fg = tone === 'gold' || tone === 'gold-strong' ? 'text-gold-700' : 'text-ink-900';
  const bg = tone === 'gold-strong' ? 'bg-gold-50' : 'bg-surface-card';
  return (
    <div className={`flex min-w-0 flex-col gap-1 rounded-md border border-border-subtle px-3 py-2.5 ${bg}`}>
      <span className="inline-flex items-center gap-1 text-2xs text-ink-500">
        {icon}
        {label}
      </span>
      <span className={`font-en text-lg font-bold leading-tight ${fg}`}>
        {value}
      </span>
      {(sub || overrideHint) && (
        <span className="inline-flex items-center gap-1 text-2xs text-ink-500">
          {sub && <span className="font-en">{sub}</span>}
          {overrideHint && (
            <span className="rounded-full border border-gold-200 bg-gold-50 px-1.5 text-2xs font-semibold text-gold-700">
              معدّل
            </span>
          )}
        </span>
      )}
    </div>
  );
}

function BasicTab({ row }: { row: DerivedRow }): JSX.Element {
  /* Minimal field set per kind. Earlier revisions surfaced every
   * imported column (15 for general, 8 for azhar) — most of those
   * are import-side plumbing (sex_code, branch_code_new,
   * student_case_id, dept_name = always "—", etc.). Admins only
   * need the human-readable identifiers + the grade fields.
   *
   * `النوع` shows the textual value (`ذكر` / `أنثى`) sourced from the
   * row's typed `gender` field — earlier revisions hardcoded a single
   * value because the field didn't exist on the row yet. */
  const schoolCategoriesQuery = useLookup('school-categories');
  const examRoundsQuery = useLookup('exam-rounds');
  const schoolCategoryName = useMemo(() => {
    if (!row.schoolCategoryCode) return null;
    return (
      (schoolCategoriesQuery.data ?? []).find((r) => r.code === row.schoolCategoryCode)?.name ??
      row.schoolCategoryCode
    );
  }, [schoolCategoriesQuery.data, row.schoolCategoryCode]);
  const examRoundName = useMemo(() => {
    if (!row.examRound) return null;
    return (
      (examRoundsQuery.data ?? []).find((r) => r.code === row.examRound || r.name === row.examRound)
        ?.name ?? row.examRound
    );
  }, [examRoundsQuery.data, row.examRound]);

  const genderLabel = row.gender === 'female' ? 'أنثى' : 'ذكر';
  const yearLabel = row.graduationYear != null ? String(row.graduationYear) : '—';
  const schoolCategoryLabel = schoolCategoryName ?? '—';
  const schoolNameLabel = row.school && row.school.trim() !== '' ? row.school : '—';
  const examRoundLabel = examRoundName && examRoundName.trim() !== '' ? examRoundName : '—';

  const general: Array<KVProps> = [
    { label: 'الاسم باللغة العربية', sourceKey: 'arabic_name', value: row.name },
    { label: 'الرقم القومي', sourceKey: 'national_no', value: row.nid, mono: true },
    { label: 'النوع', sourceKey: 'sex_name', value: genderLabel },
    { label: 'الشعبة', sourceKey: 'branch_desc_new', value: row.branch },
    { label: 'سنة التخرج', sourceKey: 'graduation_year', value: yearLabel, mono: true },
    { label: 'فئة المدرسة', sourceKey: 'school_category', value: schoolCategoryLabel },
    { label: 'اسم المدرسة', sourceKey: 'school_name', value: schoolNameLabel, empty: schoolNameLabel === '—' },
    { label: 'الدور', sourceKey: 'exam_round', value: examRoundLabel, empty: examRoundLabel === '—' },
    { label: 'المجموع الكلي', sourceKey: 'total_degree', value: String(Math.round(row.total)), mono: true },
  ];
  const azhar: Array<KVProps> = [
    { label: 'الاسم', sourceKey: 'StudenName', value: row.name },
    { label: 'الرقم القومي', sourceKey: 'National_Code', value: row.nid, mono: true },
    { label: 'النوع', sourceKey: 'sex_name', value: genderLabel },
    { label: 'الشعبة', sourceKey: 'DevisionName', value: row.branch },
    { label: 'سنة التخرج', sourceKey: 'graduation_year', value: yearLabel, mono: true },
    { label: 'فئة المدرسة', sourceKey: 'school_category', value: schoolCategoryLabel },
    { label: 'اسم المدرسة', sourceKey: 'school_name', value: schoolNameLabel, empty: schoolNameLabel === '—' },
    { label: 'الدور', sourceKey: 'exam_round', value: examRoundLabel, empty: examRoundLabel === '—' },
    { label: 'المجموع الكلي', sourceKey: 'Total2', value: String(Math.round(row.total)), mono: true },
  ];
  const fields = row.kind === 'general' ? general : azhar;

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-border-subtle bg-surface-card p-4">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-teal-50 text-teal-700">
              <School size={15} strokeWidth={1.75} aria-hidden />
            </span>
            <div>
              <h3 className="m-0 text-sm font-bold text-ink-900">البيانات المستوردة</h3>
              <p className="m-0 mt-0.5 text-2xs text-ink-500">
                {row.kind === 'general' ? 'ثانوية عامة' : 'ثانوية أزهرية'}
              </p>
            </div>
          </div>
          <Badge tone="neutral">{fields.length} حقول</Badge>
        </header>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {fields.map((f) => (
            /* Key on `label` — `sourceKey` is no longer rendered and is
             * conceptually code-side documentation only; the Arabic
             * label is what the iteration is keyed by visually. */
            <KV key={f.label} {...f} />
          ))}
        </div>
      </section>

      {/* Import-source card.
       *
       * No "تنزيل المصدر" action button — the mock layer never wired
       * a download endpoint, and the real backend won't expose one
       * for raw source files (the import-staged copy is the source
       * of truth, not the original spreadsheet). Admins who need the
       * file go through the cycle's audit log, not this card. */}
      <section className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface-card p-3.5">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-teal-50 text-teal-700">
          <Sheet size={14} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-ink-900">
            {row.kind === 'general'
              ? 'درجات_الثانوية_العامة_2026.xlsx'
              : 'درجات_الثانوية_الأزهرية_2026.xlsx'}
          </div>
          <div className="text-2xs text-ink-500">
            استورده <strong className="text-ink-700">مرتضى محمود</strong> ·{' '}
            <span className="font-en">١٤ مايو ٢٠٢٦ · ٠٩:١٢ ص</span>
          </div>
        </div>
      </section>

      {row.lastEditedAt && (
        <div className="flex items-center gap-1.5 rounded-md border border-gold-200 bg-gold-50 px-3 py-2 text-2xs text-gold-700">
          <Pencil size={14} className="text-gold-600" aria-hidden />
          <span>
            آخر تعديل على الدرجة العظمى:{' '}
            <strong className="text-ink-700">{row.lastEditedBy}</strong>{' '}
            · <span className="font-en">{row.lastEditedAt}</span>
          </span>
        </div>
      )}
    </div>
  );
}

function GradesTab({ row, onEditMax }: { row: DerivedRow; onEditMax: () => void }): JSX.Element {
  const adj = row.eff - row.total;
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-subtle bg-surface-card p-4">
        <div className="inline-flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-gold-50 text-gold-700">
            <Sigma size={15} strokeWidth={1.75} aria-hidden />
          </span>
          <div>
            <h3 className="m-0 text-sm font-bold text-ink-900">احتساب الدرجة</h3>
            <p className="m-0 mt-0.5 text-2xs text-ink-500">
              المجموع الأصلي، التعديلات، والنتيجة النهائية للطالب.
            </p>
          </div>
        </div>
        <Badge tone={adj === 0 ? 'neutral' : adj > 0 ? 'warning' : 'danger'}>
          {adj === 0 ? 'بدون تعديل' : `${adj > 0 ? '+' : ''}${Math.round(adj)} درجة`}
        </Badge>
      </header>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <BigStat label="المجموع الأصلي" value={String(Math.round(row.total))} sub={`من ${Math.round(row.max)}`} />
        <BigStat
          label="الحد الأقصى"
          value={String(Math.round(row.max))}
          sub={row.isOverridden ? `الأصلي عند الاستيراد: ${Math.round(row.importMax)}` : undefined}
          badge={row.isOverridden ? 'معدّل' : undefined}
          tone={row.isOverridden ? 'gold' : undefined}
          onEdit={onEditMax}
        />
        <BigStat label="النسبة الأصلية" value={`${row.pct.toFixed(2)}٪`} />
        <BigStat
          label="إجمالي التعديلات"
          value={(adj >= 0 ? '+' : '') + Math.round(adj)}
          tone={adj < 0 ? 'danger' : 'gold'}
          sub={`${row.log.filter((x) => x.isActive).length} نشطة`}
        />
        <div className="sm:col-span-2">
          <BigStat
            label="الفعلي النهائي"
            value={`${Math.round(row.eff)} · ${row.effPct.toFixed(2)}٪`}
            tone="success"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border-subtle bg-surface-card p-4">
        <div className="mb-2 flex items-center justify-between gap-2 text-2xs text-ink-500">
          <span>الفعلي مقابل الحد الأقصى</span>
          <span className="font-en font-semibold text-ink-700">{row.effPct.toFixed(2)}٪</span>
        </div>
        <div className="relative h-3.5 overflow-hidden rounded-full bg-ink-100">
          <div
            className="absolute inset-y-0 start-0 bg-teal-500"
            style={{ width: `${(row.total / row.max) * 100}%` }}
          />
          <div
            className={`absolute inset-y-0 ${adj >= 0 ? 'bg-gold-500' : 'bg-terra-500'}`}
            style={{
              insetInlineStart: `${(row.total / row.max) * 100}%`,
              width: `${(Math.abs(adj) / row.max) * 100}%`,
            }}
          />
        </div>
        <div className="mt-2 flex justify-between text-2xs text-ink-500">
          <span className="font-en">0</span>
          <span className="font-en">{Math.round(row.max)}</span>
        </div>
      </div>
    </div>
  );
}

function BigStat({
  label,
  value,
  sub,
  tone,
  badge,
  onEdit,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'gold' | 'success' | 'danger';
  badge?: string;
  onEdit?: () => void;
}): JSX.Element {
  const tones = {
    gold: 'border-gold-200 bg-gold-50 text-gold-700',
    success: 'border-border-subtle bg-success-bg text-success',
    danger: 'border-terra-100 bg-terra-50 text-terra-700',
    default: 'border-border-subtle bg-surface-card text-ink-900',
  } as const;
  const t = tones[tone ?? 'default'];
  return (
    <div className={`relative rounded-lg border p-4 shadow-sm ${t}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="inline-flex flex-wrap items-center gap-1.5">
          <span className="text-2xs text-ink-500">{label}</span>
          {badge && (
            <span className="rounded-full border border-gold-200 bg-gold-50 px-1.5 text-2xs font-semibold text-gold-700">
              {badge}
            </span>
          )}
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label="تعديل الدرجة العظمى"
            title="تعديل الدرجة العظمى"
            className="inline-grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-sm border border-border-default bg-white p-0 text-ink-600 hover:bg-ink-50"
          >
            <Pencil size={12} />
          </button>
        )}
      </div>
      <div className="mt-1 font-en text-xl font-bold leading-tight">
        {value}
      </div>
      {sub && <div className="mt-0.5 text-2xs text-ink-500">{sub}</div>}
    </div>
  );
}

function LogTab({ row }: { row: DerivedRow }): JSX.Element {
  if (row.log.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border-default bg-surface-card px-4 py-10 text-center">
        <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-ink-50 text-ink-500">
          <History size={18} strokeWidth={1.75} aria-hidden />
        </div>
        <p className="m-0 text-sm font-medium text-ink-700">لا توجد تعديلات لهذا الطالب.</p>
        <p className="m-0 mt-1 text-2xs text-ink-500">سيظهر سجل الحركة هنا بعد إضافة أول تعديل.</p>
      </div>
    );
  }
  return (
    <ol className="relative m-0 flex list-none flex-col gap-3 rounded-lg border border-border-subtle bg-surface-card p-4">
      <span
        aria-hidden
        className="absolute bottom-4 top-4 w-0.5 rounded-full start-[11px] bg-gradient-to-b from-gold-200 to-ink-200"
      />
      {row.log.map((e) => {
        const pos = e.amount > 0;
        const dotBorder = e.isActive
          ? pos
            ? 'border-gold-500'
            : 'border-terra-500'
          : 'border-ink-300';
        const amountClasses = !e.isActive
          ? 'bg-ink-50 text-ink-500 border-border-default line-through'
          : pos
            ? 'bg-gold-50 text-gold-700 border-gold-200'
            : 'bg-terra-50 text-terra-700 border-terra-100';
        return (
          <li key={e.id} className="relative ps-8">
            <span
              aria-hidden
              className={`absolute top-3 start-1.5 h-3 w-3 rounded-full border-2 bg-white ${dotBorder} ${
                e.fresh ? 'shadow-[0_0_0_4px_rgba(184,134,44,0.18)]' : ''
              }`}
            />
            <article
              className={`rounded-lg border border-border-subtle bg-surface-card p-3.5 ${
                e.isActive ? 'opacity-100' : 'opacity-70'
              }`}
            >
              <div className="mb-1.5 flex items-center justify-between gap-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={pos ? 'warning' : 'danger'}>{e.reasonLabel}</Badge>
                  {!e.isActive && <Badge tone="neutral">موقوف</Badge>}
                </div>
                <span className={`rounded-full border px-2.5 py-0.5 font-en text-sm font-bold ${amountClasses}`}>
                  {pos ? '+' : '−'}
                  {Math.abs(e.amount)}
                </span>
              </div>
              {e.note && (
                <p className="m-0 mb-1.5 text-xs leading-relaxed text-ink-700">{e.note}</p>
              )}
              <div className="text-2xs text-ink-500">
                {e.by} · {e.when}
              </div>
            </article>
          </li>
        );
      })}
    </ol>
  );
}

interface KVProps {
  label: string;
  /**
   * Source-column key from the import file. Retained on the per-field
   * data as code-side documentation (so support/on-call still know
   * which raw column each Arabic label maps to), but no longer
   * rendered to admins — they only need the human-readable label.
   * Optional on the props because the renderer doesn't consume it; the
   * field data shape still requires it via TS.
   */
  sourceKey?: string;
  value: string;
  mono?: boolean;
  empty?: boolean;
  highlight?: boolean;
}

function KV({ label, value, mono, empty, highlight }: KVProps): JSX.Element {
  const valueClasses = highlight
    ? 'rounded-full bg-success-bg px-2 py-0.5 text-success font-medium'
    : empty
      ? 'text-ink-300'
      : 'text-ink-900 font-medium';
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-md border border-border-subtle bg-ink-50 px-3 py-2.5">
      <span className="text-2xs font-medium text-ink-600">{label}</span>
      <span
        className={`min-w-0 max-w-full break-words text-sm ${mono ? 'font-en' : 'font-ar'} ${valueClasses}`}
        dir={mono ? 'ltr' : undefined}
      >
        {value}
      </span>
    </div>
  );
}
