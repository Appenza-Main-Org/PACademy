/**
 * RelativesListPanel — multi-entry list for adult-relative نماذج (11,
 * 11/1, 14, 14/1, 17, 20, 23, 26) and child-relative نماذج (12, 13, 15,
 * 16, 18, 19, 21, 22, 24, 25, 27, 28).
 *
 * Surfaces a «لا يوجد» toggle the applicant must explicitly tick when
 * no member of the relation exists (the «التالي» button on the parent
 * group otherwise refuses to advance — enforced one level up).
 *
 * Each row collapses by default to its name + a small action strip;
 * clicking the row expands the inline editor. Multiple rows can stay
 * open so adding a new relative never hides data the applicant was
 * already editing.
 */

import { useState, type ReactNode } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { Button, Checkbox } from '@/shared/components';
import { cn } from '@/shared/lib/cn';
import type { AdultRelativeRecord, RelativeChildRecord, RelativeList } from '../../lib/vothiqaTaaruf.types';

type RowRecord = AdultRelativeRecord | RelativeChildRecord;

interface RelativesListPanelProps<T extends RowRecord> {
  formNumber: string;
  title: string;
  hint?: string;
  /** Footnote shown under the title — used for the «يراعى ذكر …» notes
   *  on نموذج 11/1, 14/1, 17, 20, 23, 26. */
  footnote?: string;
  /** Singular relation label used in row headings (e.g. «الأخ»). */
  itemSingular: string;
  value: RelativeList<T>;
  onChange: (next: RelativeList<T>) => void;
  /** Factory for a new empty row when «إضافة فرد» is pressed. */
  emptyFactory: () => T;
  /** Renders the inline editor for one row. The host owns the field set. */
  renderRow: (
    row: T,
    update: (patch: Partial<T>) => void,
    index: number,
  ) => ReactNode;
  /** When true, every control inside is disabled (locked/expired view). */
  readOnly?: boolean;
}

export function RelativesListPanel<T extends RowRecord>({
  formNumber,
  title,
  hint,
  footnote,
  itemSingular,
  value,
  onChange,
  emptyFactory,
  renderRow,
  readOnly,
}: RelativesListPanelProps<T>): JSX.Element {
  const [expandedIndices, setExpandedIndices] = useState<number[]>([]);

  const setNone = (next: boolean): void => {
    onChange({ none: next, items: next ? [] : value.items });
    if (next) setExpandedIndices([]);
  };

  const addRow = (): void => {
    const next = [...value.items, emptyFactory()];
    onChange({ none: false, items: next });
    setExpandedIndices((current) => [...new Set([...current, next.length - 1])]);
  };

  const removeRow = (i: number): void => {
    const next = value.items.filter((_, idx) => idx !== i);
    onChange({ none: false, items: next });
    setExpandedIndices((current) =>
      current
        .filter((idx) => idx !== i)
        .map((idx) => (idx > i ? idx - 1 : idx)),
    );
  };

  const updateRow = (i: number, patch: Partial<T>): void => {
    const next = value.items.map((row, idx) => (idx === i ? { ...row, ...patch } : row));
    onChange({ none: false, items: next });
  };

  const toggleRow = (i: number): void => {
    setExpandedIndices((current) =>
      current.includes(i)
        ? current.filter((idx) => idx !== i)
        : [...current, i],
    );
  };

  return (
    <section className="rounded-lg border border-border-default bg-surface-card p-4 md:p-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-4 border-b border-border-subtle pb-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex shrink-0 items-center rounded-md bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-700">
            {formNumber}
          </span>
          <div className="min-w-0">
            <h4 className="font-ar-display text-md font-bold text-ink-900">{title}</h4>
            {hint && <p className="mt-0.5 text-2xs text-ink-500 leading-relaxed">{hint}</p>}
            {footnote && (
              <p className="mt-1 text-2xs text-ink-500 leading-relaxed italic">— {footnote}</p>
            )}
          </div>
        </div>
        <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Checkbox
            checked={value.none}
            onCheckedChange={(checked) => setNone(checked === true)}
            disabled={readOnly}
            label="لا يوجد"
            className={cn(
              'min-h-9 rounded-md border border-border-default bg-surface-page px-4 text-sm font-medium text-ink-800',
              'transition-colors duration-fast ease-standard hover:border-border-strong hover:bg-ink-50',
              readOnly && 'cursor-not-allowed opacity-60',
            )}
          />
          {!value.none && (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={addRow}
              disabled={readOnly}
              leadingIcon={<Plus size={16} strokeWidth={1.75} />}
            >
              إضافة {itemSingular}
            </Button>
          )}
        </div>
      </header>

      {value.none ? (
        <p className="rounded-md bg-ink-50 px-4 py-3 text-2xs text-ink-500">
          أكّدتَ عدم وجود {itemSingular} ضمن أفراد الأسرة.
        </p>
      ) : value.items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-default bg-ink-50 px-4 py-3 text-2xs text-ink-500">
          لا توجد سجلات بعد — أضف {itemSingular} عبر زر «إضافة {itemSingular}» أو علّم «لا يوجد» إذا لم يكن لديك.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {value.items.map((row, i) => {
            const isExpanded = expandedIndices.includes(i);
            const displayName =
              ('name' in row ? row.name : '').trim() || `${itemSingular} ${i + 1}`;
            return (
              <li key={i} className="rounded-md border border-border-subtle">
                <button
                  type="button"
                  onClick={() => toggleRow(i)}
                  className="flex min-h-9 w-full items-center justify-between gap-3 rounded-md px-4 py-3 text-start transition-colors duration-fast ease-standard hover:bg-ink-50 focus-visible:outline-none focus-visible:shadow-[var(--ring)]"
                  aria-expanded={isExpanded}
                >
                  <span className="flex items-center gap-3">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ink-100 text-xs font-bold text-ink-700">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-ink-800">{displayName}</span>
                  </span>
                  <ChevronDown
                    size={16}
                    strokeWidth={1.75}
                    className={`text-ink-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </button>
                {isExpanded && (
                  <div className="border-t border-border-subtle p-3">
                    {renderRow(row, (patch) => updateRow(i, patch), i)}
                    {!readOnly && (
                      <div className="mt-3 flex justify-end">
                        <Button
                          type="button"
                          variant="secondary"
                          size="md"
                          onClick={() => removeRow(i)}
                          className="border-terra-300 text-terra-700 hover:border-terra-400 hover:bg-terra-50 focus-visible:shadow-focus-terra"
                          leadingIcon={<Trash2 size={14} strokeWidth={1.75} />}
                        >
                          حذف هذا السجل
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
