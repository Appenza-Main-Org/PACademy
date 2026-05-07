/**
 * AuditPage — sortable, filterable audit log with diff drawer + CSV export.
 * Source: Tasks/KARASA_GAPS.md §1.2.G.
 */

import { useState } from 'react';
import { Download, Eye } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  DataTable,
  DateRangePicker,
  Drawer,
  EmptyState,
  Input,
  PageHeader,
  Select,
  toast,
} from '@/shared/components';
import type { DataTableColumn, DateRange } from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { date as fmtDate, shortName } from '@/shared/lib/format';
import { downloadBlob } from '@/shared/lib/download';
import { auditService } from '@/features/audit/api/audit.service';
import {
  useAuditDiff,
  useAuditEntityTypes,
  useAuditLog,
  useAuditUsers,
} from '@/features/audit/api/audit.queries';
import { AUDIT_ACTIONS } from '@/shared/mock-data/dictionaries';
import type { AuditAction, AuditEntry } from '@/shared/types/domain';

export function AuditPage(): JSX.Element {
  const [action, setAction] = useState<AuditAction | 'all'>('all');
  const [userId, setUserId] = useState<string>('all');
  const [entity, setEntity] = useState<string>('all');
  const [range, setRange] = useState<DateRange>({ start: null, end: null });
  const [search, setSearch] = useState('');

  const filters = {
    action,
    userId,
    entity,
    since: range.start?.getTime() ?? null,
    until: range.end?.getTime() ?? null,
  };

  const { data, isLoading } = useAuditLog(filters);
  const { data: entityTypes } = useAuditEntityTypes();
  const { data: users } = useAuditUsers();
  const [openEntry, setOpenEntry] = useState<AuditEntry | null>(null);

  const visible = (data ?? []).filter((e) =>
    !search ? true : e.details.includes(search) || e.userName.includes(search) || e.entityId.includes(search),
  );

  const columns: DataTableColumn<AuditEntry>[] = [
    {
      key: 'user',
      label: 'المستخدم',
      render: (e) => <span className="text-sm font-medium text-ink-900">{shortName(e.userName, 3)}</span>,
    },
    {
      key: 'action',
      label: 'الإجراء',
      render: (e) => <Badge tone={e.actionColor}>{e.actionLabel}</Badge>,
    },
    { key: 'entity', label: 'الكيان', render: (e) => e.entity, hideOn: 'sm' },
    {
      key: 'details',
      label: 'التفاصيل',
      render: (e) => <span className="text-sm text-ink-700">{e.details}</span>,
      hideOn: 'sm',
    },
    {
      key: 'ip',
      label: 'IP',
      hideOn: 'md',
      render: (e) => (
        <span className="text-2xs text-ink-500 font-mono" dir="ltr">
          {e.ip}
        </span>
      ),
    },
    {
      key: 'timestamp',
      label: 'الوقت',
      render: (e) => <span className="text-2xs text-ink-500">{fmtDate(e.timestamp, 'rel')}</span>,
    },
    {
      key: '_actions',
      label: <span className="sr-only">عرض</span>,
      align: 'end',
      render: (e) => (
        <Button
          variant="ghost"
          size="icon"
          aria-label="عرض الفروقات"
          onClick={(ev) => {
            ev.stopPropagation();
            setOpenEntry(e);
          }}
        >
          <Eye size={14} strokeWidth={1.75} />
        </Button>
      ),
    },
  ];

  return (
    <CenteredShell>
      <PageHeader
        title="سجل النشاط"
        subtitle="كل العمليات الإدارية مسجّلة مع before/after لكل تعديل"
        actions={
          <Button
            variant="secondary"
            leadingIcon={<Download size={14} strokeWidth={1.75} />}
            onClick={async () => {
              const blob = await auditService.exportCsv(filters);
              downloadBlob(blob, `audit-${new Date().toISOString().slice(0, 10)}.csv`);
              toast('تم تصدير ملف CSV', 'success');
            }}
          >
            تصدير CSV
          </Button>
        }
      />

      <Card>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <Input
            label="بحث"
            placeholder="بحث في التفاصيل…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            label="نوع الإجراء"
            value={action}
            onChange={(e) => setAction(e.target.value as AuditAction | 'all')}
            options={[
              { value: 'all', label: 'كل الإجراءات' },
              ...AUDIT_ACTIONS.map((a) => ({ value: a.action, label: a.label })),
            ]}
          />
          <Select
            label="نوع الكيان"
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            options={[
              { value: 'all', label: 'الكل' },
              ...((entityTypes ?? []).map((e) => ({ value: e, label: e }))),
            ]}
          />
          <Select
            label="المستخدم"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            options={[
              { value: 'all', label: 'كل المستخدمين' },
              ...((users ?? []).map((u) => ({ value: u.id, label: shortName(u.name, 3) }))),
            ]}
          />
          <DateRangePicker label="الفترة" value={range} onChange={setRange} />
        </div>

        <div className="mt-5">
          <DataTable
            data={visible}
            columns={columns}
            rowKey={(e) => e.id}
            loading={isLoading}
            empty={<EmptyState variant="no-results-search" />}
            zebraStripes
            stickyHeader
            density="compact"
          />
        </div>
      </Card>

      <AuditDiffDrawer entry={openEntry} onClose={() => setOpenEntry(null)} />
    </CenteredShell>
  );
}

function AuditDiffDrawer({
  entry,
  onClose,
}: {
  entry: AuditEntry | null;
  onClose: () => void;
}): JSX.Element {
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
          <dl className="mb-4 grid grid-cols-3 gap-2 text-sm">
            <Field label="الكيان">{entry.entity}</Field>
            <Field label="معرّف السجل" mono>
              {entry.entityId}
            </Field>
            <Field label="عنوان IP" mono>
              {entry.ip}
            </Field>
          </dl>
        )}
        <h3 className="mb-2 text-sm font-medium text-ink-900">قبل / بعد</h3>
        {isLoading ? (
          <p className="text-sm text-ink-500">جارٍ التحميل…</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <DiffPanel title="قبل" value={data?.before ?? null} tone="danger" />
            <DiffPanel title="بعد" value={data?.after ?? null} tone="success" />
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
      <p className="mb-1 text-xs font-medium text-ink-700">{title}</p>
      <pre className="overflow-auto rounded-sm bg-surface-card p-2 text-2xs leading-normal text-ink-900" dir="ltr">
        {value ? JSON.stringify(value, null, 2) : '— غير موجود —'}
      </pre>
    </div>
  );
}
