/**
 * SectionTOC — sticky right-rail anchor navigation for /architecture.
 *
 * Listens to section headings via IntersectionObserver to highlight the
 * currently-visible section. Collapsed into a horizontal pill bar on tablet
 * (<lg breakpoint). Hidden on print.
 *
 * Page-local — the architecture page is the only consumer.
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/shared/lib/cn';
import type { SectionMeta } from '../data';

interface SectionTOCProps {
  sections: readonly SectionMeta[];
}

export function SectionTOC({ sections }: SectionTOCProps): JSX.Element {
  const [active, setActive] = useState<string>(sections[0]?.id ?? '');
  const ratiosRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const targets = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratiosRef.current[entry.target.id] = entry.isIntersecting ? entry.intersectionRatio : 0;
        }
        let bestId = active;
        let bestRatio = -1;
        for (const id of Object.keys(ratiosRef.current)) {
          const r = ratiosRef.current[id] ?? 0;
          if (r > bestRatio) {
            bestRatio = r;
            bestId = id;
          }
        }
        if (bestRatio > 0) setActive(bestId);
      },
      {
        // Bias toward sections actually in the upper half of the viewport.
        rootMargin: '-20% 0px -55% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
    // We intentionally re-bind once on mount; sections list is static.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>, id: string): void => {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActive(id);
    if (typeof history !== 'undefined' && history.replaceState) {
      history.replaceState(null, '', `#${id}`);
    }
  };

  return (
    <nav
      aria-label="On this page"
      data-no-print="true"
      className="arch-toc text-xs text-ink-700"
    >
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">
        On this page
      </p>
      <ol className="flex flex-col gap-px">
        {sections.map((s) => {
          const isActive = s.id === active;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                onClick={(e) => handleClick(e, s.id)}
                className={cn(
                  'group flex items-baseline gap-2 rounded-md px-2 py-1.5 transition-colors duration-fast ease-standard',
                  'hover:bg-ink-50 focus-visible:bg-ink-50 focus-visible:outline-none',
                  isActive ? 'bg-teal-50 text-teal-700' : 'text-ink-700',
                )}
                aria-current={isActive ? 'true' : undefined}
              >
                <span
                  className={cn(
                    'inline-flex h-5 w-5 flex-none items-center justify-center rounded font-numeric tnum text-[11px]',
                    isActive
                      ? 'bg-teal-500 text-white'
                      : 'border border-border-subtle bg-surface-card text-ink-500 group-hover:text-ink-700',
                  )}
                >
                  {s.num}
                </span>
                <span className={cn('leading-snug', isActive && 'font-medium')}>{s.label}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
