/**
 * VerticalStepper — side-of-page progress rail for the admission-setup wizard.
 * Replaces the earlier horizontal pill-strip: every step renders as a stacked
 * row of `dot · label`, all 16 labels are visible at once, and the active row
 * is highlighted. The rail is sized to the wizard's start-edge column so the
 * step content keeps its natural reading width on the opposite side.
 *
 * Visual semantics (state):
 *   • complete    — teal dot + check glyph, label in ink-700
 *   • current     — accent-filled dot + accent-50 row background + ink-900 label
 *   • in_progress — gold ring dot, label in gold-700
 *   • upcoming    — outlined dot, label in ink-500
 *
 * The connector segments between dots take their colour from the *upper*
 * step — once a step is complete its trailing connector turns teal so the
 * progress reads as a continuous filled spine from top to current.
 *
 * Auto-scrolls the active row into view on mount and on every active-key
 * change; honours `prefers-reduced-motion`.
 *
 * Kept feature-local because it carries the wizard's specific status
 * semantics (not_started / in_progress / complete / current). If a third
 * consumer appears, promote to shared/.
 */

import { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { toEasternArabicNumerals } from '@/shared/lib/arabic';

export type VerticalStepState = 'complete' | 'current' | 'in_progress' | 'upcoming';

export interface VerticalStepDescriptor {
  key: string;
  label: string;
  state: VerticalStepState;
  /** 1-indexed visual order — drives the dot label and aria-step. */
  order: number;
}

interface VerticalStepperProps {
  steps: readonly VerticalStepDescriptor[];
  activeKey: string;
  onSelect: (key: string) => void;
}

export function VerticalStepper({
  steps,
  activeKey,
  onSelect,
}: VerticalStepperProps): JSX.Element {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!activeRef.current) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    activeRef.current.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [activeKey]);

  return (
    <nav aria-label="مراحل إعداد التقديم" className="flex h-full w-full flex-col">
      {/* `flex-1 + min-h-0` lets the list fill the rail's available
       * height; per-row `flex-1` then distributes that height evenly
       * across every step so all entries fit without inner scroll
       * and each row becomes a comfortable tap target. */}
      <ol className="flex min-h-0 w-full flex-1 flex-col">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          const isActive = step.key === activeKey;
          const connectorColor =
            step.state === 'complete' ? 'bg-teal-500' : 'bg-ink-200';
          return (
            <li
              key={step.key}
              className="flex w-full flex-1 items-stretch gap-3 min-h-0"
            >
              {/* Spine column — dot + connector */}
              <div className="relative flex w-7 shrink-0 flex-col items-center">
                <StepDot state={step.state} order={step.order} />
                {!isLast && (
                  <span
                    aria-hidden
                    className={cn('w-px flex-1 my-0.5', connectorColor)}
                  />
                )}
              </div>

              {/* Label column — clickable row */}
              <button
                type="button"
                ref={isActive ? activeRef : undefined}
                onClick={() => onSelect(step.key)}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`${step.label} — الخطوة ${toEasternArabicNumerals(step.order)}`}
                className={cn(
                  'group flex flex-1 items-center gap-2 self-stretch rounded-md px-2 text-start',
                  'transition-colors duration-fast ease-standard',
                  'focus-visible:shadow-focus-teal focus-visible:outline-none',
                  isActive
                    ? 'bg-accent-50'
                    : 'hover:bg-ink-50',
                )}
              >
                <span
                  className={cn(
                    'whitespace-normal text-2xs leading-tight',
                    isActive
                      ? 'font-bold text-ink-900'
                      : step.state === 'complete'
                        ? 'font-medium text-ink-700'
                        : step.state === 'in_progress'
                          ? 'font-medium text-gold-700'
                          : 'text-ink-500',
                  )}
                >
                  {step.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepDot({
  state,
  order,
}: {
  state: VerticalStepState;
  order: number;
}): JSX.Element {
  const base =
    'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-2xs font-numeric tnum';
  if (state === 'complete') {
    return (
      <span className={cn(base, 'border-teal-500 bg-teal-500 text-white')} aria-hidden>
        <Check size={12} strokeWidth={2.4} />
      </span>
    );
  }
  if (state === 'current') {
    return (
      <span
        className={cn(base, 'border-transparent text-white')}
        style={{ background: 'var(--accent-500)' }}
        aria-hidden
      >
        {toEasternArabicNumerals(order)}
      </span>
    );
  }
  if (state === 'in_progress') {
    return (
      <span
        className={cn(base, 'border-gold-500 bg-gold-50 text-gold-700')}
        aria-hidden
      >
        {toEasternArabicNumerals(order)}
      </span>
    );
  }
  return (
    <span className={cn(base, 'border-ink-300 bg-surface-card text-ink-500')} aria-hidden>
      {toEasternArabicNumerals(order)}
    </span>
  );
}
