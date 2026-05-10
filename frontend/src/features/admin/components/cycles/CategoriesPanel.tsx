/**
 * CategoriesPanel — per-cycle per-category open/close + capacity table.
 *
 * Extracted from `CycleDetailPage` so the Admission Setup section's
 * "إعدادات التقديم" step composes the same surface without forking
 * the toggle mutation.
 *
 * Per-row contract (cycle.openCategories[key]):
 *   - status (مفتوح / مغلق)
 *   - gender types (ذكور / إناث) — segmented toggle, required when open
 *   - start date / end date — required when open, must sit inside
 *     the cycle's [openDate, closeDate] (academic year) window
 *   - capacity (notes field retained in data model but no longer edited in UI)
 */

import { useState } from 'react';
import { AlertCircle, CalendarRange, Check } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  DatePicker,
  Input,
} from '@/shared/components';
import { cn } from '@/shared/lib/cn';
import type {
  AdmissionCycle,
  AdmissionCycleCategoryConfig,
  ApplicantCategory,
} from '@/shared/types/domain';
import { validateCategoryConfig } from '@/features/admin/api/cycles.service';

interface CategoriesPanelProps {
  cycle: AdmissionCycle;
  categories: ApplicantCategory[];
  readOnly: boolean;
  onToggle: (
    categoryKey: ApplicantCategory['key'],
    config: AdmissionCycleCategoryConfig,
  ) => void;
}

type Gender = 'male' | 'female';
const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'ذكور' },
  { value: 'female', label: 'إناث' },
];

