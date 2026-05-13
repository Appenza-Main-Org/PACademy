/**
 * CommitteeBindingMatrix — the (committee × working-day) grid.
 *
 * Rows = committees in the cycle's roster for the active category.
 * Cols = WORKING days for the cycle/category, sorted ascending by date.
 *
 * Empty cells render a dashed "+" affordance that opens the form
 * pre-filled with (committee, day). Filled cells render the capacity
 * (primary), a short eligibility summary, and a status dot. Hovering a
 * filled cell exposes an end-edge action menu (تعديل · تبديل · حذف ·
 * نسخ).
 *
 * Mobile (<md breakpoint) folds the grid into one card per committee
 * with its day list inside — sticky head/start columns aren't useful at
 * that width.
 */

import { useMemo } from 'react';
import { MinusCircle, MoreHorizontal, Plus } from 'lucide-react';
import {
  Badge,
  DropdownMenu,
  toast,
} from '@/shared/components';
import { cn } from '@/shared/lib/cn';
import { num, date as fmtDate } from '@/shared/lib/format';
import { MOCK } from '@/shared/mock-data';
import type {
  AdmissionCycle,
  ApplicantCategoryKey,
  Committee,
} from '@/shared/types/domain';
import type {
  BindingEligibility,
  CommitteeDayBinding,
  ExamScheduleDay,
} from '../../types';
import {
  useDeleteBinding,
  useToggleBindingActive,
} from '../../api/committeeBinding.queries';

export interface CommitteeBindingMatrixProps {
  cycle: AdmissionCycle;
  categoryKey: ApplicantCategoryKey;
  rosterCommittees: Committee[];
  workingDays: ExamScheduleDay[];
  bindings: CommitteeDayBinding[];
  canWrite: boolean;
  onAddCell: (committeeId: string, examScheduleDayId: string) => void;
  onEditCell: (binding: CommitteeDayBinding) => void;
  onCopyRow: (sourceCommitteeId: string) => void;
  onCopyColumn: (sourceDayId: string) => void;
}

export function CommitteeBindingMatrix({
  cycle,
  categoryKey,
  rosterCommittees,
  workingDays,
  bindings,
  canWrite,
  onAddCell,
  onEditCell,
  onCopyRow,
  onCopyColumn,
}: CommitteeBindingMatrixProps): JSX.Element {
  /* Index bindings by (committeeId, examScheduleDayId) for O(1) cell lookup. */
  const bindingByCell = useMemo(() => {
    const map = new Map<string, CommitteeDayBinding>();
    for (const b of bindings) {
      map.set(`${b.committeeId}__${b.examScheduleDayId}`, b);
    }
    return map;
  }, [bindings]);

  /* Stable day-column sort by ISO date ascending. */
  const sortedDays = useMemo(
    () => workingDays.slice().sort((a, b) => a.date.localeCompare(b.date)),
    [workingDays],
  );

  return (
    <>
      <DesktopMatrix
        cycle={cycle}
        categoryKey={categoryKey}
        rosterCommittees={rosterCommittees}
        sortedDays={sortedDays}
        bindingByCell={bindingByCell}
        canWrite={canWrite}
        onAddCell={onAddCell}
        onEditCell={onEditCell}
        onCopyRow={onCopyRow}
        onCopyColumn={onCopyColumn}
      />
      <MobileMatrix
        cycle={cycle}
        categoryKey={categoryKey}
        rosterCommittees={rosterCommittees}
        sortedDays={sortedDays}
        bindingByCell={bindingByCell}
        canWrite={canWrite}
        onAddCell={onAddCell}
        onEditCell={onEditCell}
      />
    </>
  );
}

/* ── Desktop grid ──────────────────────────────────────────────────── */

interface DesktopMatrixProps extends Omit<CommitteeBindingMatrixProps, 'workingDays' | 'bindings'> {
  sortedDays: ExamScheduleDay[];
  bindingByCell: Map<string, CommitteeDayBinding>;
}

