/**
 * RowVersionConflictDialog — surfaced when the server returns 409 ROW_VERSION_CONFLICT.
 *
 * Shows the entity that was modified concurrently, the user's in-flight edits
 * (if provided), and offers a "Refresh and re-apply" action to reload the
 * server's current state. The dialog is non-dismissible until the user acts.
 *
 * Usage:
 *   <RowVersionConflictDialog
 *     open={!!conflict}
 *     entityType={conflict?.entityType}
 *     messageAr={conflict?.messageAr}
 *     inFlightValues={pendingEdits}
 *     onRefresh={() => { refetch(); setConflict(null); }}
 *     onDiscard={() => { setConflict(null); }}
 *   />
 */

import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, AlertTriangle } from 'lucide-react';

export interface RowVersionConflictDialogProps {
  open: boolean;
  entityType?: string;
  messageAr?: string;
  /** Optional object of the in-flight form values the admin was saving. */
  inFlightValues?: Record<string, unknown>;
  /** Called when the user chooses to refresh — should refetch the entity. */
  onRefresh: () => void;
  /** Called when the user discards their in-flight changes. */
  onDiscard: () => void;
}

export function RowVersionConflictDialog({
  open,
  entityType,
  messageAr,
  inFlightValues,
  onRefresh,
  onDiscard,
}: RowVersionConflictDialogProps): ReactNode {
  if (!open) return null;

  const hasInFlight =
    inFlightValues && Object.keys(inFlightValues).length > 0;

  return createPortal(
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="rv-conflict-title"
      aria-describedby="rv-conflict-desc"
      className="fixed inset-0 z-[9000] flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm" />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md rounded-xl bg-white shadow-2xl border border-ink-200">
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-ink-100">
          <AlertTriangle
            className="mt-0.5 shrink-0 text-terra-500"
            size={20}
            aria-hidden="true"
          />
          <div>
            <h2
              id="rv-conflict-title"
              className="text-sm font-semibold text-ink-900"
            >
              تعارض في البيانات
            </h2>
            <p
              id="rv-conflict-desc"
              className="mt-1 text-xs text-ink-500 leading-relaxed"
            >
              {messageAr ??
                'تم تعديل هذا السجل من قِبَل مستخدم آخر — لا يمكن حفظ تغييراتك فوق نسخة أحدث.'}
              {entityType && (
                <span className="ms-1 font-mono text-ink-400">
                  ({entityType})
                </span>
              )}
            </p>
          </div>
        </div>

        {/* In-flight diff (optional) */}
        {hasInFlight && (
          <div className="px-5 py-4 border-b border-ink-100">
            <p className="mb-2 text-xs font-medium text-ink-600">
              التغييرات التي لم تُحفظ:
            </p>
            <pre className="max-h-40 overflow-auto rounded-lg bg-ink-50 p-3 text-[11px] font-mono text-ink-700 leading-relaxed">
              {JSON.stringify(inFlightValues, null, 2)}
            </pre>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 p-4 justify-end">
          <button
            type="button"
            onClick={onDiscard}
            className="px-4 py-2 text-xs font-medium text-ink-600 hover:text-ink-800 transition-colors"
          >
            تجاهل تغييراتي
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-xs font-medium text-white hover:bg-teal-700 transition-colors focus-visible:outline-2 focus-visible:outline-teal-600"
          >
            <RefreshCw size={14} aria-hidden="true" />
            تحديث وإعادة المحاولة
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
