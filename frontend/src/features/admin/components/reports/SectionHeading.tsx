/**
 * SectionHeading — repeating sub-heading for each command-center section.
 * Title + optional eyebrow tag + optional trailing slot.
 */

import type { ReactNode } from 'react';

interface SectionHeadingProps {
  title: string;
  eyebrow?: string;
  trailing?: ReactNode;
}

export function SectionHeading({ title, eyebrow, trailing }: SectionHeadingProps): JSX.Element {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-border-subtle pb-3">
      <div className="min-w-0">
        {eyebrow ? <p className="text-2xs uppercase tracking-wide text-gold-700">{eyebrow}</p> : null}
        <h2 className="font-ar-display text-lg font-bold text-ink-900">{title}</h2>
      </div>
      {trailing}
    </header>
  );
}
