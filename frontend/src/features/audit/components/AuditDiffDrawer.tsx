/**
 * AuditDiffDrawer — Gap E (admin-gaps).
 *
 * Side-by-side before/after viewer for an audit entry. Reads the diff via
 * the audit query layer (which prefers inline `before`/`after` and falls
 * back to MOCK.auditDiffs for legacy seeded rows). Field keys are surfaced
 * with Arabic labels via the field-label dictionary.
 */

import { Drawer } from '@/shared/components';
import { date as fmtDate } from '@/shared/lib/format';
import type { AuditEntry } from '@/shared/types/domain';
import { useAuditDiff } from '../api/audit.queries';
import { fieldLabel } from './fieldLabels';

export interface AuditDiffDrawerProps {
  entry: AuditEntry | null;
  onClose: () => void;
}

export function AuditDiffDrawer({ entry, onClose }: AuditDiffDrawerProps): JSX.Element {
  const { data, isLoading } = useAuditDiff(entry?.id ?? null);
  return (
    <Drawer
      open={Boolean(entry)}
      onClose={onClose}
      title={entry ? `تفاصيل · ${entry.actionLabel}` : 'تفاصيل'}
      subtitle={entry ? `بواسطة ${entry.userName} · ${fmtDate(entry.timestamp)}` : undefined}
      size="md"
    >
      <Drawer.Body>
        {entry && (
          <dl className="mb-4 grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
            <Field label="الكيان">{entry.entity}</Field>
            <Field label="معرّف السجل" mono>
              {entry.entityId}
            </Field>
            {entry.module && <Field label="الوحدة">{entry.module}</Field>}
            {entry.role && <Field label="الدور">{entry.role}</Field>}
            <Field label="عنوان IP" mono>
              {entry.ip}
            </Field>
            {entry.deviceMeta && <Field label="الجهاز">{entry.deviceMeta}</Field>}
          </dl>
        )}
        <h3 className="mb-2 text-sm font-medium text-ink-900">قبل / بعد</h3>
        {isLoading ? (
          <p className="text-sm text-ink-500">جارٍ التحميل…</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <DiffPanel title="قبل" value={(data?.before ?? null) as Record<string, unknown> | null} tone="danger" />
            <DiffPanel title="بعد" value={(data?.after ?? null) as Record<string, unknown> | null} tone="success" />
          </div>
        )}
      </Drawer.Body>
    </Drawer>
  );
}

function Field({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}): JSX.Element {
  return (
    <div className="rounded-md border border-border-subtle bg-ink-50 px-3 py-2">
      <dt className="text-2xs uppercase tracking-wide text-ink-500">{label}</dt>
      <dd
        className={'mt-0.5 text-sm text-ink-900 ' + (mono ? 'font-mono' : '')}
        {...(mono ? { dir: 'ltr' } : {})}
      >
        {children}
      </dd>
    </div>
  );
}

function DiffPanel({
  title,
  value,
  tone,
}: {
  title: string;
  value: Record<string, unknown> | null;
  tone: 'danger' | 'success';
}): JSX.Element {
  const borderClass = tone === 'danger' ? 'border-terra-300 bg-terra-50' : 'border-success bg-success-bg';
  return (
    <div className={'rounded-md border p-3 ' + borderClass}>
      <p className="mb-2 text-xs font-medium text-ink-700">{title}</p>
      {value ? (
        <FieldList value={value} />
      ) : (
        <p className="text-2xs text-ink-500">— غير موجود —</p>
      )}
    </div>
  );
}

function FieldList({ value }: { value: Record<string, unknown> }): JSX.Element {
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return <p className="text-2xs text-ink-500">— لا توجد حقول —</p>;
  }
  return (
    <dl className="space-y-1.5">
      {entries.map(([key, v]) => (
        <div key={key} className="flex flex-col gap-0.5 rounded-sm bg-surface-card px-2 py-1.5">
          <dt className="text-2xs text-ink-500">{fieldLabel(key)}</dt>
          <dd className="text-2xs text-ink-900" dir="auto">
            {renderValue(v)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function renderValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v, null, 2);
}
