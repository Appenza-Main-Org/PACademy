/**
 * Wizard — multi-step form skeleton.
 * Source: Tasks/DESIGN_SYSTEM.md §4.7.
 *
 * Layout: 2-column on desktop — left 30% (vertical stepper) + right 70% (current
 * step content). On mobile, stepper collapses to a single-line breadcrumb above.
 *
 * Each step has its own zod schema; submit happens on the final step. Drafts
 * auto-save every 8 seconds via a debounced mutation in the consumer page.
 *
 * Used by: applicant 11-stage portal, biometric 4-step enrollment, exam
 * creation 5-step builder.
 *
 * Usage:
 *   <Wizard
 *     title="تسجيل المتقدم"
 *     steps={[{ key: 'auth', label: 'التحقق', state: 'current' }, ...]}
 *     activeStepKey="auth"
 *     onStepClick={(key) => navigate(`/applicant/${key}`)}
 *     onBack={...} onSaveDraft={...} onNext={...}
 *     autoSaveStatus="saved"
 *   >
 *     {currentStepContent}
 *   </Wizard>
 */

import type { ReactNode } from 'react';
import { Check, Lock, Minus } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Button } from './Button';

export type WizardStepState = 'complete' | 'current' | 'upcoming' | 'blocked' | 'skipped';

export interface WizardStep {
  key: string;
  label: string;
  helper?: string;
  state: WizardStepState;
}

interface WizardProps {
  title?: ReactNode;
  steps: readonly WizardStep[];
  activeStepKey: string;
  onStepClick?: (key: string) => void;

  /** Footer actions */
  onBack?: () => void;
  onSaveDraft?: () => void;
  onNext?: () => void;
  isFinalStep?: boolean;
  isSubmitting?: boolean;

  /** Auto-save indicator state. */
  autoSaveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  autoSaveLabel?: string;

  /** Step content. */
  children: ReactNode;
  className?: string;
}

