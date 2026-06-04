/**
 * LogDrawer — adjustment log timeline for a single row.
 *
 * Filter tabs (الكل / نشطة / موقوفة) act on the timeline; toggling an entry
 * flips its isActive flag (so the header MiniStats recompute live), and the
 * trash icon removes the entry. Both mutations go through grades.queries.
 */

import { useMemo, useState } from 'react';
import { Eye, History, Lock, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Drawer } from '@/shared/components';
import { useDeleteAdjustment, useToggleAdjustment } from '../api/grades.queries';
import { SUBMISSION_LOCK_TOOLTIP, type DerivedRow } from '../lib/derive';
import { SubmissionLockNotice } from './SubmissionLockNotice';

interface Props {
  open: boolean;
  onClose: () => void;
  row: DerivedRow;
  onAddAdjustment: () => void;
  onOpenDetails: () => void;
}

type FilterValue = 'all' | 'active' | 'inactive';

export function LogDrawer({
  open,
  onClose,
  row,
  onAddAdjustment,
  onOpenDetails,
}: Props): JSX.Element {
  const [filter, setFilter] = useState<FilterValue>('all');

  const counts = useMemo(
    () => ({
      all: row.log.length,
      active: row.log.filter((x) => x.isActive).length,
      inactive: row.log.filter((x) => !x.isActive).length,
    }),
    [row.log],
  );

  const filtered = useMemo(() => {
    if (filter === 'active') return row.log.filter((x) => x.isActive);
    if (filter === 'inactive') return row.log.filter((x) => !x.isActive);
    return row.log;
  }, [row.log, filter]);

  const toggleMutation = useToggleAdjustment();
  const deleteMutation = useDeleteAdjustment();

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="sm"
      transparentBackdrop={false}
      title={
        <div>
          <div className="text-2xs text-ink-500">سجل التعديلات</div>
          <div className="text-md font-bold text-ink-900">{row.name}</div>
        </div>
      }
      subtitle={
        <div className="flex items-center gap-2 text-2xs text-ink-500">
          <Badge tone={row.kind === 'general' ? 'info' : 'warning'}>
            {row.kind === 'general' ? 'عامة' : 'أزهرية'}
          </Badge>
          <span dir="ltr" className="font-en">رقم الجلوس {row.seatingNumber ?? String(row.seat)}</span>
          <span>·</span>
          <span dir="ltr" className="font-en">{row.nid}</span>
        </div>
      }
    >
      <Drawer.Body>
        <div className="flex flex-col gap-3">
          {row.isLockedBySubmission && <SubmissionLockNotice row={row} />}
          {/* Live totals strip */}
          <div className="flex items-stretch overflow-hidden rounded-md border border-border-subtle">
            <MiniStat
              label="المجموع الأصلي"
              value={String(row.total)}
              sub={`من ${row.max}`}
              overrideHint={row.isOverridden}
            />
            <MiniStat
              label="إجمالي التعديلات"
              value={(row.adj >= 0 ? '+' : '') + row.adj}
              tone="gold"
            />
            <MiniStat
              label="الفعلي الحالي"
              value={String(row.eff)}
              sub={`${row.effPct.toFixed(2)}٪`}
              tone="strong"
            />
          </div>

          {/* Filter tabs + Add */}
          <div className="flex items-center justify-between gap-2 border-y border-border-subtle bg-ink-50 px-3 py-2">
            <div className="flex gap-1.5">
              {(
                [
                  { v: 'all', label: 'الكل', n: counts.all },
                  { v: 'active', label: 'نشطة', n: counts.active },
                  { v: 'inactive', label: 'موقوفة', n: counts.inactive },
                ] as const
              ).map(({ v, label, n }) => {
                const active = filter === v;
                return (
                  <button
                    key={v}
                    onClick={() => setFilter(v)}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                      active
                        ? 'border-border-default bg-white font-semibold text-ink-900'
                        : 'border-transparent bg-transparent font-medium text-ink-500'
                    }`}
                  >
                    {label}
                    <span className="font-en text-2xs text-ink-500">{n}</span>
                  </button>
                );
              })}
            </div>
            <Button
              size="sm"
              variant="primary"
              leadingIcon={
                row.isLockedBySubmission ? <Lock size={14} aria-hidden /> : <Plus size={14} />
              }
              onClick={onAddAdjustment}
              disabled={row.isLockedBySubmission}
              title={row.isLockedBySubmission ? SUBMISSION_LOCK_TOOLTIP : undefined}
            >
              إضافة تعديل
            </Button>
          </div>

          {/* Timeline */}
          {filtered.length === 0 ? (
            <div className="rounded-md border border-dashed border-border-default bg-ink-50 px-4 py-10 text-center text-sm text-ink-500">
              {row.log.length === 0
                ? 'لا توجد تعديلات لهذا الطالب.'
                : 'لا توجد تعديلات مطابقة للتصفية الحالية.'}
            </div>
          ) : (
            <ol className="relative m-0 flex list-none flex-col gap-3.5 p-0">
              {filtered.length > 1 && (
                <span
                  aria-hidden
                  className="absolute bottom-4 top-4 w-0.5 rounded-full start-[11px] bg-gradient-to-b from-gold-200 to-ink-200"
                />
              )}
              {filtered.map((entry) => (
                <LogEntry
                  key={entry.id}
                  entry={entry}
                  locked={row.isLockedBySubmission}
                  onToggle={() =>
                    toggleMutation.mutate({
                      seat: row.seat,
                      entryId: entry.id,
                      isActive: !entry.isActive,
                    })
                  }
                  onDelete={() =>
                    deleteMutation.mutate({ seat: row.seat, entryId: entry.id })
                  }
                />
              ))}
            </ol>
          )}
        </div>
      </Drawer.Body>
      <Drawer.Footer>
        <div className="flex w-full items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-2xs text-ink-500">
            <History size={14} className="text-ink-400" aria-hidden />
            <span className="font-en">{counts.all}</span> تعديل
          </span>
          <Button variant="ghost" leadingIcon={<Eye size={14} />} onClick={onOpenDetails}>
            عرض تفاصيل الطالب
          </Button>
        </div>
      </Drawer.Footer>
    </Drawer>
  );
}

function MiniStat({
  label,
  value,
  sub,
  tone,
  overrideHint,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'gold' | 'strong';
  overrideHint?: boolean;
}): JSX.Element {
  const bg = tone === 'gold' ? 'bg-gold-50' : tone === 'strong' ? 'bg-teal-50' : 'bg-white';
  const fg = tone === 'gold' ? 'text-gold-700' : tone === 'strong' ? 'text-ink-900' : 'text-ink-800';
  return (
    <div className={`flex flex-1 flex-col gap-0.5 border-s border-border-subtle px-3 py-2.5 first:border-s-0 ${bg}`}>
      <span className="text-2xs text-ink-500">{label}</span>
      <span className={`font-ar-display font-en text-md font-bold leading-tight ${fg}`}>
        {value}
      </span>
      {(sub || overrideHint) && (
        <span className="inline-flex items-center gap-1 text-2xs text-ink-500">
          {sub && <span>{sub}</span>}
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

interface EntryProps {
  entry: DerivedRow['log'][number];
  locked: boolean;
  onToggle: () => void;
  onDelete: () => void;
}

function LogEntry({ entry, locked, onToggle, onDelete }: EntryProps): JSX.Element {
  const { reasonLabel, reason, note, amount, by, when, isActive, fresh } = entry;
  const positive = amount > 0;
  const dotBorder = isActive
    ? positive
      ? 'border-gold-500'
      : 'border-terra-500'
    : 'border-ink-300';
  const amountClasses = !isActive
    ? 'bg-ink-50 text-ink-500 border-border-default line-through'
    : positive
      ? 'bg-gold-50 text-gold-700 border-gold-200'
      : 'bg-terra-50 text-terra-700 border-terra-100';
  return (
    <li className="relative ps-8">
      <span
        aria-hidden
        className={`absolute top-3.5 start-1.5 h-3 w-3 rounded-full border-2 bg-white ${dotBorder} ${
          fresh ? 'shadow-[0_0_0_4px_rgba(184,134,44,0.18)]' : ''
        }`}
      />
      <article
        className={`rounded-md border border-border-subtle bg-white p-3.5 transition-opacity ${
          isActive ? 'opacity-100' : 'opacity-75'
        }`}
      >
        <header className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={positive ? 'warning' : 'danger'}>{reasonLabel}</Badge>
            <code className="font-mono text-2xs text-ink-400">{reason}</code>
            {!isActive && <Badge tone="neutral">موقوف</Badge>}
            {fresh && <Badge tone="success" dot>جديد</Badge>}
          </div>
          <span className={`rounded-full border px-3 py-1 font-en text-sm font-bold ${amountClasses}`}>
            {positive ? '+' : '−'}
            {Math.abs(amount)}
          </span>
        </header>

        {note && (
          <p className="mt-2.5 mb-2 text-xs leading-relaxed text-ink-700">{note}</p>
        )}

        <footer className="flex items-center justify-between gap-2 border-t border-dashed border-border-subtle pt-2 text-2xs text-ink-500">
          <span>
            بواسطة <strong className="text-ink-700">{by}</strong> · {when}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onToggle}
              role="switch"
              aria-checked={isActive}
              disabled={locked}
              title={locked ? SUBMISSION_LOCK_TOOLTIP : undefined}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-white px-2.5 py-1 text-2xs text-ink-700 disabled:cursor-not-allowed disabled:opacity-50 enabled:cursor-pointer"
            >
              <span
                className={`relative h-3 w-[22px] rounded-full transition-colors ${
                  isActive ? 'bg-teal-500' : 'bg-ink-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-[inset-inline-start] ${
                    isActive ? 'start-[11px]' : 'start-0.5'
                  }`}
                />
              </span>
              {isActive ? 'نشط' : 'موقوف'}
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label="حذف"
              disabled={locked}
              title={locked ? SUBMISSION_LOCK_TOOLTIP : undefined}
              className="inline-grid h-6 w-6 place-items-center rounded-md border-0 bg-transparent text-terra-700 disabled:cursor-not-allowed disabled:opacity-50 enabled:cursor-pointer"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </footer>
      </article>
    </li>
  );
}