export function CategoriesPanel({
  cycle,
  categories,
  readOnly,
  onToggle,
}: CategoriesPanelProps): JSX.Element {
  const yearWindow = formatRange(cycle.openDate, cycle.closeDate);
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-ar-display text-xl font-bold text-ink-900">
          حالة الفئات في هذه الدورة
        </h2>
        {yearWindow && (
          <span className="inline-flex items-center gap-2 rounded-pill bg-ink-50 px-3 py-1 text-2xs text-ink-600">
            <CalendarRange size={12} strokeWidth={1.75} />
            نطاق العام الدراسي: {yearWindow}
          </span>
        )}
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="border-b border-border-subtle text-2xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="py-2 pe-3 text-start">الفئة</th>
                <th className="py-2 pe-3 text-start">نوع التقديم</th>
                <th className="py-2 pe-3 text-start">النوع</th>
                <th className="py-2 pe-3 text-start">الحالة</th>
                <th className="py-2 pe-3 text-start">السعة</th>
                <th className="py-2 pe-3 text-start">تاريخ البداية</th>
                <th className="py-2 pe-3 text-start">تاريخ النهاية</th>
                <th className="py-2 pe-3 text-end" aria-label="إجراءات" />
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => {
                const cfg = cycle.openCategories?.[cat.key] ?? defaultConfig();
                return (
                  <CategoryRow
                    key={cat.key}
                    cycle={cycle}
                    category={cat}
                    config={cfg}
                    readOnly={readOnly}
                    onToggle={(c) => onToggle(cat.key, c)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

function CategoryRow({
  cycle,
  category,
  config,
  readOnly,
  onToggle,
}: {
  cycle: AdmissionCycle;
  category: ApplicantCategory;
  config: AdmissionCycleCategoryConfig;
  readOnly: boolean;
  onToggle: (config: AdmissionCycleCategoryConfig) => void;
}): JSX.Element {
  const [draft, setDraft] = useState<AdmissionCycleCategoryConfig>(() => normalizeConfig(config));
  const dirty = !sameConfig(draft, config);
  const issues = validateCategoryConfig(cycle, draft);
  const cycleMin = isoDateOnly(cycle.openDate);
  const cycleMax = isoDateOnly(cycle.closeDate);

  const handleSave = (): void => {
    if (issues.length > 0) return;
    onToggle(draft);
  };

  return (
    <>
      <tr className="border-b border-border-subtle align-top last:border-b-0">
        <td className="py-3 pe-3 font-medium text-ink-900">
          <div>{category.labelAr}</div>
          {category.description && (
            <div className="mt-0.5 line-clamp-2 text-2xs text-ink-500">{category.description}</div>
          )}
        </td>

        <td className="py-3 pe-3">
          {category.conditions.nominationOnly ? (
            <Badge tone="warning">بالترشيح</Badge>
          ) : (
            <Badge tone="neutral">تقديم عام</Badge>
          )}
        </td>

        <td className="py-3 pe-3">
          <GenderToggle
            value={draft.genderTypes ?? []}
            onChange={(next) => setDraft({ ...draft, genderTypes: next })}
            disabled={readOnly}
            ariaLabel={`نوع المتقدم لفئة ${category.labelAr}`}
          />
        </td>

        <td className="py-3 pe-3">
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={draft.isOpen}
              disabled={readOnly}
              onChange={(e) => setDraft({ ...draft, isOpen: e.target.checked })}
              className="h-4 w-4 cursor-pointer accent-teal-500"
            />
            {draft.isOpen ? 'مفتوح' : 'مغلق'}
          </label>
        </td>

        <td className="py-3 pe-3">
          <Input
            type="number"
            min={0}
            value={draft.capacity ?? ''}
            disabled={readOnly}
            onChange={(e) =>
              setDraft({ ...draft, capacity: e.target.value ? Number(e.target.value) : null })
            }
            containerClassName="!mb-0 w-24"
            className="text-end tabular-nums"
          />
        </td>

        <td className="py-3 pe-3">
          <div className="min-w-[150px]">
            <DatePicker
              value={isoToDate(draft.startDate)}
              onChange={(d) => setDraft({ ...draft, startDate: dateToIso(d) })}
              disabled={readOnly}
              min={cycleMin}
              max={cycleMax}
            />
          </div>
        </td>

        <td className="py-3 pe-3">
          <div className="min-w-[150px]">
            <DatePicker
              value={isoToDate(draft.endDate)}
              onChange={(d) => setDraft({ ...draft, endDate: dateToIso(d) })}
              disabled={readOnly}
              min={draft.startDate ?? cycleMin}
              max={cycleMax}
            />
          </div>
        </td>

        <td className="py-3 ps-3 text-end">
          {dirty && !readOnly && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={issues.length > 0}
              title={issues[0] ?? undefined}
            >
              حفظ
            </Button>
          )}
        </td>
      </tr>

      {dirty && issues.length > 0 && (
        <tr className="border-b border-border-subtle bg-terra-50/40 last:border-b-0">
          <td colSpan={8} className="px-3 pb-2 pt-0">
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-terra-700">
              {issues.map((msg) => (
                <li key={msg} className="inline-flex items-center gap-1.5">
                  <AlertCircle size={12} strokeWidth={2} aria-hidden />
                  <span>{msg}</span>
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * GenderToggle — segmented two-pill control for selecting ذكور / إناث.
 *
 * Replaces a generic MultiSelect with chips for what is really a fixed
 * 2-option multi-toggle. Each pill flips its own selection independently
 * (both can be active, both can be off — same semantics as before).
 *
 * Visual: shared rounded-pill container with subtle border; each pill
 * fills with `var(--accent-500)` when active so per-app accent flows
 * through `data-app="..."`. A check glyph on the active side confirms
 * state at a glance.
 */
function GenderToggle({
  value,
  onChange,
  disabled,
  ariaLabel,
}: {
  value: readonly Gender[];
  onChange: (next: Gender[]) => void;
  disabled?: boolean;
  ariaLabel?: string;
}): JSX.Element {
  const toggle = (g: Gender): void => {
    const set = new Set<Gender>(value);
    if (set.has(g)) set.delete(g);
    else set.add(g);
    onChange(Array.from(set));
  };
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-pill border border-border-default bg-white p-0.5 shadow-xs',
        disabled && 'opacity-60',
      )}
    >
      {GENDER_OPTIONS.map(({ value: g, label }) => {
        const active = value.includes(g);
        return (
          <button
            key={g}
            type="button"
            role="switch"
            aria-checked={active}
            disabled={disabled}
            onClick={() => toggle(g)}
            className={cn(
              'inline-flex items-center gap-1 rounded-pill px-3 py-1 text-xs font-medium',
              'transition-colors duration-[var(--motion-fast)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
              !disabled && !active && 'text-ink-700 hover:bg-ink-50',
              !active && 'bg-transparent',
              !disabled && 'cursor-pointer',
            )}
            style={
              active
                ? { background: 'var(--accent-500)', color: '#ffffff' }
                : undefined
            }
          >
            {active && <Check size={11} strokeWidth={3} aria-hidden />}
            {label}
          </button>
        );
      })}
    </div>
  );
}

function defaultConfig(): AdmissionCycleCategoryConfig {
  return {
    isOpen: false,
    capacity: null,
    notes: '',
    genderTypes: [],
    startDate: null,
    endDate: null,
  };
}

function normalizeConfig(c: AdmissionCycleCategoryConfig): AdmissionCycleCategoryConfig {
  return {
    isOpen: c.isOpen,
    capacity: c.capacity,
    notes: c.notes ?? '',
    genderTypes: c.genderTypes ?? [],
    startDate: c.startDate ?? null,
    endDate: c.endDate ?? null,
  };
}

function sameConfig(a: AdmissionCycleCategoryConfig, b: AdmissionCycleCategoryConfig): boolean {
  return (
    a.isOpen === b.isOpen &&
    a.capacity === b.capacity &&
    (a.notes ?? '') === (b.notes ?? '') &&
    sameGenders(a.genderTypes ?? [], b.genderTypes ?? []) &&
    (a.startDate ?? null) === (b.startDate ?? null) &&
    (a.endDate ?? null) === (b.endDate ?? null)
  );
}

function sameGenders(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

function isoDateOnly(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.slice(0, 10);
}

function isoToDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const day = value.slice(0, 10);
  const d = new Date(`${day}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateToIso(value: Date | null): string | null {
  if (!value) return null;
  /* Use UTC components so the stored string matches the picked calendar day
   * regardless of the runtime's timezone — same convention the cycle
   * `openDate`/`closeDate` use (`YYYY-MM-DDT00:00:00.000Z`). */
  const yyyy = value.getUTCFullYear();
  const mm = String(value.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(value.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatRange(open: string | undefined, close: string | undefined): string | null {
  if (!open || !close) return null;
  return `${isoDateOnly(open)} → ${isoDateOnly(close)}`;
}