export function Wizard({
  title,
  steps,
  activeStepKey,
  onStepClick,
  onBack,
  onSaveDraft,
  onNext,
  isFinalStep = false,
  isSubmitting = false,
  autoSaveStatus = 'idle',
  autoSaveLabel,
  children,
  className,
}: WizardProps): JSX.Element {
  const activeIndex = Math.max(0, steps.findIndex((s) => s.key === activeStepKey));

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {(title || autoSaveStatus !== 'idle') && (
        <header className="flex items-center justify-between gap-4 px-6 py-4">
          <div className="min-w-0 flex-1">
            {title && <h1 className="text-xl font-bold text-ink-900">{title}</h1>}
            <p className="mt-1 text-sm text-ink-500" dir="rtl">
              الخطوة <span className="font-numeric tnum">{activeIndex + 1}</span> من{' '}
              <span className="font-numeric tnum">{steps.length}</span>
            </p>
          </div>
          <AutoSaveIndicator status={autoSaveStatus} label={autoSaveLabel} />
        </header>
      )}

      <div className="grid flex-1 gap-6 px-6 pb-24 md:grid-cols-[minmax(220px,30%)_1fr]">
        {/* Stepper (vertical on desktop) */}
        <nav aria-label="مراحل النموذج" className="hidden md:block">
          <VerticalStepper steps={steps} activeKey={activeStepKey} onStepClick={onStepClick} />
        </nav>

        {/* Mobile breadcrumb */}
        <nav aria-label="مراحل النموذج" className="md:hidden">
          <div className="overflow-x-auto pb-2 text-sm">
            <ol className="flex items-center gap-2 whitespace-nowrap text-ink-500">
              {steps.map((s, i) => (
                <li key={s.key} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onStepClick?.(s.key)}
                    disabled={s.state === 'blocked' || s.state === 'upcoming'}
                    className={cn(
                      'rounded-md px-2 py-1 transition-colors duration-fast ease-standard',
                      s.key === activeStepKey
                        ? 'bg-teal-50 font-bold text-teal-700'
                        : 'hover:bg-ink-50',
                      s.state === 'complete' && 'text-success',
                      s.state === 'blocked' && 'cursor-not-allowed text-terra-500',
                    )}
                  >
                    {s.label}
                  </button>
                  {i < steps.length - 1 && <span className="text-ink-300">›</span>}
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <div className="min-w-0">{children}</div>
      </div>

      {(onBack || onSaveDraft || onNext) && (
        <footer
          className="fixed inset-x-0 bottom-0 border-t border-border-subtle bg-surface-card px-6 py-4 shadow-md"
          style={{ zIndex: 'var(--z-sticky)' as unknown as number }}
        >
          <div className="flex items-center justify-between gap-3">
            {onBack ? (
              <Button variant="ghost" onClick={onBack} disabled={isSubmitting}>
                السابق
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              {onSaveDraft && (
                <Button variant="secondary" onClick={onSaveDraft} disabled={isSubmitting}>
                  حفظ كمسودة
                </Button>
              )}
              {onNext && (
                <Button variant="primary" onClick={onNext} isLoading={isSubmitting}>
                  {isFinalStep ? 'إرسال' : 'التالي'}
                </Button>
              )}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

function VerticalStepper({
  steps,
  activeKey,
  onStepClick,
}: {
  steps: readonly WizardStep[];
  activeKey: string;
  onStepClick?: (key: string) => void;
}): JSX.Element {
  return (
    <ol className="flex flex-col gap-1">
      {steps.map((s, i) => {
        const isActive = s.key === activeKey;
        const clickable = s.state !== 'blocked' && s.state !== 'upcoming' && Boolean(onStepClick);
        return (
          <li key={s.key} className="relative">
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  'absolute top-9 h-[calc(100%-1.5rem)] w-px',
                  s.state === 'complete' ? 'bg-teal-500' : 'bg-ink-200',
                )}
                style={{ insetInlineStart: '15px' }}
              />
            )}
            <button
              type="button"
              onClick={clickable ? () => onStepClick?.(s.key) : undefined}
              disabled={!clickable}
              aria-current={isActive ? 'step' : undefined}
              className={cn(
                'relative flex w-full items-start gap-3 rounded-md px-2 py-2 text-start transition-colors duration-fast ease-standard',
                clickable && 'hover:bg-ink-50',
                !clickable && 'cursor-default',
                isActive && 'bg-accent-50',
              )}
            >
              <StepDot state={s.state} index={i} />
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    'block text-sm leading-snug',
                    s.state === 'current' && 'font-bold text-ink-900',
                    s.state === 'complete' && 'font-medium text-ink-900',
                    s.state === 'upcoming' && 'text-ink-400',
                    s.state === 'blocked' && 'text-terra-700',
                    s.state === 'skipped' && 'italic text-ink-400',
                  )}
                >
                  {s.label}
                </span>
                {s.helper && s.state === 'current' && (
                  <span className="mt-0.5 block text-xs text-ink-500">{s.helper}</span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function StepDot({ state, index }: { state: WizardStepState; index: number }): JSX.Element {
  const base =
    'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border text-xs font-medium font-numeric tnum';
  if (state === 'complete') {
    return (
      <span className={cn(base, 'border-teal-500 bg-teal-500 text-white')}>
        <Check size={14} strokeWidth={2.2} />
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
        <Lock size={12} strokeWidth={2} />
      </span>
    );
  }
  if (state === 'skipped') {
    return (
      <span className={cn(base, 'border-dashed border-ink-300 bg-surface-card text-ink-400')}>
        <Minus size={12} strokeWidth={2} />
      </span>
    );
  }
  /* upcoming */
  return (
    <span className={cn(base, 'border-ink-300 bg-surface-card text-ink-400')}>{index + 1}</span>
  );
}

function AutoSaveIndicator({
  status,
  label,
}: {
  status: 'idle' | 'saving' | 'saved' | 'error';
  label?: string;
}): JSX.Element | null {
  if (status === 'idle') return null;
  const map = {
    saving: { tone: 'text-ink-500', text: label ?? 'جارٍ الحفظ…' },
    saved: { tone: 'text-success', text: label ?? 'تم الحفظ' },
    error: { tone: 'text-terra-500', text: label ?? 'تعذر الحفظ' },
  } as const;
  const cfg = map[status];
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn('inline-flex items-center gap-2 text-xs', cfg.tone)}
    >
      <span
        aria-hidden
        className={cn(
          'h-2 w-2 rounded-full',
          status === 'saving' && 'bg-ink-300',
          status === 'saved' && 'bg-success',
          status === 'error' && 'bg-terra-500',
        )}
      />
      {cfg.text}
    </span>
  );
}
