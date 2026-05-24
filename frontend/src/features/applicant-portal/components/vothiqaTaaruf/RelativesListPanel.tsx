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
 * clicking the row expands the inline editor. Rows are kept very
 * compact so a screen with many uncles + aunts is still scannable.
 */

import { useState, type ReactNode } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
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
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const setNone = (next: boolean): void => {
    onChange({ none: next, items: next ? [] : value.items });
    if (next) setExpandedIndex(null);
  };

  const addRow = (): void => {
    const next = [...value.items, emptyFactory()];
    onChange({ none: false, items: next });
    setExpandedIndex(next.length - 1);
  };

  const removeRow = (i: number): void => {
    const next = value.items.filter((_, idx) => idx !== i);
    onChange({ none: false, items: next });
    if (expandedIndex === i) setExpandedIndex(null);
  };

  const updateRow = (i: number, patch: Partial<T>): void => {
    const next = value.items.map((row, idx) => (idx === i ? { ...row, ...patch } : row));
    onChange({ none: false, items: next });
  };

  return (
    <section className="rounded-lg border border-border-default bg-surface-card p-4 md:p-5">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle pb-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex shrink-0 items-center rounded-md bg-teal-50 px-2 py-1 text-2xs font-bold text-teal-700">
            {formNumber}
          </span>
          <div>
            <h4 className="font-ar-display text-md font-bold text-ink-900">{title}</h4>
            {hint && <p className="mt-0.5 text-2xs text-ink-500 leading-relaxed">{hint}</p>}
            {footnote && (
              <p className="mt-1 text-2xs text-ink-500 leading-relaxed italic">— {footnote}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border-default bg-surface-page px-3 py-1.5 text-2xs font-medium text-ink-700 hover:bg-ink-50">
            <input
              type="checkbox"
              checked={value.none}
              onChange={(e) => setNone(e.target.checked)}
              disabled={readOnly}
              className="h-3.5 w-3.5 accent-teal-600"
            />
            <span>لا يوجد</span>
          </label>
          {!value.none && (
            <button
              type="button"
              onClick={addRow}
              disabled={readOnly}
              className="inline-flex items-center gap-1.5 rounded-md bg-teal-500 px-3 py-1.5 text-2xs font-medium text-white shadow-sm hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-ink-300"
            >
              <Plus size={12} strokeWidth={2} />
              إضافة {itemSingular}
            </button>
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
            const isExpanded = expandedIndex === i;
            const displayName =
              ('name' in row ? row.name : '').trim() || `${itemSingular} ${i + 1}`;
            return (
              <li key={i} className="rounded-md border border-border-subtle">
                <button
                  type="button"
                  onClick={() => setExpandedIndex(isExpanded ? null : i)}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-start hover:bg-ink-50"
                  aria-expanded={isExpanded}
                >
                  <span className="flex items-center gap-3">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink-100 text-2xs font-bold text-ink-700">
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
                        <button
                          type="button"
                          onClick={() => removeRow(i)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-terra-300 bg-surface-card px-3 py-1.5 text-2xs font-medium text-terra-700 hover:bg-terra-50"
                        >
                          <Trash2 size={12} strokeWidth={1.75} /> حذف هذا السجل
                        </button>
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
