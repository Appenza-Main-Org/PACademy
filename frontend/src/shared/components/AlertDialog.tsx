/**
 * AlertDialog — destructive / chief-approval confirmation overlay.
 *
 * Built on `@radix-ui/react-alert-dialog`. Used for the §4 two-phase signature
 * flow (preliminary → final approval) and any other action that requires an
 * explicit deliberate choice. Per CLAUDE.md §2.5 this is the *only* place the
 * Radix primitive is consumed — features import from `@/shared/components`.
 *
 * Behaviour
 * ---------
 *  • controlled via `open` + `onOpenChange`
 *  • Esc → cancel (Radix default)
 *  • outside click → cancel (treated as the soft equivalent of pressing Cancel)
 *  • focus is trapped, returned to trigger on close
 *  • ARIA role="alertdialog" with title + description wired up automatically
 *
 * Visual
 * ------
 *  • surface-elevated card, rounded-xl, shadow-xl
 *  • title in `font-ar-display` (Tajawal), description in `font-ar` (IBM Plex Sans Arabic)
 *  • backdrop dims via `--surface-overlay`. Both use the existing `modalEnter` /
 *    `modalBackdropEnter` keyframes from `motifs.css` which already neutralise
 *    under `prefers-reduced-motion: reduce`.
 *
 * Usage
 * -----
 *   const [open, setOpen] = useState(false);
 *   <AlertDialog
 *     open={open}
 *     onOpenChange={setOpen}
 *     title="اعتماد نهائي"
 *     description="بمجرد الاعتماد لا يمكن التراجع. هل أنت متأكد؟"
 *     actionLabel="اعتماد"
 *     onAction={() => approve()}
 *     tone="primary" // or "danger" for destructive intent
 *   />
 */

import * as RadixAlertDialog from '@radix-ui/react-alert-dialog';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { Button } from './Button';

export type AlertDialogTone = 'primary' | 'danger';

interface AlertDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Custom body inserted between description and the action row. */
  children?: ReactNode;
  actionLabel: ReactNode;
  cancelLabel?: ReactNode;
  onAction: () => void;
  /** Tone of the primary action — `primary` (teal) or `danger` (terracotta). */
  tone?: AlertDialogTone;
  /** Disable the action button (e.g. while a mutation is in flight). */
  isActionDisabled?: boolean;
  /** Disable the cancel button while an irreversible async action is running. */
  isCancelDisabled?: boolean;
  /** Show a loading spinner on the action button. */
  isActionLoading?: boolean;
  /** Accessible/action label while the action button is loading. */
  actionLoadingLabel?: string;
  className?: string;
}

const OVERLAY_ANIM = 'modalBackdropEnter var(--duration-base) var(--ease-standard)';
const CONTENT_ANIM = 'modalEnter var(--duration-slow) var(--ease-standard)';

export function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  actionLabel,
  cancelLabel = 'إلغاء',
  onAction,
  tone = 'primary',
  isActionDisabled,
  isCancelDisabled,
  isActionLoading,
  actionLoadingLabel,
  className,
}: AlertDialogProps): JSX.Element {
  return (
    <RadixAlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (isActionLoading && !next) return;
        onOpenChange(next);
      }}
    >
      <RadixAlertDialog.Portal>
        <RadixAlertDialog.Overlay
          /* Radix AlertDialog deliberately omits onInteractOutside (ARIA: alert dialogs
             require an explicit choice). The brief asks for outside-click dismiss, so
             we wire it on the Overlay surface itself. Esc still flows through the
             AlertDialog default to onOpenChange(false). */
          onClick={() => {
            if (!isActionLoading) onOpenChange(false);
          }}
          className="fixed inset-0 z-modal-backdrop bg-[var(--surface-overlay)]"
          style={{ animation: OVERLAY_ANIM }}
        />
        <RadixAlertDialog.Content
          dir="rtl"
          className={cn(
            'fixed top-1/2 z-modal w-[min(92vw,560px)] -translate-y-1/2',
            /* RTL-safe centering: in rtl document this resolves to left:50% + translateX(50%) so the box stays centered. */
            'start-1/2 -translate-x-1/2 rtl:translate-x-1/2',
            'rounded-xl border border-border-subtle bg-surface-elevated shadow-xl',
            'p-6 outline-none',
            className,
          )}
          style={{ animation: CONTENT_ANIM }}
        >
          <RadixAlertDialog.Title className="font-ar-display text-xl font-bold text-ink-900 leading-tight">
            {title}
          </RadixAlertDialog.Title>
          {description && (
            <RadixAlertDialog.Description className="mt-2 font-ar text-sm text-ink-500 leading-normal">
              {description}
            </RadixAlertDialog.Description>
          )}
          {children && <div className="mt-4">{children}</div>}

          <div className="mt-6 flex items-center justify-end gap-2">
            <RadixAlertDialog.Cancel asChild>
              <Button variant="ghost" size="md" disabled={isCancelDisabled || isActionLoading}>
                {cancelLabel}
              </Button>
            </RadixAlertDialog.Cancel>
            <RadixAlertDialog.Action asChild>
              <Button
                variant={tone === 'danger' ? 'danger' : 'primary'}
                size="md"
                onClick={(event) => {
                  /* Run consumer handler before Radix auto-closes — they may
                     want to gate the close on async confirmation. */
                  event.preventDefault();
                  onAction();
                }}
                disabled={isActionDisabled}
                isLoading={isActionLoading}
                loadingLabel={actionLoadingLabel}
              >
                {actionLabel}
              </Button>
            </RadixAlertDialog.Action>
          </div>
        </RadixAlertDialog.Content>
      </RadixAlertDialog.Portal>
    </RadixAlertDialog.Root>
  );
}
