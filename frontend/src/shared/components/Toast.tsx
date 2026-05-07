/**
 * Toast — Zustand-backed mini toast system.
 * Source: Tasks/DESIGN_SYSTEM.md §4.9.
 *
 * Position: bottom-end (RTL: bottom-left), 16px margin from edge.
 * Kinds: success · info · warning · danger.
 * Width: 360px max, auto on small viewports.
 * Auto-dismiss: 4s default, 6s warning, no auto-dismiss for danger with action.
 */

import { useEffect } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { create } from 'zustand';
import { cn } from '@/shared/lib/cn';

export type ToastKind = 'success' | 'danger' | 'warning' | 'info';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastEntry {
  id: number;
  message: string;
  kind: ToastKind;
  action?: ToastAction;
}

interface ToastState {
  items: ToastEntry[];
  push: (message: string, kind?: ToastKind, action?: ToastAction) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

const AUTO_DISMISS_MS: Record<ToastKind, number> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  danger: 6000,
};

const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (message, kind = 'info', action) => {
    const id = nextId;
    nextId += 1;
    set((state) => ({ items: [...state.items, { id, message, kind, action }] }));
    /* Danger toasts with an action stay until dismissed; others auto-clear. */
    if (kind !== 'danger' || !action) {
      const ms = AUTO_DISMISS_MS[kind];
      window.setTimeout(
        () => set((state) => ({ items: state.items.filter((t) => t.id !== id) })),
        ms,
      );
    }
  },
  dismiss: (id) => set((state) => ({ items: state.items.filter((t) => t.id !== id) })),
}));

/** Show a toast. The 4-arg legacy signature `(msg, kind)` is preserved. */
export function toast(message: string, kind: ToastKind = 'info', action?: ToastAction): void {
  useToastStore.getState().push(message, kind, action);
}

const ICON_MAP: Record<ToastKind, JSX.Element> = {
  success: <CheckCircle2 size={18} strokeWidth={1.75} aria-hidden />,
  info: <Info size={18} strokeWidth={1.75} aria-hidden />,
  warning: <AlertTriangle size={18} strokeWidth={1.75} aria-hidden />,
  danger: <AlertCircle size={18} strokeWidth={1.75} aria-hidden />,
};

const KIND_CLASS: Record<ToastKind, string> = {
  success: 'border-success bg-success-bg text-success',
  info: 'border-teal-500 bg-teal-50 text-teal-700',
  warning: 'border-gold-500 bg-gold-50 text-gold-700',
  danger: 'border-terra-500 bg-terra-50 text-terra-700',
};

export function ToastViewport(): JSX.Element {
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => () => useToastStore.setState({ items: [] }), []);

  return (
    <div
      role="region"
      aria-label="إشعارات"
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 inset-inline-end-4 flex max-w-[360px] flex-col gap-2"
      style={{ zIndex: 'var(--z-toast)' as unknown as number }}
    >
      {items.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'danger' ? 'alert' : 'status'}
          className={cn(
            'pointer-events-auto flex items-start gap-3 rounded-md border bg-surface-card px-4 py-3 text-sm shadow-md',
            KIND_CLASS[t.kind],
          )}
          style={{ animation: 'toastSlideIn var(--duration-base) var(--ease-emphasized)' }}
        >
          <span className="mt-0.5 flex-shrink-0">{ICON_MAP[t.kind]}</span>
          <p className="min-w-0 flex-1 text-ink-900">{t.message}</p>
          {t.action && (
            <button
              type="button"
              onClick={() => {
                t.action?.onClick();
                dismiss(t.id);
              }}
              className="rounded-md px-2 py-1 text-xs font-medium hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none"
            >
              {t.action.label}
            </button>
          )}
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="rounded-md p-1 text-ink-500 hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none"
            aria-label="إغلاق"
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        </div>
      ))}
    </div>
  );
}
