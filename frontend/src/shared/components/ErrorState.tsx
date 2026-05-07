/**
 * ErrorState — first-class error composition.
 * Source: Tasks/DESIGN_SYSTEM.md §4.10.
 *
 * 120px illustration with terra-500 accents, Arabic title "تعذر تحميل البيانات",
 * description with the actual error message, two CTAs ("إعادة المحاولة" primary +
 * "العودة" ghost). Logs to client error-tracking on mount.
 *
 * Usage:
 *   <ErrorState error={err} onRetry={refetch} />
 *   <ErrorState title="فشل حفظ التغييرات" description={err.message} onRetry={mutate} />
 */

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { Button } from './Button';

interface ErrorStateProps {
  /** The Error or unknown thrown by the failing operation. */
  error?: unknown;
  /** Optional title — defaults to "تعذر تحميل البيانات". */
  title?: string;
  /** Optional description — defaults to error.message if `error` is an Error. */
  description?: string;
  onRetry?: () => void;
  onBack?: () => void;
  /** Custom illustration to override the default. */
  icon?: ReactNode;
  /** Additional actions rendered after Retry/Back. */
  extraActions?: ReactNode;
  className?: string;
}

export function ErrorState({
  error,
  title = 'تعذر تحميل البيانات',
  description,
  onRetry,
  onBack,
  icon,
  extraActions,
  className,
}: ErrorStateProps): JSX.Element {
  const message = description ?? extractMessage(error);

  useEffect(() => {
    if (error) {
      // Best-effort client-side logging — wired to a real tracker in Sprint 10.
      console.error('[ErrorState]', error);
    }
  }, [error]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'mx-auto flex max-w-[440px] flex-col items-center justify-center px-6 py-9 text-center',
        className,
      )}
    >
      <div className="mb-5">{icon ?? <DefaultErrorIllustration />}</div>
      <h3 className="mb-2 font-medium text-md text-ink-900">{title}</h3>
      {message && <p className="mb-5 text-sm text-ink-500 leading-normal">{message}</p>}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {onRetry && (
          <Button variant="primary" onClick={onRetry}>
            إعادة المحاولة
          </Button>
        )}
        {onBack && (
          <Button variant="ghost" onClick={onBack}>
            العودة
          </Button>
        )}
        {extraActions}
      </div>
    </div>
  );
}

function extractMessage(error: unknown): string | undefined {
  if (!error) return undefined;
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return undefined;
}

function DefaultErrorIllustration(): JSX.Element {
  /* 120px circle in cream with a terra-toned warning composition. */
  return (
    <svg width={120} height={120} viewBox="0 0 120 120" aria-hidden role="presentation">
      <circle cx={60} cy={60} r={54} fill="var(--ink-50)" stroke="var(--terra-300)" strokeWidth={1} />
      <g fill="none" stroke="var(--terra-500)" strokeWidth={1.75} strokeLinecap="round">
        <path d="M60 36 L60 66" />
        <circle cx={60} cy={78} r={1.6} fill="var(--terra-500)" />
        <path d="M44 92 L76 92" strokeWidth={1} stroke="var(--terra-300)" />
      </g>
      <g stroke="var(--gold-500)" strokeWidth={0.5} fill="none">
        <path d="M14 14h6 M14 14v6" />
        <path d="M106 14h-6 M106 14v6" />
        <path d="M14 106h6 M14 106v-6" />
        <path d="M106 106h-6 M106 106v-6" />
      </g>
    </svg>
  );
}
