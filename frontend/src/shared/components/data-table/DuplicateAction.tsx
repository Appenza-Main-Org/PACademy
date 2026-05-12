/**
 * DuplicateAction — single-row action that clones a row and (optionally)
 * navigates to its edit page in "preliminary save" mode (PRODUCT.md §4).
 *
 * The action is intentionally split between a trigger (rendered by the
 * host — typically a `DropdownMenu.Item` or `Button` inside a row's actions
 * cell) and an `AlertDialog` confirm step. The confirm step exists to give
 * the user a single beat to think; it's not a "are you sure?" gate.
 */

import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertDialog, toast } from '@/shared/components';
import { emitAudit } from '@/shared/lib/audit';
import type { AuditModule } from '@/shared/types/domain';
import type { DuplicateConfig } from './list-actions.types';

interface DuplicateActionProps<TRow> {
  row: TRow;
  config: DuplicateConfig<TRow>;
  entityKey: string;
  entityLabelAr: string;
  auditModule: AuditModule;
  /** Render-prop for the row trigger. Receives an `onClick` to open confirm. */
  children: (api: { onClick: () => void; busy: boolean }) => ReactNode;
  /** Refetch hook fired after successful commit. */
  onSuccess?: (newRow: TRow) => void;
}

function isSoftDeleted(row: unknown): boolean {
  if (!row || typeof row !== 'object') return false;
  const r = row as Record<string, unknown>;
  return typeof r.deletedAt === 'string' && r.deletedAt !== '';
}

function pickIdentifier(row: unknown): string | undefined {
  if (!row || typeof row !== 'object') return undefined;
  const r = row as Record<string, unknown>;
  for (const key of ['id', 'key', 'code', 'nationalId']) {
    const v = r[key];
    if (typeof v === 'string' && v !== '') return v;
  }
  return undefined;
}

export function DuplicateAction<TRow>({
  row,
  config,
  entityKey,
  entityLabelAr,
  auditModule,
  children,
  onSuccess,
}: DuplicateActionProps<TRow>): JSX.Element {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const openConfirm = (): void => {
    if (isSoftDeleted(row)) {
      toast('لا يمكن نسخ سجل محذوف.', 'danger');
      return;
    }
    const guardReason = config.guard?.(row) ?? null;
    if (guardReason) {
      toast(guardReason, 'danger');
      return;
    }
    setOpen(true);
  };

  const handleConfirm = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      const draft = config.transform(row);
      const next = await config.onCommit(draft, row);
      const sourceId = pickIdentifier(row) ?? '—';
      const newId = pickIdentifier(next) ?? '—';
      emitAudit({
        action: 'entity_duplicated',
        module: auditModule,
        entityType: entityKey,
        entityLabel: entityLabelAr,
        entityId: newId,
        details: `نسخ ${entityLabelAr}: من ${sourceId} إلى ${newId}.`,
        before: { sourceId },
        after: { newId },
      });
      toast(`تم إنشاء نسخة جديدة من ${entityLabelAr}.`, 'success');
      onSuccess?.(next);
      setOpen(false);
      const redirect = config.redirectTo?.(next);
      if (redirect) navigate(redirect);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذّر تنفيذ النسخ.';
      toast(msg, 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {children({ onClick: openConfirm, busy })}
      <AlertDialog
        open={open}
        onOpenChange={setOpen}
        tone="primary"
        title={`نسخ ${entityLabelAr}`}
        description={`سيتم إنشاء نسخة جديدة من ${entityLabelAr} لتعديلها. لن يتم نسخ السجلات المرتبطة أو القرارات الموقّعة.`}
        actionLabel={busy ? 'جارٍ النسخ…' : 'إنشاء نسخة'}
        cancelLabel="إلغاء"
        onAction={handleConfirm}
        isActionLoading={busy}
        isActionDisabled={busy}
      />
    </>
  );
}
