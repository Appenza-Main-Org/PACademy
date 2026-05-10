/**
 * HorizontalStepper — top-of-page progress indicator for the admission-setup
 * wizard. Compact pill-strip pattern: every step renders as a numbered dot
 * with the step name surfaced via `title` (hover tooltip + screen-reader
 * `aria-label`); the **current** step expands to dot + inline label so the
 * admin always knows where they are without parsing 16 mini-labels.
 *
 * The strip horizontally scrolls when it overflows; the active step is
 * scrolled into view (`inline: 'center'`) on mount and on every active-key
 * change so admins on step 12 don't land staring at steps 1–6. Honours
 * `prefers-reduced-motion` by switching from `'smooth'` to `'auto'`.
 *
 * Kept feature-local because it's only used by AdmissionSetupWizardPage and
 * carries the wizard's specific status semantics (not_started / in_progress
 * / complete / current). If a third consumer appears, promote to shared/.
 */

import { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { toEasternArabicNumerals } from '@/shared/lib/arabic';

export type HorizontalStepState = 'complete' | 'current' | 'in_progress' | 'upcoming';

export interface HorizontalStepDescriptor {
  key: string;
  label: string;
  state: HorizontalStepState;
  /** 1-indexed visual order — drives the dot label and aria-step. */
  order: number;
}

interface HorizontalStepperProps {
  steps: readonly HorizontalStepDescriptor[];
  activeKey: string;
  onSelect: (key: string) => void;
}

export function HorizontalStepper({
  steps,
  activeKey,
  onSelect,
}: HorizontalStepperProps): JSX.Element {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  /* Auto-scroll the active chip into the centre of the strip on mount and
   * on every active-key change. Falls back to instant scroll for users with
   * reduced-motion preferences. */
  useEffect(() => {
    if (!activeRef.current) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    activeRef.current.scrollIntoView({
      inline: 'center',
      block: 'nearest',
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [activeKey]);

  return (
    <nav
      aria-label="مراحل إعداد التقديم"
      /* Edge-fade hint that more chips exist beyond the visible window —
       * RTL-safe via symmetric mask. */
      className="w-full"
      style={{
        WebkitMaskImage:
          'linear-gradient(to right, transparent 0, #000 24px, #000 calc(100% - 24px), transparent 100%)',
        maskImage:
          'linear-gradient(to right, transparent 0, #000 24px, #000 calc(100% - 24px), transparent 100%)',
      }}
    >
      <ol
        className="flex w-full items-center gap-1.5 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'thin' }}
      >
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          const isActive = step.key === activeKey;
          return (
            <li key={step.key} className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                ref={isActive ? activeRef : undefined}
                onClick={() => onSelect(step.key)}
                title={`${step.label} — الخطوة ${toEasternArabicNumerals(step.order)}`}
                aria-label={`${step.label} — الخطوة ${toEasternArabicNumerals(step.order)}`}
                aria-current={isActive ? 'step' : undefined}
                className={cn(
                  'group inline-flex shrink-0 items-center gap-2 rounded-full',
                  'transition-colors duration-fast ease-standard',
                  'focus-visible:shadow-focus-teal focus-visible:outline-none',
                  isActive
                    ? 'bg-accent-50 ps-1 pe-3 py-1'
                    : 'p-0.5 hover:bg-ink-50',
                )}
              >
                <StepDot state={step.state} order={step.order} />
                {isActive && (
                  <span className="whitespace-nowrap text-2xs font-bold text-ink-900 leading-tight">
                    {step.label}
                  </span>
                )}
              </button>
              {!isLast && (
                <span
                  aria-hidden
                  className={cn(
                    'h-px w-4 shrink-0',
                    step.state === 'complete' ? 'bg-teal-500' : 'bg-ink-200',
                  )}
                />
              )}
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
  state: HorizontalStepState;
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
