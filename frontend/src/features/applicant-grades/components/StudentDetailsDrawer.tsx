/**
 * StudentDetailsDrawer — tabbed drawer with pinned grades summary.
 *   • بيانات أساسية — raw imported fields (15 general / 8 azhar) with source-column codes
 *   • الدرجات       — 5 stat cards including the "الحد الأقصى ✎" editable card
 *   • سجل التعديلات — read-only timeline
 *
 * The edit-max card opens EditMaxDegreeDialog above the drawer.
 */

import { useState } from 'react';
import { Download, History, Pencil, Plus, Sheet } from 'lucide-react';
import { Badge, Button, Drawer } from '@/shared/components';
import { initials } from '@/shared/lib/format';
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
    { v: 'basic', label: 'بيانات أساسية', count: row.kind === 'general' ? 15 : 8 },
    { v: 'grades', label: 'الدرجات', count: null },
    { v: 'log', label: 'سجل التعديلات', count: row.log.length },
  ];

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        size="md"
        transparentBackdrop={false}
        title={
          <div className="flex items-center gap-3">
            <div
              className="grid h-12 w-12 place-items-center rounded-full bg-gold-100 font-ar-display text-md font-bold text-gold-700"
            >
              {initials(row.name)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-md font-bold text-ink-900">{row.name}</span>
                <Badge tone={row.kind === 'general' ? 'info' : 'warning'}>
                  {row.kind === 'general' ? 'ثانوية عامة' : 'ثانوية أزهرية'}
                </Badge>
              </div>
              <div className="mt-1 flex gap-2.5 text-2xs text-ink-500">
                <span dir="ltr" className="font-en">
                  رقم الجلوس {row.seat.toLocaleString('en')}
                </span>
                <span>·</span>
                <span dir="ltr" className="font-en">{row.nid}</span>
              </div>
            </div>
          </div>
        }
        subtitle={
          <nav className="mt-3 flex gap-1">
            {tabs.map((t) => {
              const active = tab === t.v;
              return (
                <button
                  key={t.v}
                  onClick={() => setTab(t.v)}
                  className="inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent px-3.5 py-2 text-sm transition-colors"
                  style={{
                    fontWeight: active ? 600 : 500,
                    color: active ? 'var(--ink-900)' : 'var(--ink-500)',
                    borderBottom: `2px solid ${active ? 'var(--teal-500)' : 'transparent'}`,
                    marginBottom: -1,
                  }}
                >
                  {t.label}
                  {t.count != null && (
                    <span
                      className="rounded-full px-1.5 py-0.5 font-en text-2xs font-semibold"
                      style={{
                        background: active ? 'var(--teal-50)' : 'var(--ink-100)',
                        color: active ? 'var(--teal-700)' : 'var(--ink-500)',
                      }}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        }
      >
        <Drawer.Body>
          {/* Pinned summary */}
          <div className="-mx-6 -mt-6 mb-4 grid grid-cols-4 gap-2 border-b border-border-subtle bg-ink-50 px-6 py-3.5">
            <PinStat
              label="المجموع"
              value={String(row.total)}
              sub={`من ${row.max}`}
              overrideHint={row.isOverridden}
            />
            <PinStat label="النسبة" value={`${row.pct.toFixed(2)}٪`} />
            <PinStat
              label="الفعلي"
              value={String(row.eff)}
              tone="gold"
              sub={(row.eff - row.total >= 0 ? '+' : '') + (row.eff - row.total)}
            />
            <PinStat label="الفعلي %" value={`${row.effPct.toFixed(2)}٪`} tone="gold-strong" />
          </div>

          {tab === 'basic' && <BasicTab row={row} />}
          {tab === 'grades' && <GradesTab row={row} onEditMax={() => setEditMaxOpen(true)} />}
          {tab === 'log' && <LogTab row={row} />}
        </Drawer.Body>
        <Drawer.Footer>
          <div className="flex w-full items-center justify-between">
            <Button variant="ghost" leadingIcon={<History size={14} />} onClick={() => setTab('log')}>
              عرض السجل ({row.log.length})
            </Button>
            <div className="flex gap-2">
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
}: {
  label: string;
  value: string;
  sub?: string;
  overrideHint?: boolean;
  tone?: 'gold' | 'gold-strong';
}): JSX.Element {
  const fg = tone === 'gold' || tone === 'gold-strong' ? 'text-gold-700' : 'text-ink-900';
  const bg = tone === 'gold-strong' ? 'bg-gold-50' : 'bg-white';
  return (
    <div className={`flex flex-col gap-0.5 rounded-md border border-border-subtle px-3 py-2.5 ${bg}`}>
      <span className="text-2xs text-ink-500">{label}</span>
      <span className={`font-ar-display font-en text-md font-bold leading-tight ${fg}`}>
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
  const general: Array<KVProps> = [
    { label: 'رقم الجلوس', sourceKey: 'seating_no', value: String(row.seat), mono: true },
    { label: 'الرقم القومي', sourceKey: 'national_no', value: row.nid, mono: true },
    { label: 'الاسم باللغة العربية', sourceKey: 'arabic_name', value: row.name },
    { label: 'رمز النوع', sourceKey: 'sex_code', value: '1', mono: true },
    { label: 'النوع', sourceKey: 'sex_name', value: 'ذكر' },
    { label: 'اسم المدرسة', sourceKey: 'school_name', value: row.school },
    { label: 'القسم', sourceKey: 'dept_name', value: '—', empty: true },
    { label: 'المديرية', sourceKey: 'moderia_name', value: row.region },
    { label: 'رمز الشعبة الجديد', sourceKey: 'branch_code_new', value: '11', mono: true },
    { label: 'الشعبة', sourceKey: 'branch_desc_new', value: row.branch },
    { label: 'المجموع الكلي', sourceKey: 'total_degree', value: String(row.total), mono: true },
    { label: 'رمز نوع الطالب', sourceKey: 'std_type_code', value: '2', mono: true },
    { label: 'نوع الطالب', sourceKey: 'std_type_desc', value: 'انتظام' },
    { label: 'رمز حالة الطالب', sourceKey: 'student_case_id', value: '1', mono: true },
    { label: 'حالة الطالب', sourceKey: 'student_case_desc', value: row.status, highlight: row.status !== '—' },
  ];
  const azhar: Array<KVProps> = [
    { label: 'رقم الجلوس', sourceKey: 'StSeatNo', value: String(row.seat), mono: true },
    { label: 'الاسم', sourceKey: 'StudenName', value: row.name },
    { label: 'الشعبة', sourceKey: 'DevisionName', value: row.branch },
    { label: 'الرقم القومي', sourceKey: 'National_Code', value: row.nid, mono: true },
    { label: 'المنطقة', sourceKey: 'ZonName', value: row.region },
    { label: 'المعهد', sourceKey: 'InstituteName', value: row.school },
    { label: 'المجموع', sourceKey: 'Total2', value: String(row.total), mono: true },
    { label: 'القسم الفرعي', sourceKey: 'Sub', value: '—', empty: true },
  ];
  const fields = row.kind === 'general' ? general : azhar;

  return (
    <>
      <h3 className="m-0 mb-3.5 text-2xs font-bold uppercase tracking-wider text-ink-500">
        البيانات المستوردة · {row.kind === 'general' ? 'ثانوية عامة' : 'ثانوية أزهرية'}
      </h3>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3.5">
        {fields.map((f) => (
          <KV key={f.sourceKey} {...f} />
        ))}
      </div>

      <section className="mt-5">
        <h3 className="m-0 mb-2.5 text-2xs font-bold uppercase tracking-wider text-ink-500">
          مصدر البيانات
        </h3>
        <div className="flex items-center gap-3 rounded-md border border-border-subtle bg-white p-3">
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
          <Button size="sm" variant="ghost" leadingIcon={<Download size={14} />}>
            تنزيل المصدر
          </Button>
        </div>
      </section>

      {row.lastEditedAt && (
        <div className="mt-3.5 flex items-center gap-1.5 text-2xs text-ink-500">
          <Pencil size={14} className="text-gold-600" aria-hidden />
          <span>
            آخر تعديل على الدرجة العظمى:{' '}
            <strong className="text-ink-700">{row.lastEditedBy}</strong>{' '}
            · <span className="font-en">{row.lastEditedAt}</span>
          </span>
        </div>
      )}
    </>
  );
}

function GradesTab({ row, onEditMax }: { row: DerivedRow; onEditMax: () => void }): JSX.Element {
  const adj = row.eff - row.total;
  return (
    <div className="flex flex-col gap-4">
      <h3 className="m-0 text-2xs font-bold uppercase tracking-wider text-ink-500">
        احتساب الدرجة
      </h3>

      <div className="grid grid-cols-2 gap-2.5">
        <BigStat label="المجموع الأصلي" value={String(row.total)} sub={`من ${row.max}`} />
        <BigStat
          label="الحد الأقصى"
          value={String(row.max)}
          sub={row.isOverridden ? `الأصلي عند الاستيراد: ${row.importMax}` : undefined}
          badge={row.isOverridden ? 'معدّل' : undefined}
          tone={row.isOverridden ? 'gold' : undefined}
          onEdit={onEditMax}
        />
        <BigStat label="النسبة الأصلية" value={`${row.pct.toFixed(2)}٪`} />
        <BigStat
          label="إجمالي التعديلات"
          value={(adj >= 0 ? '+' : '') + adj}
          tone="gold"
          sub={`${row.log.filter((x) => x.isActive).length} نشطة`}
        />
        <div className="col-span-2">
          <BigStat
            label="الفعلي النهائي"
            value={`${row.eff} · ${row.effPct.toFixed(2)}٪`}
            tone="success"
          />
        </div>
      </div>

      <div className="rounded-md border border-border-subtle bg-white p-4">
        <div className="mb-2 text-2xs text-ink-500">الفعلي مقابل الحد الأقصى</div>
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
          <span className="font-en">{row.max}</span>
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
  tone?: 'gold' | 'success';
  badge?: string;
  onEdit?: () => void;
}): JSX.Element {
  const tones = {
    gold: 'border-gold-200 bg-gold-50 text-gold-700',
    success: 'border-border-subtle bg-success-bg text-success',
    default: 'border-border-subtle bg-white text-ink-900',
  } as const;
  const t = tones[tone ?? 'default'];
  return (
    <div className={`relative rounded-md border p-4 ${t}`}>
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
      <div className="mt-1 font-ar-display font-en text-xl font-bold leading-tight">
        {value}
      </div>
      {sub && <div className="mt-0.5 text-2xs text-ink-500">{sub}</div>}
    </div>
  );
}

function LogTab({ row }: { row: DerivedRow }): JSX.Element {
  if (row.log.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border-default bg-ink-50 px-4 py-10 text-center text-sm text-ink-500">
        لا توجد تعديلات لهذا الطالب.
      </div>
    );
  }
  return (
    <ol className="relative m-0 flex list-none flex-col gap-2.5 p-0">
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
              className={`rounded-md border border-border-subtle bg-white p-3 ${
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
  sourceKey: string;
  value: string;
  mono?: boolean;
  empty?: boolean;
  highlight?: boolean;
}

function KV({ label, sourceKey, value, mono, empty, highlight }: KVProps): JSX.Element {
  const valueClasses = highlight
    ? 'rounded-full bg-success-bg px-2 py-0.5 text-success font-medium'
    : empty
      ? 'text-ink-300'
      : 'text-ink-900 font-medium';
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xs font-medium text-ink-600">{label}</span>
        <code className="font-mono text-2xs text-ink-400">{sourceKey}</code>
      </div>
      <span className={`self-start text-sm ${mono ? 'font-en' : 'font-ar'} ${valueClasses}`}>
        {value}
      </span>
    </div>
  );
}

