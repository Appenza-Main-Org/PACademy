/**
 * useConflictDialog — connects mutation 409 errors to the RowVersionConflictDialog.
 *
 * Wizard pages call `reportConflict(err, inFlightValues?)` in their mutation
 * `onError`. The hook persists the conflict state via `wizard-draft.ts`
 * (survives remounts inside the same tab) and returns props to spread on
 * `<RowVersionConflictDialog>`.
 *
 * Server-state wins only on explicit "تحديث وإعادة المحاولة" — until then
 * in-flight values remain in the form so the admin can copy them manually
 * (FR-013 requirement).
 *
 * Usage:
 *   const conflict = useConflictDialog(cycleId, refetchFn);
 *
 *   // in mutation onError:
 *   onError: (err) => conflict.reportConflict(err, { field: currentValue }),
 *
 *   // in JSX:
 *   <RowVersionConflictDialog {...conflict.dialogProps} />
 */

import { useCallback, useEffect, useState } from 'react';
import { RowVersionConflictError } from '@/shared/api/errors';
import {
  clearConflict,
  readConflict,
  writeConflict,
  type ConflictState,
} from './wizard-draft';

interface UseConflictDialogResult {
  /** Spread on `<RowVersionConflictDialog>`. */
  dialogProps: {
    open: boolean;
    entityType?: string;
    messageAr?: string;
    inFlightValues?: Record<string, unknown>;
    onRefresh: () => void;
    onDiscard: () => void;
  };
  /**
   * Call in mutation `onError`. If the error is a `RowVersionConflictError`,
   * writes the conflict state and opens the dialog. Otherwise re-throws so
   * the caller can show a generic error toast.
   */
  reportConflict: (err: unknown, inFlightValues?: Record<string, unknown>) => void;
}

export function useConflictDialog(
  cycleId: string | null,
  onRefresh: () => void,
): UseConflictDialogResult {
  const [state, setState] = useState<ConflictState | null>(() =>
    cycleId ? readConflict(cycleId) : null,
  );

  // Re-read from storage if cycleId changes (e.g. wizard navigates to different cycle).
  useEffect(() => {
    setState(cycleId ? readConflict(cycleId) : null);
  }, [cycleId]);

  const reportConflict = useCallback(
    (err: unknown, inFlightValues?: Record<string, unknown>) => {
      if (err instanceof RowVersionConflictError && cycleId) {
        const conflict: ConflictState = {
          entityType: err.entityType,
          entityId: err.entityId,
          currentRowVersion: err.currentRowVersion,
          messageAr: err.messageAr,
          messageEn: err.messageEn,
          inFlightValues,
        };
        writeConflict(cycleId, conflict);
        setState(conflict);
      }
    },
    [cycleId],
  );

  const handleRefresh = useCallback(() => {
    if (cycleId) clearConflict(cycleId);
    setState(null);
    onRefresh();
  }, [cycleId, onRefresh]);

  const handleDiscard = useCallback(() => {
    if (cycleId) clearConflict(cycleId);
    setState(null);
  }, [cycleId]);

  return {
    dialogProps: {
      open: Boolean(state),
      entityType: state?.entityType,
      messageAr: state?.messageAr,
      inFlightValues: state?.inFlightValues,
      onRefresh: handleRefresh,
      onDiscard: handleDiscard,
    },
    reportConflict,
  };
}
