/**
 * VerticalStepper — side-of-page progress rail for the admission-setup wizard.
 * Replaces the earlier horizontal pill-strip: every step renders as a natural
 * stacked row of `dot · label`, and the active row is highlighted. The rail is
 * sized to the wizard's start-edge column so the step content keeps its
 * natural reading width on the opposite side.
 *
 * Visual semantics (state):
 *   • complete    — teal dot + check glyph, label in ink-700
 *   • current     — accent-filled dot + accent-50 row background + ink-900 label
 *   • in_progress — gold ring dot, label in gold-700
 *   • upcoming    — outlined dot, label in ink-500
 *
 * Connector segments are anchored inside each dot column so the rail remains
 * centered even when Arabic labels wrap or the side panel scrolls internally.
 *
 * Auto-scrolls the active row into view on mount and on every active-key
 * change; honours `prefers-reduced-motion`.
 *
 * Kept feature-local because it carries the wizard's specific status
 * semantics (not_started / in_progress / complete / current). If a third
 * consumer appears, promote to shared/.
 */

import { useEffect, useRef } from 'react';
import { Check, Lock } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

export type VerticalStepState =
  | 'complete'
  | 'current'
  | 'current_complete'
  | 'in_progress'
  | 'upcoming';

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
  disabledKeys?: readonly string[];
}

export function VerticalStepper({
  steps,
  activeKey,
  onSelect,
  disabledKeys = [],
}: VerticalStepperProps): JSX.Element {
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const activeIndex = Math.max(0, steps.findIndex((step) => step.key === activeKey));

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
      <div className="mb-3 border-b border-border-subtle pb-3">
        <p className="m-0 font-ar text-xs font-semibold text-ink-900">
          خطوات إعداد التقديم
        </p>
        <p className="m-0 mt-1 font-ar text-2xs leading-5 text-ink-500">
          تابع الإعدادات بالترتيب حتى المراجعة والاعتماد.
        </p>
      </div>
      <ol className="relative flex min-h-0 w-full flex-1 flex-col">
        {steps.map((step, index) => {
          const isActive = step.key === activeKey;
          const isDisabled = disabledKeys.includes(step.key);
          const hasPrevious = index > 0;
          const hasNext = index < steps.length - 1;
          const isReached = index <= activeIndex;
          const isNextReached = index < activeIndex;
          return (
            <li
              key={step.key}
              className="relative flex min-h-8 items-stretch gap-2"
            >
              <div className="relative flex w-6 shrink-0 items-center justify-center">
                {hasPrevious && (
                  <span
                    aria-hidden
                    className={cn(
                      'absolute bottom-1/2 top-0 w-px -translate-x-1/2 transition-colors duration-slow ease-standard motion-reduce:transition-none start-1/2',
                      isReached ? 'bg-teal-500' : 'bg-ink-200',
                    )}
                  />
                )}
                {hasNext && (
                  <span
                    aria-hidden
                    className={cn(
                      'absolute bottom-0 top-1/2 w-px -translate-x-1/2 transition-colors duration-slow ease-standard motion-reduce:transition-none start-1/2',
                      isNextReached ? 'bg-teal-500' : 'bg-ink-200',
                    )}
                  />
                )}
                <StepDot state={step.state} order={step.order} isDisabled={isDisabled} />
              </div>

              {/* Label column — clickable row */}
              <button
                type="button"
                ref={isActive ? activeRef : undefined}
                onClick={() => onSelect(step.key)}
                aria-current={isActive ? 'step' : undefined}
                disabled={isDisabled}
                aria-label={`${step.label} — الخطوة ${step.order}`}
                className={cn(
                  'group my-1 flex min-h-8 flex-1 items-center gap-2 rounded-md border border-transparent px-3 py-1 text-start',
                  'transition-[background-color,border-color,box-shadow] duration-fast ease-standard',
                  'focus-visible:shadow-focus-teal focus-visible:outline-none',
                  'disabled:cursor-not-allowed disabled:opacity-55',
                  isActive
                    ? 'border-teal-200 bg-accent-50 shadow-xs'
                    : !isDisabled && 'hover:border-border-subtle hover:bg-ink-50',
                )}
              >
                <span
                  className={cn(
                    'whitespace-normal font-ar text-[13px] leading-5',
                    isActive
                      ? 'font-bold text-ink-900'
                      : step.state === 'complete' || step.state === 'current_complete'
                        ? 'font-medium text-ink-700'
                        : step.state === 'in_progress'
                          ? 'font-medium text-gold-700'
                          : 'text-ink-500',
                  )}
                >
                  {step.label}
                </span>
                {step.state === 'in_progress' && !isActive && (
                  <span className="ms-auto shrink-0 rounded-pill bg-gold-50 px-2 py-0.5 font-ar text-2xs font-medium text-gold-700">
                    جار
                  </span>
                )}
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
  isDisabled,
}: {
  state: VerticalStepState;
  order: number;
  isDisabled: boolean;
}): JSX.Element {
  const base =
    'relative z-[2] inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-2xs font-numeric tnum';
  if (isDisabled) {
    return (
      <span
        className={cn(base, 'border-ink-300 bg-surface-card text-ink-400')}
        aria-hidden
      >
        <Lock size={12} strokeWidth={1.8} />
      </span>
    );
  }
  if (state === 'complete' || state === 'current_complete') {
    return (
      <span
        className={cn(
          base,
          'border-teal-500 bg-teal-500 text-white',
          state === 'current_complete' && 'shadow-focus-teal',
        )}
        aria-hidden
      >
        <Check size={13} strokeWidth={2.4} />
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
        {order}
      </span>
    );
  }
  if (state === 'in_progress') {
    return (
      <span
        className={cn(base, 'border-gold-500 bg-gold-50 text-gold-700')}
        aria-hidden
      >
        {order}
      </span>
    );
  }
  return (
    <span className={cn(base, 'border-ink-300 bg-surface-card text-ink-500')} aria-hidden>
      {order}
    </span>
  );
}
