/**
 * SessionStatusBadge — colour-and-dot badge for live exam sessions.
 *
 * Status colour map (matches the KPI strip on the proctor page):
 *  not-started → ink-400 (neutral)
 *  started     → accent-500 (per-app accent, dot)
 *  in-progress → gold-500 (pulsing dot)
 *  dropped     → terra-500 (terminal failure)
 *  finished    → success
 */

import { Badge } from '@/shared/components';
import type { BadgeTone } from '@/shared/components';
import type { SessionStatus } from '@/shared/types/domain';

interface SessionStatusBadgeProps {
  status: SessionStatus;
  /** Show a live dot for in-progress sessions (pulsing). Defaults to true. */
  pulse?: boolean;
}

export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  'not-started': 'لم يبدأ',
  started: 'بدأ',
  'in-progress': 'قيد التقدّم',
  dropped: 'انقطع',
  finished: 'انتهى',
};

const TONE: Record<SessionStatus, BadgeTone> = {
  'not-started': 'neutral',
  started: 'info',
  'in-progress': 'warning',
  dropped: 'danger',
  finished: 'success',
};

const COLOR: Record<SessionStatus, string> = {
  'not-started': 'var(--ink-400)',
  started: 'var(--accent-500)',
  'in-progress': 'var(--gold-500)',
  dropped: 'var(--terra-500)',
  finished: 'var(--success)',
};

export function SessionStatusBadge({ status, pulse = true }: SessionStatusBadgeProps): JSX.Element {
  const wantsPulse = pulse && status === 'in-progress';
  return (
    <Badge tone={TONE[status]}>
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
        style={{
          background: COLOR[status],
          animation: wantsPulse
            ? 'sessionPulse 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite'
            : undefined,
        }}
      />
      {SESSION_STATUS_LABEL[status]}
    </Badge>
  );
}

export const SESSION_STATUS_COLOR = COLOR;
