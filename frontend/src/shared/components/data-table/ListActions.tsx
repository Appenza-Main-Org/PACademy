/**
 * ListActions — the toolbar primitive for the universal list-actions stack.
 *
 * Renders up to three buttons in a logical-start group:
 *   تصدير / استيراد / نسخ
 *
 * The duplicate button is omitted here — duplicate is a per-row action,
 * surfaced inside the row's own DropdownMenu via the `DuplicateAction`
 * primitive. The toolbar carries Export + Import only.
 *
 * Permission gating uses `canPerformListAction` against the current auth
 * user's `permissions`. Buttons disappear (not just disable) when the
 * actor lacks the relevant permission so the affordance reflects role.
 */

import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/shared/components';
import { canPerformListAction } from '@/shared/lib/list-action-permissions';
import { getListActionPermissions } from '@/shared/lib/list-action-actor';
import { ExportMenu } from './ExportMenu';
import { ImportDialog } from './ImportDialog';
import { ACTION_LABELS } from './list-actions.types';
import type { ListActionsConfig, ImportResult } from './list-actions.types';

interface ListActionsProps<TRow> {
  rows: readonly TRow[];
  config: ListActionsConfig<TRow>;
  /** Fires after a successful import so the host page can refetch. */
  onImported?: (result: ImportResult) => void;
}

export function ListActions<TRow>({ rows, config, onImported }: ListActionsProps<TRow>): JSX.Element | null {
  const permissions = getListActionPermissions();
  const [importOpen, setImportOpen] = useState(false);

  const exportConfig = config.export?.enabled ? config.export : undefined;
  const importConfig = config.import?.enabled ? config.import : undefined;

  const canExport = exportConfig
    ? canPerformListAction(permissions, config.entityKey, 'export')
    : false;
  const canImport = importConfig
    ? canPerformListAction(permissions, config.entityKey, 'import')
    : false;

  if (!canExport && !canImport) return null;

  return (
    <div className="flex items-center gap-2">
      {canExport && exportConfig && (
        <ExportMenu
          rows={rows}
          config={exportConfig}
          entityKey={config.entityKey}
          entityLabelAr={config.entityLabelAr}
          auditModule={config.auditModule}
        />
      )}
      {canImport && importConfig && (
        <>
          <Button
            variant="secondary"
            size="md"
            leadingIcon={<Upload size={16} strokeWidth={1.75} />}
            onClick={() => setImportOpen(true)}
          >
            {ACTION_LABELS.import}
          </Button>
          <ImportDialog
            open={importOpen}
            onClose={() => setImportOpen(false)}
            config={importConfig}
            entityKey={config.entityKey}
            entityLabelAr={config.entityLabelAr}
            auditModule={config.auditModule}
            onSuccess={onImported}
          />
        </>
      )}
    </div>
  );
}
