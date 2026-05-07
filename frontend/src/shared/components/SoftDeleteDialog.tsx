/**
 * SoftDeleteDialog — Gap D (admin-gaps).
 *
 * Confirmation dialog for soft-delete actions. Shows the entity label,
 * an optional dependency warning slot, and a free-text reason input. The
 * Confirm button is disabled while dependencies block the action.
 *
 * Pages call it like:
 *   <SoftDeleteDialog
 *     open={open}
 *     entityNoun="هذه الفئة"
 *     entityLabel={category.labelAr}
 *     dependencies={dep}
 *     dependencyLabels={CATEGORY_DEP_LABELS}
 *     onClose={() => setOpen(false)}
 *     onConfirm={(reason) => softDelete(category.key, reason)}
 *   />
 */

import { useEffect, useState } from 'react';
import { Button, Modal, Textarea } from '@/shared/components';
import { DependencyWarning } from './DependencyWarning';
import type { DependencyResult } from '@/shared/lib/soft-delete';

export interface SoftDeleteDialogProps {
  open: boolean;
  /** "هذه الدورة" / "هذه الفئة" — surfaced inside the title and warning. */
  entityNoun: string;
  /** Display name of the row being deleted ("دورة 2026 ذكور"). */
  entityLabel: string;
  /** Optional dependency counts; blocking=true disables Confirm. */
  dependencies?: DependencyResult | null;
  /** Map relation keys to Arabic labels for the warning panel. */
  dependencyLabels?: Record<string, string>;
  /** Optional override of the destructive button copy. */
  confirmLabel?: string;
  /** Reason is required by default; pass `false` to make it optional. */
  reasonRequired?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
}

export function SoftDeleteDialog({
  open,
  entityNoun,
  entityLabel,
  dependencies,
  dependencyLabels = {},
  confirmLabel = 'حذف',
  reasonRequired = true,
  onClose,
  onConfirm,
}: SoftDeleteDialogProps): JSX.Element {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  /* Reset reason on open so reuse of the dialog stays clean. */
  useEffect(() => {
    if (open) {
      setReason('');
      setBusy(false);
    }
  }, [open]);

  const blocked = Boolean(dependencies?.blocking);
  const reasonInvalid = reasonRequired && reason.trim().length === 0;
  const disabled = busy || blocked || reasonInvalid;

  return (
    <Modal open={open} onClose={onClose} title={`تأكيد حذف ${entityNoun}`} subtitle={entityLabel} size="sm">
      <Modal.Body className="space-y-3">
        {dependencies && (
          <DependencyWarning parentNoun={entityNoun} result={dependencies} labels={dependencyLabels} />
        )}
        {!blocked && (
          <Textarea
            label={`سبب الحذف${reasonRequired ? ' *' : ''}`}
            placeholder="اكتب سبب الحذف للسجل…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required={reasonRequired}
          />
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          إلغاء
        </Button>
        <Button
          variant="danger"
          onClick={async () => {
            if (disabled) return;
            setBusy(true);
            try {
              await onConfirm(reason.trim());
              onClose();
            } finally {
              setBusy(false);
            }
          }}
          disabled={disabled}
          isLoading={busy}
        >
          {confirmLabel}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