function DesktopMatrix({
  cycle,
  categoryKey,
  rosterCommittees,
  sortedDays,
  bindingByCell,
  canWrite,
  onAddCell,
  onEditCell,
  onCopyRow,
  onCopyColumn,
}: DesktopMatrixProps): JSX.Element {
  return (
    <div className="hidden md:block">
      <div className="relative overflow-auto rounded-lg border border-border-subtle bg-surface-elevated">
        <table className="min-w-full border-separate border-spacing-0 text-2xs">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky start-0 top-0 z-20 min-w-[180px] bg-surface-elevated px-3 py-2 text-start font-medium text-ink-500 shadow-[inset_-1px_0_0_var(--border-subtle),inset_0_-1px_0_var(--border-subtle)]"
              >
                اللجنة
              </th>
              {sortedDays.map((day) => (
                <th
                  key={day.id}
                  scope="col"
                  className="sticky top-0 z-10 min-w-[140px] bg-surface-elevated px-3 py-2 text-start font-medium text-ink-700 shadow-[inset_0_-1px_0_var(--border-subtle)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{fmtDate(day.date, 'short')}</span>
                    {canWrite && (
                      <DropdownMenu>
                        <DropdownMenu.Trigger asChild>
                          <button
                            type="button"
                            aria-label={`خيارات يوم ${fmtDate(day.date, 'short')}`}
                            className="rounded-md p-0.5 text-ink-500 hover:bg-ink-50 hover:text-ink-900"
                          >
                            <MoreHorizontal size={14} strokeWidth={1.75} />
                          </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content>
                          <DropdownMenu.Item onSelect={() => onCopyColumn(day.id)}>
                            نسخ هذا اليوم إلى يوم آخر…
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rosterCommittees.map((c) => (
              <tr key={c.id}>
                <th
                  scope="row"
                  className="sticky start-0 z-10 min-w-[180px] bg-surface-elevated px-3 py-2 text-start align-top shadow-[inset_-1px_0_0_var(--border-subtle),inset_0_-1px_0_var(--border-subtle)]"
                >
                  <RowHeader committee={c} canWrite={canWrite} onCopy={() => onCopyRow(c.id)} />
                </th>
                {sortedDays.map((day) => {
                  const key = `${c.id}__${day.id}`;
                  const binding = bindingByCell.get(key);
                  return (
                    <td
                      key={day.id}
                      className="border-b border-border-subtle px-2 py-2 align-top"
                    >
                      {binding ? (
                        <FilledCell
                          binding={binding}
                          canWrite={canWrite}
                          cycleId={cycle.id}
                          categoryKey={categoryKey}
                          onEdit={() => onEditCell(binding)}
                        />
                      ) : (
                        <EmptyCell
                          canWrite={canWrite}
                          onClick={() => onAddCell(c.id, day.id)}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Mobile (folded) ───────────────────────────────────────────────── */

interface MobileMatrixProps extends Omit<CommitteeBindingMatrixProps, 'workingDays' | 'bindings' | 'onCopyRow' | 'onCopyColumn'> {
  sortedDays: ExamScheduleDay[];
  bindingByCell: Map<string, CommitteeDayBinding>;
}

function MobileMatrix({
  cycle,
  categoryKey,
  rosterCommittees,
  sortedDays,
  bindingByCell,
  canWrite,
  onAddCell,
  onEditCell,
}: MobileMatrixProps): JSX.Element {
  return (
    <div className="flex flex-col gap-3 md:hidden">
      {rosterCommittees.map((c) => (
        <div
          key={c.id}
          className="rounded-lg border border-border-subtle bg-surface-elevated p-3"
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-ar-display text-sm font-bold text-ink-900">
                {c.name}
              </p>
              <p className="mt-0.5 text-2xs text-ink-500">
                {c.head}
                {c.capacity ? ` · سعة كلية ${num(c.capacity)}` : ''}
              </p>
            </div>
          </div>
          <ul className="flex flex-col gap-1.5">
            {sortedDays.map((day) => {
              const key = `${c.id}__${day.id}`;
              const binding = bindingByCell.get(key);
              return (
                <li
                  key={day.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border-subtle bg-surface-default px-2 py-1.5"
                >
                  <span className="font-numeric tnum text-2xs text-ink-700">
                    {fmtDate(day.date, 'short')}
                  </span>
                  {binding ? (
                    <FilledCell
                      binding={binding}
                      canWrite={canWrite}
                      cycleId={cycle.id}
                      categoryKey={categoryKey}
                      onEdit={() => onEditCell(binding)}
                      compact
                    />
                  ) : (
                    <EmptyCell
                      canWrite={canWrite}
                      onClick={() => onAddCell(c.id, day.id)}
                      compact
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* ── Cell variants ─────────────────────────────────────────────────── */

function RowHeader({
  committee,
  canWrite,
  onCopy,
}: {
  committee: Committee;
  canWrite: boolean;
  onCopy: () => void;
}): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate font-ar-display text-2xs font-bold text-ink-900">
          {committee.name}
        </p>
        <p className="mt-0.5 truncate text-2xs text-ink-500">{committee.head}</p>
        {committee.capacity ? (
          <p className="mt-0.5 font-numeric tnum text-2xs text-ink-400">
            سعة كلية: {num(committee.capacity)}
          </p>
        ) : null}
      </div>
      {canWrite && (
        <DropdownMenu>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label={`خيارات لجنة ${committee.name}`}
              className="rounded-md p-0.5 text-ink-500 hover:bg-ink-50 hover:text-ink-900"
            >
              <MoreHorizontal size={14} strokeWidth={1.75} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Item onSelect={onCopy}>
              نسخ هذا الصف إلى لجنة أخرى…
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      )}
    </div>
  );
}

function EmptyCell({
  canWrite,
  onClick,
  compact,
}: {
  canWrite: boolean;
  onClick: () => void;
  compact?: boolean;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!canWrite}
      aria-label="إضافة ربط"
      className={cn(
        'group flex items-center justify-center gap-1 rounded-md border-2 border-dashed border-ink-200 bg-surface-default text-ink-400 transition-colors',
        compact ? 'h-7 w-7' : 'h-14 w-full',
        canWrite ? 'hover:border-accent-500 hover:text-accent-700' : 'cursor-not-allowed opacity-50',
      )}
      style={{
        ['--accent-500-fallback' as string]: 'var(--accent-500)',
      }}
    >
      <Plus size={compact ? 12 : 16} strokeWidth={2} aria-hidden />
      {!compact && <span className="text-2xs">إضافة</span>}
    </button>
  );
}

function FilledCell({
  binding,
  canWrite,
  cycleId,
  categoryKey,
  onEdit,
  compact,
}: {
  binding: CommitteeDayBinding;
  canWrite: boolean;
  cycleId: string;
  categoryKey: ApplicantCategoryKey;
  onEdit: () => void;
  compact?: boolean;
}): JSX.Element {
  const toggle = useToggleBindingActive();
  const del = useDeleteBinding();

  const handleToggle = (): void => {
    toggle.mutate(
      { id: binding.id, cycleId, applicantCategoryId: categoryKey },
      {
        onSuccess: (row) =>
          toast(row.isActive ? 'تم تفعيل الربط' : 'تم تعطيل الربط', 'success'),
      },
    );
  };

  const handleDelete = (): void => {
    if (typeof window !== 'undefined') {
      const ok = window.confirm('سيتم حذف هذا الربط. هل تريد المتابعة؟');
      if (!ok) return;
    }
    del.mutate(
      { id: binding.id, cycleId, applicantCategoryId: categoryKey },
      {
        onSuccess: () => toast('تم حذف الربط', 'success'),
      },
    );
  };

  return (
    <div
      className={cn(
        'group relative flex flex-col gap-1 rounded-md border bg-surface-elevated px-2 py-1.5 transition-shadow',
        binding.isActive
          ? 'border-border-subtle hover:shadow-sm'
          : 'border-dashed border-ink-200 opacity-60',
        compact && 'min-w-[120px]',
      )}
      style={
        binding.isActive
          ? { borderInlineStartWidth: 3, borderInlineStartColor: 'var(--accent-500)' }
          : undefined
      }
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-numeric tnum text-sm font-bold text-ink-900">
          {num(binding.capacity)}
        </span>
        <StatusDot isActive={binding.isActive} />
      </div>
      <span className="truncate text-2xs text-ink-500">
        {summarizeEligibility(binding.eligibility)}
      </span>
      {canWrite && (
        <div className="absolute end-1 top-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                aria-label="إجراءات الربط"
                className="rounded-md bg-surface-elevated/95 p-0.5 text-ink-500 shadow-sm hover:text-ink-900"
              >
                <MoreHorizontal size={12} strokeWidth={1.75} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Item onSelect={onEdit}>تعديل</DropdownMenu.Item>
              <DropdownMenu.Item onSelect={handleToggle}>
                {binding.isActive ? 'تعطيل' : 'تفعيل'}
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item destructive onSelect={handleDelete}>
                حذف
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

function StatusDot({ isActive }: { isActive: boolean }): JSX.Element {
  if (isActive) {
    return (
      <Badge tone="success" dot>
        مفعّل
      </Badge>
    );
  }
  return (
    <Badge tone="neutral" icon={<MinusCircle size={10} strokeWidth={1.75} />}>
      معطّل
    </Badge>
  );
}

/* ── Eligibility summary ───────────────────────────────────────────── */

export function summarizeEligibility(eligibility: BindingEligibility): string {
  if (eligibility.gradeKind === 'GRADES') {
    return `${num(eligibility.minPercentage)}–${num(eligibility.maxPercentage)}%`;
  }
  const grades = MOCK.lookups['academic-grades'];
  const minRow = grades.find((g) => g.code === eligibility.minAcademicGradeId);
  const maxRow = grades.find((g) => g.code === eligibility.maxAcademicGradeId);
  if (!minRow || !maxRow) return '—';
  if (minRow.code === maxRow.code) return minRow.name;
  return `${minRow.name} – ${maxRow.name}`;
}

