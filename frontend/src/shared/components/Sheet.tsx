/**
 * Sheet — side drawer variant of Dialog.
 *
 * Built on `@radix-ui/react-dialog` (same primitive as `Dialog`) but pinned to
 * the document end-edge and animated with `drawerEnterEnd`. Per the brief, the
 * side is `end` — in RTL Arabic this resolves to the left edge of the viewport,
 * which is what the existing legacy `Drawer` does. A `data-side="end"` attribute
 * is set on Content so RTL-aware overrides can hook on it later.
 *
 * Behaviour
 * ---------
 *  • controlled via `open` + `onOpenChange`
 *  • Esc + outside-click dismiss
 *  • close button rendered top-end with the same pattern as `Dialog`
 *  • focus trapped, returned to trigger
 *
 * Visual
 * ------
 *  • surface-elevated panel pinned to end-edge, full height, shadow-xl
 *  • size variants: sm (480px) · md (640px) · lg (840px)
 *  • slides in via `drawerEnterEnd` keyframe (reduced-motion safe)
 *
 * Usage
 * -----
 *   const [open, setOpen] = useState(false);
 *   <Sheet
 *     open={open}
 *     onOpenChange={setOpen}
 *     size="md"
 *     title="تفاصيل المتقدم"
 *     description="عرض جانبي يبقى الصفحة الأم مرئية"
 *   >
 *     <p>...body...</p>
 *   </Sheet>
 */

import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

export type SheetSize = 'sm' | 'md' | 'lg';

interface SheetProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Optional footer slot — typically buttons. */
  footer?: ReactNode;
  size?: SheetSize;
  /** Click outside dismisses. Defaults to true. */
  closeOnOutsideClick?: boolean;
  className?: string;
}

const SIZE_PX: Record<SheetSize, string> = {
  sm: '480px',
  md: '640px',
  lg: '840px',
};

const OVERLAY_ANIM = 'modalBackdropEnter var(--duration-base) var(--ease-standard)';
const CONTENT_ANIM = 'drawerEnterEnd var(--duration-slow) var(--ease-emphasized)';

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'sm',
  closeOnOutsideClick = true,
  className,
}: SheetProps): JSX.Element {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          className="fixed inset-0 z-modal-backdrop bg-[var(--surface-overlay)]"
          style={{ animation: OVERLAY_ANIM }}
        />
        <RadixDialog.Content
          dir="rtl"
          data-side="end"
          onInteractOutside={(event) => {
            if (!closeOnOutsideClick) event.preventDefault();
          }}
          className={cn(
            /* end edge in logical coordinates: top:0 + end:0 + full height. */
            'fixed top-0 end-0 z-modal h-screen w-[min(92vw,var(--sheet-w))]',
            'flex flex-col overflow-hidden',
            'border-s border-border-subtle bg-surface-elevated shadow-xl',
            'outline-none',
            className,
          )}
          style={{
            animation: CONTENT_ANIM,
            ['--sheet-w' as string]: SIZE_PX[size],
          }}
        >
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
          </header>

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
