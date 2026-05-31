/**
 * Dedicated import-preview surface for the Data-Exchange hub. Purpose-built —
 * NOT the list-actions `ImportPreviewTable`. Renders the 6-class change-detection
 * matrix (New / Changed / Skipped / Outdated / Conflict / Invalid), a class
 * filter, apply controls, a super-admin-gated force-update for Outdated rows,
 * and a validation-errors download.
 */

import { useMemo, useState } from 'react';
import { AlertTriangle, Download } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, DataTable } from '@/shared/components';
import type { BadgeTone } from '@/shared/components/Badge';
import type { DataTableColumn } from '@/shared/components/DataTable';
import {
  type ImportApplyMode,
  type ImportPreview,
  type ImportRowClass,
  type ImportRowOutcome,
  CLASS_LABELS_AR,
  IMPORT_ROW_CLASSES,
} from '../types';
import { buildErrorsBlob, downloadBlob } from '../lib/workbook';

const CLASS_TONE: Record<ImportRowClass, BadgeTone> = {
  new: 'info',
  changed: 'warning',
  skipped: 'neutral',
  outdated: 'warning',
  conflict: 'danger',
  invalid: 'danger',
};

interface DataExchangePreviewProps {
  preview: ImportPreview;
  isSuperAdmin: boolean;
  applying: boolean;
  onApply: (args: { mode: ImportApplyMode; skipConflicts: boolean; forceUpdate: boolean }) => void;
}

export function DataExchangePreview({
  preview,
  isSuperAdmin,
  applying,
  onApply,
}: DataExchangePreviewProps): JSX.Element {
  const [activeClass, setActiveClass] = useState<ImportRowClass | 'all'>('all');
  const [mode, setMode] = useState<ImportApplyMode>('new-and-changed');
  const [skipConflicts, setSkipConflicts] = useState(true);
  const [forceUpdate, setForceUpdate] = useState(false);

  const filteredRows = useMemo(
    () => (activeClass === 'all' ? preview.rows : preview.rows.filter((r) => r.class === activeClass)),
    [preview.rows, activeClass],
  );

  const outdatedCount = preview.counts.outdated ?? 0;
  const hasInvalid = (preview.counts.invalid ?? 0) > 0 || preview.rows.some((r) => r.class === 'invalid');

  const columns: DataTableColumn<ImportRowOutcome>[] = [
    { key: 'sheet', label: 'الورقة', accessor: 'sheetName', width: 160 },
    { key: 'row', label: 'الصف', numeric: true, render: (r) => r.rowIndex + 1, width: 70 },
    { key: 'businessKey', label: 'المفتاح', accessor: 'businessKey' },
    {
      key: 'class',
      label: 'التصنيف',
      width: 120,
      render: (r) => (
        <Badge tone={CLASS_TONE[r.class]}>{CLASS_LABELS_AR[r.class]}</Badge>
      ),
    },
    { key: 'errors', label: 'الملاحظات', render: (r) => (r.errors.length ? r.errors.join('، ') : '—') },
  ];

  async function downloadErrors(): Promise<void> {
    const rows = preview.rows
      .filter((r) => r.class === 'invalid' || r.errors.length > 0)
      .map((r) => ({ sheetName: r.sheetName, rowIndex: r.rowIndex, businessKey: r.businessKey, errors: r.errors }));
    if (rows.length === 0) return;
    const blob = await buildErrorsBlob(rows);
    downloadBlob(blob, `data-exchange-validation-errors-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <Card>
      <CardHeader
        title="معاينة الاستيراد"
        actions={
          hasInvalid ? (
            <Button variant="ghost" size="sm" onClick={() => void downloadErrors()}>
              <Download size={16} className="me-1" />
              تنزيل أخطاء التحقق
            </Button>
          ) : undefined
        }
      />
      <CardBody className="space-y-4">
        {/* Count chips */}
        <div className="flex flex-wrap gap-2">
          <ClassChip
            label="الكل"
            count={preview.rows.length}
            active={activeClass === 'all'}
            tone="neutral"
            onClick={() => setActiveClass('all')}
          />
          {IMPORT_ROW_CLASSES.map((cls) => (
            <ClassChip
              key={cls}
              label={CLASS_LABELS_AR[cls]}
              count={preview.counts[cls] ?? 0}
              active={activeClass === cls}
              tone={CLASS_TONE[cls]}
              onClick={() => setActiveClass(cls)}
            />
          ))}
        </div>

        {preview.sheetIssues.length > 0 && (
          <div className="rounded-md border border-terra-300 bg-terra-50 p-3 text-2xs text-terra-700">
            <p className="mb-1 flex items-center gap-1 font-semibold">
              <AlertTriangle size={14} /> أوراق مرفوضة (أسماء غير معروفة)
            </p>
            <ul className="list-disc space-y-0.5 ps-5">
              {preview.sheetIssues.map((issue) => (
                <li key={issue.sheetName}>{issue.message}</li>
              ))}
            </ul>
          </div>
        )}

        <DataTable<ImportRowOutcome>
          data={filteredRows}
          columns={columns}
          rowKey={(r) => `${r.sheetName}-${r.rowIndex}`}
          density="compact"
          stickyHeader
        />

        {/* Apply controls */}
        <div className="space-y-3 rounded-md border border-ink-200 bg-ink-50 p-4">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-2xs font-semibold text-ink-700">وضع التطبيق:</span>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="radio" name="dx-mode" checked={mode === 'new-only'} onChange={() => setMode('new-only')} />
              الجديد فقط
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="dx-mode"
                checked={mode === 'new-and-changed'}
                onChange={() => setMode('new-and-changed')}
              />
              الجديد والمُعدَّل
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={skipConflicts} onChange={(e) => setSkipConflicts(e.target.checked)} />
              تخطّي التعارضات
            </label>
            <label
              className="flex items-center gap-1.5 text-sm"
              title={isSuperAdmin ? '' : 'متاح لمدير النظام الرئيسي فقط'}
            >
              <input
                type="checkbox"
                checked={forceUpdate}
                disabled={!isSuperAdmin || outdatedCount === 0}
                onChange={(e) => setForceUpdate(e.target.checked)}
              />
              فرض تحديث الصفوف القديمة ({outdatedCount})
            </label>
          </div>
          <Button
            variant="primary"
            isLoading={applying}
            disabled={preview.rows.length === 0}
            onClick={() => onApply({ mode, skipConflicts, forceUpdate })}
          >
            تطبيق الاستيراد
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function ClassChip({
  label,
  count,
  active,
  tone,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  tone: BadgeTone;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex items-center gap-1.5 rounded-full border px-3 py-1 text-2xs transition-colors',
        active ? 'border-[var(--accent-500)] bg-[var(--accent-50)]' : 'border-ink-200 bg-white hover:bg-ink-50',
      ].join(' ')}
    >
      <Badge tone={tone}>{count}</Badge>
      <span className="text-ink-700">{label}</span>
    </button>
  );
}
