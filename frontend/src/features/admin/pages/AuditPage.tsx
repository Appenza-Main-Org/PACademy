/**
 * AuditPage — sortable, filterable audit log with diff drawer + CSV export.
 * Source: Tasks/KARASA_GAPS.md §1.2.G.
 */

import { useMemo, useState } from 'react';
import { Download, Eye } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  DataTable,
  DateRangePicker,
  EmptyState,
  Input,
  PageHeader,
  Select,
  toast,
} from '@/shared/components';
import type { DataTableColumn, DateRange, ListActionsConfig } from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { date as fmtDate, shortName } from '@/shared/lib/format';
import { downloadBlob } from '@/shared/lib/download';
import {
  AuditDiffDrawer,
  auditService,
  useAuditEntityTypes,
  useAuditLog,
  useAuditModules,
  useAuditRoles,
  useAuditUsers,
} from '@/features/audit';
import { AUDIT_ACTIONS } from '@/shared/mock-data/dictionaries';
import type { AuditAction, AuditEntry, AuditModule } from '@/shared/types/domain';

export function AuditPage(): JSX.Element {
  const [action, setAction] = useState<AuditAction | 'all'>('all');
  const [userId, setUserId] = useState<string>('all');
  const [entity, setEntity] = useState<string>('all');
  const [moduleFilter, setModuleFilter] = useState<AuditModule | 'all'>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [range, setRange] = useState<DateRange>({ start: null, end: null });
  const [search, setSearch] = useState('');

  const filters = {
    action,
    userId,
    entity,
    module: moduleFilter,
    role: roleFilter,
    since: range.start?.getTime() ?? null,
    until: range.end?.getTime() ?? null,
  };

  const { data, isLoading } = useAuditLog(filters);
  const { data: entityTypes } = useAuditEntityTypes();
  const { data: modules } = useAuditModules();
  const { data: roles } = useAuditRoles();
  const { data: users } = useAuditUsers();
  const [openEntry, setOpenEntry] = useState<AuditEntry | null>(null);

  const visible = (data ?? []).filter((e) =>
    !search ? true : e.details.includes(search) || e.userName.includes(search) || e.entityId.includes(search),
  );

  const listActions: ListActionsConfig<AuditEntry> = useMemo(
    () => ({
      entityKey: 'admin.audit',
      entityLabelAr: 'سجل النشاط',
      auditModule: 'admin',
      export: {
        enabled: true,
        formats: ['csv', 'xlsx'],
        filenamePrefix: 'سجل-النشاط-',
        columns: [
          { key: 'id', labelAr: 'المعرف' },
          {
            key: 'timestamp',
            labelAr: 'الوقت',
            format: (v) => fmtDate(Number(v) || 0, 'full'),
          },
          { key: 'userName', labelAr: 'المستخدم' },
          { key: 'role', labelAr: 'الدور' },
          { key: 'actionLabel', labelAr: 'الإجراء' },
          { key: 'module', labelAr: 'الوحدة' },
          { key: 'entity', labelAr: 'الكيان' },
          { key: 'entityId', labelAr: 'كود الكيان' },
          { key: 'details', labelAr: 'التفاصيل' },
          { key: 'ip', labelAr: 'IP' },
        ],
      },
    }),
    [],
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
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
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
            label="الوحدة"
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value as AuditModule | 'all')}
            options={[
              { value: 'all', label: 'كل الوحدات' },
              ...((modules ?? []).map((m) => ({ value: m, label: m }))),
            ]}
          />
          <Select
            label="الدور"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            options={[
              { value: 'all', label: 'كل الأدوار' },
              ...((roles ?? []).map((r) => ({ value: r, label: r }))),
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
            listActions={listActions}
          />
        </div>
      </Card>

      <AuditDiffDrawer entry={openEntry} onClose={() => setOpenEntry(null)} />
    </CenteredShell>
  );
}
