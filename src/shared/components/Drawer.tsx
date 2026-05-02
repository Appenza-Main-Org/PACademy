/**
 * Drawer — slides in from end-edge (RTL: from the left).
 * Source: Tasks/DESIGN_SYSTEM.md §4.8.
 *
 * Sizes: sm (480px) · md (640px) · lg (840px). Same internal API as Modal.
 * Used for: applicant quick-view, audit detail, biometric history, edit forms.
 *
 * Drawer is preferred over Modal whenever the user might want to compare
 * to the underlying page.
 *
 * Usage:
 *   <Drawer open={open} onClose={() => setOpen(false)} title="تفاصيل المتقدم" size="md">
 *     <Drawer.Body>...</Drawer.Body>
 *     <Drawer.Footer>...</Drawer.Footer>
 *   </Drawer>
 */

import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { prefersReducedMotion } from '@/shared/lib/motion';

export type DrawerSize = 'sm' | 'md' | 'lg';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  size?: DrawerSize;
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
  ariaLabel?: string;
  children: ReactNode;
  className?: string;
}

const SIZE_PX: Record<DrawerSize, number> = { sm: 480, md: 640, lg: 840 };

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  size = 'sm',
  closeOnBackdrop = true,
  closeOnEsc = true,
  ariaLabel,
  children,
  className,
}: DrawerProps): JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const titleId = useRef(`drawer-title-${Math.random().toString(36).slice(2)}`).current;

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
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
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
    <div className="fixed inset-0" style={{ zIndex: 'var(--z-modal)' as unknown as number }}>
      <div
        aria-hidden
        onClick={closeOnBackdrop ? onClose : undefined}
        className="absolute inset-0"
        style={{
          background: 'var(--surface-overlay)',
          backdropFilter: reducedMotion ? undefined : 'blur(2px)',
          animation: reducedMotion
            ? undefined
            : 'modalBackdropEnter var(--duration-base) var(--ease-standard)',
          zIndex: 'var(--z-modal-backdrop)' as unknown as number,
        }}
      />
      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={!title ? ariaLabel : undefined}
        tabIndex={-1}
        className={cn(
          'absolute inset-y-0 flex h-full flex-col bg-surface-elevated shadow-lg',
          'border-s border-border-subtle',
          /* Drawer sits at the end-edge: in RTL that's the left side. */
          'inset-inline-start-0',
          className,
        )}
        style={{
          width: '100%',
          maxWidth: `${SIZE_PX[size]}px`,
          animation: reducedMotion
            ? undefined
            : 'drawerEnterEnd var(--duration-slow) var(--ease-emphasized)',
        }}
      >
        {(title || subtitle) && (
          <header className="flex items-start justify-between gap-4 border-b border-border-subtle px-6 py-5">
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
          </header>
        )}
        <div className="flex-1 overflow-auto">{children}</div>
      </aside>
    </div>
  );

  return createPortal(node, document.body);
}

interface SectionProps {
  children: ReactNode;
  className?: string;
}

Drawer.Body = function DrawerBody({ children, className }: SectionProps): JSX.Element {
  return <div className={cn('px-6 py-6', className)}>{children}</div>;
};

Drawer.Footer = function DrawerFooter({ children, className }: SectionProps): JSX.Element {
  return (
    <footer
      className={cn(
        'sticky bottom-0 flex items-center justify-end gap-2 border-t border-border-subtle bg-surface-elevated px-6 py-4',
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
