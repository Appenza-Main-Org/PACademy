/**
 * Tooltip — text-only label that appears after a 200ms hover/focus delay.
 *
 * Built on `@radix-ui/react-tooltip`. For terse hints on icon buttons,
 * truncated text, and any control whose meaning needs reinforcement.
 *
 * Behaviour
 * ---------
 *  • 200ms delay (per brief) on open; closes immediately on leave/blur
 *  • Esc dismisses
 *  • collision-aware positioning, RTL-safe (Radix Popper)
 *  • a single `<TooltipProvider>` is mounted once at app root by the consumer;
 *    we re-export it for convenience
 *
 * Visual
 * ------
 *  • dark ink-900 surface, white text — small, terse
 *  • rounded-md, shadow-sm, max-width clamps long copy
 *
 * Usage
 * -----
 *   // Once at the top of the tree:
 *   <TooltipProvider><App/></TooltipProvider>
 *
 *   // Then anywhere:
 *   <Tooltip content="نسخ الرقم القومي">
 *     <button aria-label="نسخ"><Copy size={16}/></button>
 *   </Tooltip>
 */

import * as RadixTooltip from '@radix-ui/react-tooltip';
import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

interface TooltipProviderProps {
  children: ReactNode;
  /** Override the global delay. Defaults to 200ms per brief. */
  delayDuration?: number;
}

export function TooltipProvider({
  children,
  delayDuration = 200,
}: TooltipProviderProps): JSX.Element {
  return (
    <RadixTooltip.Provider delayDuration={delayDuration} skipDelayDuration={100}>
      {children}
    </RadixTooltip.Provider>
  );
}

interface TooltipProps {
  /** The tooltip body — text only, kept terse. */
  content: ReactNode;
  /** The trigger element. Must be a single focusable element. */
  children: ReactNode;
  /** `top` | `right` | `bottom` | `left`. Defaults to `top`. */
  side?: RadixTooltip.TooltipContentProps['side'];
  /** `start` | `center` | `end`. Defaults to `center`. */
  align?: RadixTooltip.TooltipContentProps['align'];
  /** Per-instance delay override (ms). */
  delayDuration?: number;
  /** Tooltip is open when controlled. */
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
  className?: string;
}

export const Tooltip = forwardRef<HTMLDivElement, TooltipProps>(
  ({ content, children, side = 'top', align = 'center', delayDuration, open, onOpenChange, className }, ref) => (
    <RadixTooltip.Root delayDuration={delayDuration} open={open} onOpenChange={onOpenChange}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          ref={ref}
          side={side}
          align={align}
          sideOffset={6}
          dir="rtl"
          className={cn(
            'z-tooltip max-w-64 rounded-md bg-ink-900 px-3 py-1.5',
            'font-ar text-2xs text-white shadow-sm',
            'select-none',
            className,
          )}
          style={{ animation: 'pageEnter var(--duration-fast) var(--ease-standard)' }}
        >
          {content}
          <RadixTooltip.Arrow className="fill-ink-900" width={10} height={5} />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  ),
);

Tooltip.displayName = 'Tooltip';
