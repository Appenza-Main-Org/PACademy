/**
 * ExportMenu — Radix DropdownMenu that opens the export tray for the
 * universal list-actions stack. Renders one item per allowed format plus
 * a "filtered vs. all" toggle and a >10k-row warning.
 *
 * The button itself is disabled when the row list is empty. Tooltip
 * explains so the affordance feels intentional and not broken.
 */

import { useEffect, useId, useState } from 'react';
import { ChevronDown, Download, FileDown, FileSpreadsheet, Loader2, Table2 } from 'lucide-react';
import { Button, DropdownMenu, toast } from '@/shared/components';
import type { AuditModule } from '@/shared/types/domain';
import type { ExportConfig, ExportFormat } from './list-actions.types';
import { ACTION_LABELS } from './list-actions.types';
import { runExport } from './export-runner';

interface ExportMenuProps<TRow> {
  rows: readonly TRow[];
  config: ExportConfig<TRow>;
  entityKey: string;
  entityLabelAr: string;
  auditModule: AuditModule;
}

export function ExportMenu<TRow>({
  rows,
  config,
  entityKey,
  entityLabelAr,
  auditModule,
}: ExportMenuProps<TRow>): JSX.Element {
  const [scope, setScope] = useState<'filtered' | 'all'>(config.defaultScope ?? 'filtered');
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [progress, setProgress] = useState<{ count: number; total: number } | null>(null);
  const id = useId();
  const disabled = rows.length === 0;

  /* Reset progress when the menu re-opens. */
  useEffect(() => {
    if (busy === null) setProgress(null);
  }, [busy]);

  const handleExport = async (format: ExportFormat): Promise<void> => {
    if (disabled || busy) return;
    setBusy(format);
    try {
      let source: readonly TRow[] = rows;
      if (scope === 'all' && config.allSupplier) {
        const supplied = await config.allSupplier();
        source = supplied;
      }
      if (scope === 'all' && source.length > 10_000) {
        toast(`تنبيه: تصدير ${source.length.toLocaleString('en-US')} سجلاً قد يستغرق وقتاً.`, 'warning');
      }
      await runExport({
        rows: source,
        config,
        format,
        entityKey,
        entityLabelAr,
        auditModule,
        scope,
        onProgress: (count, total) => setProgress({ count, total }),
      });
      toast(`تم تصدير ${source.length} سجل بصيغة ${format.toUpperCase()}.`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذّر تصدير البيانات.';
      toast(msg, 'danger');
    } finally {
      setBusy(null);
    }
  };

  const trigger = (
    <Button
      variant="secondary"
      size="md"
      disabled={disabled || busy !== null}
      title={disabled ? 'لا توجد بيانات للتصدير' : 'تصدير الجدول'}
      leadingIcon={
        busy ? (
          <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
        ) : (
          <Download size={16} strokeWidth={1.75} />
        )
      }
      trailingIcon={<ChevronDown size={14} strokeWidth={1.75} className="opacity-60" />}
    >
      {ACTION_LABELS.export}
    </Button>
  );

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" className="min-w-[260px]">
        <DropdownMenu.Label>صيغة التصدير</DropdownMenu.Label>
        {config.formats.includes('csv') && (
          <DropdownMenu.Item
            onSelect={(e) => {
              e.preventDefault();
              handleExport('csv');
            }}
            disabled={busy !== null}
            leadingIcon={<FileDown size={14} strokeWidth={1.75} />}
          >
            تصدير CSV
          </DropdownMenu.Item>
        )}
        {config.formats.includes('xlsx') && (
          <DropdownMenu.Item
            onSelect={(e) => {
              e.preventDefault();
              handleExport('xlsx');
            }}
            disabled={busy !== null}
            leadingIcon={<FileSpreadsheet size={14} strokeWidth={1.75} />}
          >
            تصدير XLSX (Excel)
          </DropdownMenu.Item>
        )}
        <DropdownMenu.Separator />
        <div className="px-3 py-2">
          <fieldset>
            <legend className="text-2xs font-medium text-ink-500">نطاق التصدير</legend>
            <label className="mt-2 flex items-center gap-2 text-sm text-ink-700">
              <input
                type="radio"
                name={`scope-${id}`}
                value="filtered"
                checked={scope === 'filtered'}
                onChange={() => setScope('filtered')}
                className="accent-teal-500"
              />
              <Table2 size={14} strokeWidth={1.75} className="text-ink-500" />
              <span>النتائج المُصفّاة فقط</span>
            </label>
            <label className="mt-1 flex items-center gap-2 text-sm text-ink-700">
              <input
                type="radio"
                name={`scope-${id}`}
                value="all"
                checked={scope === 'all'}
                onChange={() => setScope('all')}
                disabled={!config.allSupplier}
                className="accent-teal-500"
              />
              <span>كل البيانات</span>
            </label>
            {!config.allSupplier && (
              <p className="mt-1 ps-5 text-2xs text-ink-400">
                هذه القائمة لا تدعم تصدير كل السجلات.
              </p>
            )}
          </fieldset>
        </div>
        {progress && progress.total > 500 && (
          <>
            <DropdownMenu.Separator />
            <div className="px-3 py-2">
              <p className="text-2xs text-ink-500">
                تجهيز السجلات:{' '}
                <span className="font-numeric tnum" dir="ltr">
                  {progress.count} / {progress.total}
                </span>
              </p>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-ink-100">
                <div
                  className="h-full rounded-full transition-all duration-base ease-standard"
                  style={{
                    width: `${(progress.count / progress.total) * 100}%`,
                    background: 'var(--accent-500)',
                  }}
                />
              </div>
            </div>
          </>
        )}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
