/**
 * StageStepper — 11-stage applicant journey indicator.
 * Source: Tasks/DESIGN_SYSTEM.md §4.6.
 *
 * States: complete · current · upcoming · blocked · skipped.
 * Horizontal on desktop, vertical on <640px (handled by container; the
 * component itself wraps gracefully).
 */

import { Fragment } from 'react';
import { Check, Lock, Minus } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

export type StageState = 'complete' | 'current' | 'upcoming' | 'blocked' | 'skipped';

export interface StageDescriptor {
  label: string;
  /** Optional explicit state. If omitted, inferred from `currentIndex`. */
  state?: StageState;
}

interface StageStepperProps {
  /** Either a flat label list (used with `currentIndex`) or rich descriptors. */
  stages: readonly (string | StageDescriptor)[];
  currentIndex: number;
  className?: string;
  /** Layout direction. */
  orientation?: 'horizontal' | 'vertical';
  ariaLabel?: string;
}

export function StageStepper({
  stages,
  currentIndex,
  className,
  orientation = 'horizontal',
  ariaLabel = 'مراحل التقديم',
}: StageStepperProps): JSX.Element {
  const items = stages.map((s, i) =>
    typeof s === 'string'
      ? { label: s, state: inferState(i, currentIndex) }
      : { label: s.label, state: s.state ?? inferState(i, currentIndex) },
  );

  return (
    <ol
      aria-label={ariaLabel}
      className={cn(
        orientation === 'horizontal'
          ? 'flex flex-wrap items-center gap-y-3'
          : 'flex flex-col gap-2',
        className,
      )}
    >
      {items.map((s, i) => (
        <Fragment key={`${s.label}-${i}`}>
          <li
            className={cn(
              'flex items-center gap-2 px-2 py-1 text-xs font-medium',
              s.state === 'complete' && 'text-ink-900',
              s.state === 'current' && 'text-ink-900',
              s.state === 'upcoming' && 'text-ink-400',
              s.state === 'blocked' && 'text-terra-700',
              s.state === 'skipped' && 'italic text-ink-400',
            )}
            aria-current={s.state === 'current' ? 'step' : undefined}
          >
            <StepDot state={s.state} index={i} />
            <span>{s.label}</span>
          </li>
          {i < items.length - 1 && (
            <li
              aria-hidden
              className={cn(
                orientation === 'horizontal' ? 'h-0.5 min-w-[24px] flex-1' : 'h-6 w-0.5',
                items[i]!.state === 'complete' ? 'bg-teal-500' : 'bg-ink-200',
              )}
              style={
                items[i]!.state === 'complete'
                  ? {
                      animation:
                        'stageStepperProgress var(--duration-slow) var(--ease-standard) forwards',
                      transformOrigin: 'inline-start',
                    }
                  : undefined
              }
            />
          )}
        </Fragment>
      ))}
    </ol>
  );
}

function inferState(index: number, current: number): StageState {
  if (index < current) return 'complete';
  if (index === current) return 'current';
  return 'upcoming';
}

function StepDot({ state, index }: { state: StageState; index: number }): JSX.Element {
  const base =
    'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border text-2xs font-numeric tnum';
  if (state === 'complete') {
    return (
      <span className={cn(base, 'border-teal-500 bg-teal-500 text-white')}>
        <Check size={11} strokeWidth={2.4} />
      </span>
    );
  }
  if (state === 'current') {
    return (
      <span
        className={cn(base, 'border-teal-500 bg-teal-500 text-white')}
        style={{ animation: 'stageStepperPulse 2s ease-in-out infinite' }}
      >
        {index + 1}
      </span>
    );
  }
  if (state === 'blocked') {
    return (
      <span className={cn(base, 'border-terra-500 bg-surface-card text-terra-500')}>
        <Lock size={10} strokeWidth={2} />
      </span>
    );
  }
  if (state === 'skipped') {
    return (
      <span className={cn(base, 'border-dashed border-ink-300 bg-surface-card text-ink-400')}>
        <Minus size={10} strokeWidth={2} />
      </span>
    );
  }
  return (
    <span className={cn(base, 'border-ink-300 bg-surface-card text-ink-400')}>
      <span>{index + 1}</span>
    </span>
  );
}
