/**
 * AccordionGroup — one of the 7 expandable sections on the وثيقة تعارف
 * data-entry page. Owns its expanded/collapsed state via the parent
 * (controlled), shows a header with index + label + completion badge
 * (مكتمل / غير مكتمل), and at the bottom of the body renders «التالي»
 * (or «حفظ» on the last group) that triggers `onComplete()` — the
 * parent decides whether to expand the next group or to surface the
 * preview drawer.
 *
 * Each group does its own validation via a `validate()` callback the
 * parent supplies; if it returns an error message the «التالي» button
 * surfaces the message inline and stays put.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { Check, ChevronDown, Lock } from 'lucide-react';

export interface AccordionGroupProps {
  index: number;
  total: number;
  label: string;
  expanded: boolean;
  complete: boolean;
  /** When true the body is fully read-only — used for the expired-window demo. */
  readOnly?: boolean;
  /** Header click toggles expansion. */
  onToggle: () => void;
  /** Called when the user clicks «التالي» — parent advances the accordion. */
  onComplete: () => void;
  /** Returns null when valid; otherwise the error to surface inline. */
  validate?: () => string | null;
  /** Override the «التالي» button label (the last group uses «إنهاء وعرض المعاينة»). */
  nextLabel?: string;
  children: ReactNode;
}

export function AccordionGroup({
  index,
  total,
  label,
  expanded,
  complete,
  readOnly,
  onToggle,
  onComplete,
  validate,
  nextLabel = 'التالي',
  children,
}: AccordionGroupProps): JSX.Element {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLButtonElement | null>(null);

  /* When opened, smoothly scroll the header into view so a long page
   * doesn't drift the user past the section they just landed on. */
  useEffect(() => {
    if (expanded && headerRef.current) {
      headerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [expanded]);

  const handleNext = (): void => {
    if (validate) {
      const err = validate();
      if (err) {
        /* Inline alert region announces the error to AT users. */
        const region = bodyRef.current?.querySelector('[data-accordion-error]');
        if (region) region.textContent = err;
        return;
      }
    }
    onComplete();
  };

  return (
    <section
      className={`overflow-hidden rounded-lg border ${
        expanded ? 'border-teal-300 shadow-sm' : 'border-border-default'
      } bg-surface-card`}
    >
      <button
        ref={headerRef}
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start hover:bg-ink-50"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-3">
          <span
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
              complete
                ? 'bg-teal-500 text-white'
                : expanded
                  ? 'bg-teal-50 text-teal-700'
                  : 'bg-ink-100 text-ink-700'
            }`}
          >
            {complete ? <Check size={14} strokeWidth={2.25} /> : index + 1}
          </span>
          <span>
            <span className="block font-ar-display text-sm font-bold text-ink-900">{label}</span>
            <span className="block text-2xs text-ink-500">المجموعة {index + 1} من {total}</span>
          </span>
        </span>
        <span className="flex items-center gap-2">
          {readOnly && (
            <span className="inline-flex items-center gap-1 rounded-md bg-gold-50 px-2 py-1 text-2xs font-bold text-gold-700">
              <Lock size={11} strokeWidth={2} /> عرض فقط
            </span>
          )}
          {complete && !readOnly && (
            <span className="inline-flex items-center rounded-md bg-teal-50 px-2 py-1 text-2xs font-bold text-teal-700">
              مكتمل
            </span>
          )}
          <ChevronDown
            size={18}
            strokeWidth={1.75}
            className={`text-ink-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {expanded && (
        <div ref={bodyRef} className="border-t border-border-subtle bg-surface-page/40 p-4 md:p-5">
          <div className="flex flex-col gap-4">{children}</div>

          <div
            role="alert"
            aria-live="polite"
            data-accordion-error
            className="mt-3 min-h-[1.25rem] text-xs text-terra-700"
          />

          {!readOnly && (
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border-subtle pt-4">
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-2 rounded-md bg-teal-500 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-600 focus-visible:shadow-focus-teal focus-visible:outline-none"
              >
                {nextLabel}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
