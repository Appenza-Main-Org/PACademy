/**
 * Modal — centered overlay with focus trap.
 * Source: Tasks/DESIGN_SYSTEM.md §4.8.
 *
 * Sizes: sm (560px) · md (720px) · lg (920px). Bg surface-elevated, radius xl,
 * shadow xl. Backdrop surface-overlay with backdrop blur (skip if reduced motion).
 * Close button top-end, Esc closes, click-backdrop closes (configurable),
 * focus traps inside, returns focus to trigger on close.
 *
 * Usage:
 *   const [open, setOpen] = useState(false);
 *   <Modal open={open} onClose={() => setOpen(false)} title="تأكيد الحذف">
 *     <Modal.Body>...</Modal.Body>
 *     <Modal.Footer>...</Modal.Footer>
 *   </Modal>
 */

import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { CornerFlourish } from './CornerFlourish';
import { prefersReducedMotion } from '@/shared/lib/motion';

export type ModalSize = 'sm' | 'md' | 'lg';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  size?: ModalSize;
  /** Click-backdrop closes? Defaults to true. */
  closeOnBackdrop?: boolean;
  /** Esc closes? Defaults to true. */
  closeOnEsc?: boolean;
  /** Render heritage corner flourishes inside the modal. Defaults to true. */
  withFlourishes?: boolean;
  /** Render a transparent backdrop (no dim, no blur).
   *  Defaults to TRUE — modals behave as popovers, the page stays
   *  readable behind them. Set to false if you want the heavy dim. */
  transparentBackdrop?: boolean;
  ariaLabel?: string;
  children: ReactNode;
  className?: string;
}

const SIZE_PX: Record<ModalSize, number> = { sm: 560, md: 720, lg: 920 };

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  size = 'sm',
  closeOnBackdrop = true,
  closeOnEsc = true,
  withFlourishes = true,
  transparentBackdrop = true,
  ariaLabel,
  children,
  className,
}: ModalProps): JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const titleId = useRef(`modal-title-${Math.random().toString(36).slice(2)}`).current;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!open) return;
      if (event.key === 'Escape' && closeOnEsc) {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key === 'Tab' && dialogRef.current) {
        const focusables = collectFocusable(dialogRef.current);
        if (focusables.length === 0) {
          event.preventDefault();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    },
    [open, closeOnEsc, onClose],
  );

  useEffect(() => {
    if (!open) return undefined;
    triggerRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown, true);

    /* Focus first focusable in dialog */
    const t = window.setTimeout(() => {
      if (!dialogRef.current) return;
      const focusables = collectFocusable(dialogRef.current);
      (focusables[0] ?? dialogRef.current).focus();
    }, 0);

    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown, true);
      triggerRef.current?.focus?.();
    };
  }, [open, handleKeyDown]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  const reducedMotion = prefersReducedMotion();

  const node = (
    <div
      className="fixed inset-0 flex items-center justify-center px-4"
      style={{ zIndex: 'var(--z-modal)' as unknown as number }}
    >
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={closeOnBackdrop ? onClose : undefined}
        className="absolute inset-0"
        style={{
          background: transparentBackdrop ? 'transparent' : 'var(--surface-overlay)',
          backdropFilter: transparentBackdrop || reducedMotion ? undefined : 'blur(2px)',
          animation: reducedMotion
            ? undefined
            : 'modalBackdropEnter var(--duration-base) var(--ease-standard)',
        }}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={!title ? ariaLabel : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[90vh] w-full flex-col overflow-hidden bg-surface-elevated shadow-xl',
          'rounded-xl border border-border-subtle',
          className,
        )}
        style={{
          maxWidth: `${SIZE_PX[size]}px`,
          animation: reducedMotion
            ? undefined
            : 'modalEnter var(--duration-slow) var(--ease-standard)',
        }}
      >
        {withFlourishes && (
          <>
            <CornerFlourish corner="tl" />
            <CornerFlourish corner="tr" />
            <CornerFlourish corner="bl" />
            <CornerFlourish corner="br" />
          </>
        )}

        {(title || subtitle) && (
          <header className="flex-none border-b border-border-subtle px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                {title && (
                  <h2 id={titleId} className="text-xl font-bold text-ink-900">
                    {title}
                  </h2>
                )}
                {subtitle && (
                  <p className="mt-1 text-sm text-ink-500 leading-normal">{subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق"
                className="-me-2 -mt-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-500 transition-colors duration-fast ease-standard hover:bg-ink-50 hover:text-ink-900 focus-visible:shadow-focus-teal focus-visible:outline-none"
              >
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>
          </header>
        )}

        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}

interface SectionProps {
  children: ReactNode;
  className?: string;
}

Modal.Body = function ModalBody({ children, className }: SectionProps): JSX.Element {
  return <div className={cn('min-h-0 flex-1 overflow-auto px-6 py-6', className)}>{children}</div>;
};

Modal.Footer = function ModalFooter({ children, className }: SectionProps): JSX.Element {
  return (
    <footer
      className={cn(
        'flex flex-none items-center justify-end gap-2 border-t border-border-subtle px-6 py-4',
        className,
      )}
    >
      {children}
    </footer>
  );
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function collectFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('aria-hidden'),
  );
}
