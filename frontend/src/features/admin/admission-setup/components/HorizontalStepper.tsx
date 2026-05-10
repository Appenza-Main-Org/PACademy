/**
 * HorizontalStepper — top-of-page progress indicator for the admission-setup
 * wizard. Renders an Arabic-friendly RTL chip for each step plus a thin
 * connecting rule. Click on a non-blocked step to navigate; the active step
 * uses the per-app accent.
 *
 * Kept feature-local because it's only used by AdmissionSetupWizardPage and
 * carries the wizard's specific status semantics (not_started / in_progress
 * / complete / current). If a third consumer appears, promote to shared/.
 */

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
  return (
    <nav aria-label="مراحل إعداد التقديم" className="w-full">
      <ol className="flex w-full items-center gap-1 overflow-x-auto pb-2">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          const isActive = step.key === activeKey;
          return (
            <li key={step.key} className="flex min-w-0 items-center gap-1">
              <button
                type="button"
                onClick={() => onSelect(step.key)}
                aria-current={isActive ? 'step' : undefined}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-md px-2 py-1.5 text-2xs',
                  'transition-colors duration-fast ease-standard hover:bg-ink-50',
                  'focus-visible:shadow-focus-teal focus-visible:outline-none',
                  isActive && 'bg-accent-50 font-bold text-ink-900',
                )}
              >
                <StepDot state={step.state} order={step.order} />
                <span
                  className={cn(
                    'whitespace-nowrap leading-tight',
                    step.state === 'complete' && !isActive && 'text-ink-700',
                    step.state === 'in_progress' && !isActive && 'text-gold-700',
                    step.state === 'upcoming' && !isActive && 'text-ink-400',
                  )}
                >
                  {step.label}
                </span>
              </button>
              {!isLast && (
                <span
                  aria-hidden
                  className={cn(
                    'h-px w-6 shrink-0',
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
    'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-2xs font-numeric tnum';
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
        className={cn(base, 'border-accent-500 bg-accent-500 text-white')}
        style={{ background: 'var(--accent-500)', borderColor: 'var(--accent-500)' }}
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
    <span className={cn(base, 'border-ink-300 bg-surface-card text-ink-400')} aria-hidden>
      {toEasternArabicNumerals(order)}
    </span>
  );
}
