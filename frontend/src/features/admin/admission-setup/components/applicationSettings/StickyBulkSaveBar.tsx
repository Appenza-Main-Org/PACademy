/**
 * StickyBulkSaveBar — bottom-sticky surface shown when the draft store
 * has any unsaved row across any specialization slice.
 *
 * Renders: total pending count + "إلغاء التغييرات" + "حفظ التغييرات".
 *
 * Save flattens every slice into a single `BulkYearChange[]` payload
 * and fires `useBulkSave`. The server validates atomically; on success
 * the draft store is reset and TanStack Query refetches.
 *
 * Cancel resets the draft store to its server snapshots without
 * touching anything else.
 */

import { Save, Undo2 } from 'lucide-react';
import { Button, toast } from '@/shared/components';
import { useBulkSave } from '../../api/applicationSettings.queries';
import type { BulkYearChange } from '../../api/applicationSettings.service';
import { validateYearRow } from '../../lib/appSettingsValidation';
import { useAdmissionSetupIsReadOnly } from '../AdmissionSetupShell';
import {
  useAppSettingsDraftStore,
  useDraftSummary,
  useHasAnyMismatch,
} from '../../store/appSettingsDraft';

export function StickyBulkSaveBar(): JSX.Element | null {
  const summary = useDraftSummary();
  const byCs = useAppSettingsDraftStore((s) => s.byCs);
  const resetAll = useAppSettingsDraftStore((s) => s.resetAll);
  const hasMismatch = useHasAnyMismatch();
  const bulkSave = useBulkSave();
  const isReadOnly = useAdmissionSetupIsReadOnly();

  /* View-only cycles cannot commit changes — suppress the bar entirely
   * rather than render it disabled. The wizard banner already tells the
   * admin the mode is read-only; leaving a phantom save bar at the
   * bottom would be confusing. */
  if (isReadOnly) return null;

  if (summary.total === 0 && !hasMismatch) return null;

  const handleSave = (): void => {
    for (const slice of Object.values(byCs)) {
      const live = slice.filter((draft) => draft.kind !== 'deleted').map((draft) => draft.row);
      for (const draft of slice) {
        if (draft.kind === 'deleted') continue;
        const siblings = live.filter((row) => row.id !== draft.id);
        const conflict = validateYearRow(draft.row, siblings, draft.id);
        if (conflict) {
          toast(
            conflict === 'INVALID_DATE_RANGE'
              ? 'يجب أن يكون تاريخ نهاية التقديم بعد تاريخ بداية التقديم.'
              : conflict === 'AGE_REFERENCE_AFTER_START'
                ? 'يجب أن يكون تاريخ احتساب السن بعد تاريخ بداية التقديم.'
              : 'يرجى تصحيح أخطاء شروط التقديم قبل الحفظ.',
            'danger',
          );
          return;
        }
      }
    }

    const payload: BulkYearChange[] = [];
    for (const [csId, slice] of Object.entries(byCs)) {
      for (const draft of slice) {
        if (draft.kind === 'original') continue;
        if (draft.kind === 'new') {
          const { id: _drop, ...rowWithoutId } = draft.row;
          payload.push({
            id: null,
            kind: 'create',
            categorySpecializationId: csId,
            row: rowWithoutId,
          });
        } else if (draft.kind === 'dirty') {
          const { id: _drop, ...rowWithoutId } = draft.row;
          payload.push({
            id: draft.id,
            kind: 'update',
            categorySpecializationId: csId,
            row: rowWithoutId,
          });
        } else if (draft.kind === 'deleted') {
          payload.push({
            id: draft.id,
            kind: 'delete',
            categorySpecializationId: csId,
          });
        }
      }
    }
    bulkSave.mutate(payload, {
      onSuccess: () => resetAll(),
    });
  };

  return (
    <div
      role="status"
      className="sticky bottom-0 z-10 -mx-4 mt-4 border-t border-border-default bg-surface-card/95 px-4 py-3 shadow-md backdrop-blur"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-ar text-sm text-ink-700">
          {summary.total > 0 ? (
            <>
              {summary.total} تعديل غير محفوظ
              {summary.newCount > 0 && (
                <span className="text-2xs text-ink-500"> · إضافة {summary.newCount}</span>
              )}
              {summary.dirtyCount > 0 && (
                <span className="text-2xs text-ink-500"> · تعديل {summary.dirtyCount}</span>
              )}
              {summary.deletedCount > 0 && (
                <span className="text-2xs text-ink-500"> · حذف {summary.deletedCount}</span>
              )}
            </>
          ) : (
            <span className="text-terra-700">تعارض في نمط التقدير — الحفظ معطّل</span>
          )}
          {hasMismatch && summary.total > 0 && (
            <span className="text-2xs text-terra-700"> · تعارض في نمط التقدير</span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => resetAll()}
            leadingIcon={<Undo2 size={14} strokeWidth={1.75} />}
            disabled={bulkSave.isPending}
          >
            إلغاء التغييرات
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            leadingIcon={<Save size={14} strokeWidth={1.75} />}
            isLoading={bulkSave.isPending}
            disabled={hasMismatch || summary.total === 0}
          >
            حفظ التغييرات
          </Button>
        </div>
      </div>
    </div>
  );
}
