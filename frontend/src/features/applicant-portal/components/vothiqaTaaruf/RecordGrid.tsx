/**
 * RecordGrid — wraps a single نموذج card on the on-screen entry page.
 * Header shows the form number («نموذج 1») and its Arabic title; body
 * is a responsive 1- / 2- / 3-column grid that Cells slot into.
 *
 * Pure layout — owns no state. Pair with `Cell` for inputs.
 */

import type { ReactNode } from 'react';

interface RecordGridProps {
  /** "نموذج 1" — small chip on the start edge. */
  formNumber: string;
  /** Arabic title of the form, e.g. "بيانات الطالب الشخصية". */
  title: string;
  /** Optional helper line under the title. */
  hint?: string;
  /** Columns at md+ widths. Default: 2. */
  cols?: 1 | 2 | 3;
  /** Optional right-edge slot — e.g. «متوفى» toggle. */
  actionSlot?: ReactNode;
  children: ReactNode;
}

const colsClass: Record<NonNullable<RecordGridProps['cols']>, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
};

export function RecordGrid({
  formNumber,
  title,
  hint,
  cols = 2,
  actionSlot,
  children,
}: RecordGridProps): JSX.Element {
  return (
    <section className="rounded-lg border border-border-default bg-surface-card p-4 md:p-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle pb-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex shrink-0 items-center rounded-md bg-teal-50 px-2 py-1 text-2xs font-bold text-teal-700">
            {formNumber}
          </span>
          <div>
            <h4 className="font-ar-display text-md font-bold text-ink-900">{title}</h4>
            {hint && <p className="mt-0.5 text-2xs text-ink-500 leading-relaxed">{hint}</p>}
          </div>
        </div>
        {actionSlot}
      </header>
      <div className={`grid gap-3 grid-cols-1 ${colsClass[cols]}`}>
        {children}
      </div>
    </section>
  );
}
