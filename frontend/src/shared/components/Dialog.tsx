/**
 * Dialog — generic centered overlay (non-destructive flow).
 *
 * Built on `@radix-ui/react-dialog`. Same shell as `AlertDialog` but closable
 * and without a required action slot. Use this for forms, detail views, and
 * any modal that isn't an irreversible confirmation.
 *
 * Behaviour
 * ---------
 *  • controlled via `open` + `onOpenChange`
 *  • Esc closes (Radix default)
 *  • outside click closes (Radix default; can be disabled via `closeOnOutsideClick={false}`)
 *  • close button rendered top-end with the same hover/focus treatment used in Modal
 *  • focus is trapped, returned to trigger on close
 *
 * Visual
 * ------
 *  • surface-elevated card, rounded-xl, shadow-xl, p-6
 *  • size variants: sm (560px) · md (720px) · lg (920px)
 *  • title in `font-ar-display`, optional description in `font-ar`
 *  • motion via the existing `modalEnter` keyframe (reduced-motion safe)
 *
 * Usage
 * -----
 *   const [open, setOpen] = useState(false);
 *   <Dialog
 *     open={open}
 *     onOpenChange={setOpen}
 *     size="md"
 *     title="تفاصيل المتقدم"
 *     description="عرض كامل لبيانات الملف"
 *   >
 *     <p>...body...</p>
 *   </Dialog>
 */

import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

export type DialogSize = 'sm' | 'md' | 'lg';

interface DialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Optional footer slot — typically buttons. */
  footer?: ReactNode;
  size?: DialogSize;
  /** Show the X close button in the corner. Defaults to true. */
  showCloseButton?: boolean;
  /** Click outside dismisses. Defaults to true. */
  closeOnOutsideClick?: boolean;
  className?: string;
}

const SIZE_PX: Record<DialogSize, string> = {
  sm: '560px',
  md: '720px',
  lg: '920px',
};

const OVERLAY_ANIM = 'modalBackdropEnter var(--duration-base) var(--ease-standard)';
const CONTENT_ANIM = 'modalEnter var(--duration-slow) var(--ease-standard)';

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  showCloseButton = true,
  closeOnOutsideClick = true,
  className,
}: DialogProps): JSX.Element {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          className="fixed inset-0 z-modal-backdrop bg-[var(--surface-overlay)]"
          style={{ animation: OVERLAY_ANIM }}
        />
        <RadixDialog.Content
          dir="rtl"
          onInteractOutside={(event) => {
            /* Portaled popovers (Combobox, MultiSelect, DatePicker)
             * render into document.body and Radix treats clicks on them
             * as "outside." Without this guard, clicking an option in
             * one of our dropdowns dismisses the dialog before the
             * selection commits. Each portaled popover marks itself with
             * data-portal-popover so we can recognise it here. */
            const target = event.target as Element | null;
            if (target?.closest('[data-portal-popover]')) {
              event.preventDefault();
              return;
            }
            if (!closeOnOutsideClick) event.preventDefault();
          }}
          className={cn(
            'fixed top-1/2 z-modal w-[min(92vw,var(--dialog-w))] -translate-y-1/2',
            'start-1/2 -translate-x-1/2 rtl:translate-x-1/2',
            'flex max-h-[90vh] flex-col overflow-hidden',
            'rounded-xl border border-border-subtle bg-surface-elevated shadow-xl',
            'outline-none',
            className,
          )}
          style={{
            animation: CONTENT_ANIM,
            ['--dialog-w' as string]: SIZE_PX[size],
          }}
        >
          {(title || showCloseButton) && (
            <header className="flex flex-none items-start justify-between gap-4 border-b border-border-subtle px-6 py-5">
              <div className="min-w-0 flex-1">
                {title && (
                  <RadixDialog.Title className="font-ar-display text-xl font-bold text-ink-900 leading-tight">
                    {title}
                  </RadixDialog.Title>
                )}
                {description && (
                  <RadixDialog.Description className="mt-1 font-ar text-sm text-ink-500 leading-normal">
                    {description}
                  </RadixDialog.Description>
                )}
              </div>
              {showCloseButton && (
                <RadixDialog.Close
                  aria-label="إغلاق"
                  className={cn(
                    '-me-2 -mt-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-500',
                    'transition-colors duration-fast ease-standard',
                    'hover:bg-ink-50 hover:text-ink-900',
                    'focus-visible:shadow-[var(--ring)] focus-visible:outline-none',
                  )}
                >
                  <X size={18} strokeWidth={1.75} />
                </RadixDialog.Close>
              )}
            </header>
          )}

          <div className="min-h-0 flex-1 overflow-auto px-6 py-6">{children}</div>

          {footer && (
            <footer className="flex flex-none items-center justify-end gap-2 border-t border-border-subtle px-6 py-4">
              {footer}
            </footer>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
