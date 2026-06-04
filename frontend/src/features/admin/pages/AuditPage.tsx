/**
 * AuditPage — sortable, filterable audit log with diff drawer + CSV export.
 * Source: Tasks/KARASA_GAPS.md §1.2.G.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Eye } from 'lucide-react';
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
} from '@/shared/components';
import type { DataTableColumn, DateRange, ListActionsConfig } from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ROUTES } from '@/config/routes';
import { date as fmtDate, shortName } from '@/shared/lib/format';
import {
  AuditDiffDrawer,
  auditEntityLabel,
  auditModuleLabel,
  useAuditActions,
  useAuditEntityTypes,
  useAuditLog,
  useAuditModules,
  useAuditRoles,
  useAuditUsers,
} from '@/features/audit';
import { useUsers } from '@/features/admin/api/users.queries';
import type { ApplicantStatus, AuditAction, AuditEntry, AuditModule, SystemUser } from '@/shared/types/domain';

const STATUS_LABEL: Record<ApplicantStatus, string> = {
  pending: 'في الانتظار',
  'under-review': 'قيد المراجعة',
  approved: 'مقبول',
  rejected: 'مرفوض',
  'on-hold': 'موقوف',
  'documents-required': 'مستندات ناقصة',
  under_medical_review: 'قيد الكشف الطبي',
  passed_physical: 'اجتاز اللياقة',
  failed_interview: 'لم يجتز المقابلة',
  awaiting_board_decision: 'بانتظار قرار الهيئة',
  draft: 'مسودة',
  personal_data_completed: 'استكمال البيانات الشخصية',
  awaiting_payment: 'في انتظار السداد',
  fees_paid: 'تم سداد الرسوم',
  family_data_in_progress: 'بيانات العائلة قيد الإدخال',
  family_data_approved: 'اعتماد بيانات العائلة',
  awaiting_exam_booking: 'في انتظار حجز موعد الاختبار',
  exam_scheduled: 'تم حجز موعد الاختبار',
  attendance_card_available: 'بطاقة التردد متاحة',
  awaiting_exam_result: 'في انتظار نتيجة الاختبار',
  suspended: 'موقوف',
  acquaintance_doc_opened: 'وثيقة التعارف',
};

const FIELD_LABEL_AR: Record<string, string> = {
  'contact.email': 'البريد الإلكتروني',
  'contact.mobilePhone': 'رقم الهاتف',
  'contact.phone': 'الهاتف الأرضي',
  'currentAddress.detail': 'تفاصيل العنوان',
  'currentAddress.city': 'المدينة',
  'currentAddress.governorate': 'المحافظة',
  'education.certYear': 'سنة الشهادة',
  'education.certPercent': 'النسبة',
  maritalStatus: 'الحالة الاجتماعية',
  religion: 'الديانة',
  'family.fatherName': 'اسم الأب',
  'family.fatherJob': 'مهنة الأب',
};

/* Bullet/dot separator used by mock generators between status pair and reason. */
const REASON_SEPARATOR = /\s*[·•]\s*/;
const FIELDS_PREFIX_RE = /^\s*(تعديل\s+الحقول|الحقول\s+المعدّلة|الحقول)\s*[:：]\s*/;
const TRANSITION_PREFIX_RE = /^[\s\S]*?(?=[A-Za-z_][\w-]*\s*→\s*[A-Za-z_][\w-]*)/;

function parseTransition(details: string): { from: string; to: string; reason: string } | null {
  const stripped = details.replace(TRANSITION_PREFIX_RE, '');
  const arrowIdx = stripped.indexOf('→');
  if (arrowIdx === -1) return null;
  const fromRaw = stripped.slice(0, arrowIdx).trim();
  const tail = stripped.slice(arrowIdx + 1).trim();
  const sepMatch = tail.match(REASON_SEPARATOR);
  const to = sepMatch ? tail.slice(0, sepMatch.index).trim() : tail.trim();
  const reason = sepMatch ? tail.slice((sepMatch.index ?? 0) + sepMatch[0].length).trim() : '';
  /* Reason may itself end with another separator + section tag — keep the first segment only. */
  const cleanReason = reason.split(REASON_SEPARATOR)[0]?.trim() ?? '';
  return { from: fromRaw, to, reason: cleanReason };
}

function parseFieldList(details: string): string[] | null {
  const m = details.match(FIELDS_PREFIX_RE);
  if (!m) return null;
  const tail = details.slice(m[0].length).split(REASON_SEPARATOR)[0] ?? '';
  return tail
    .split(/[,،]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function StatusPill({ code }: { code: string }): JSX.Element {
  const label = STATUS_LABEL[code as ApplicantStatus];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border-subtle bg-surface-card px-2 py-0.5 text-xs text-ink-800">
      <span className="text-sm">{label ?? code}</span>
      {label && (
        <span className="font-mono text-[10px] text-ink-400" dir="ltr">
          {code}
        </span>
      )}
    </span>
  );
}

function FieldChip({ path }: { path: string }): JSX.Element {
  const label = FIELD_LABEL_AR[path];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-ink-50 px-1.5 py-0.5 text-xs text-ink-800"
      title={path}
    >
      {label && <span>{label}</span>}
      <span className="font-mono text-[10px] text-ink-500" dir="ltr">
        {path}
      </span>
    </span>
  );
}

/**
 * For `users` audit entries the backend stores the affected actor as a
 * tail segment after `·` (e.g. "تحديث مستخدم · هشام البري"). We split
 * on the first bullet so we can re-render the tail as a link to the
 * user-detail page and pull the *current* fullArabicName from the
 * users cache when available.
 */
function splitUserDetails(details: string): { prefix: string; tail: string } {
  const idx = details.indexOf('·');
  if (idx === -1) return { prefix: '', tail: details };
  return {
    prefix: details.slice(0, idx).trim(),
    tail: details.slice(idx + 1).trim(),
  };
}

function DetailsCell({
  entry,
  usersById,
}: {
  entry: AuditEntry;
  usersById: Map<string, SystemUser>;
}): JSX.Element {
  const transition = parseTransition(entry.details);
  if (transition) {
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-700">
        <StatusPill code={transition.from} />
        <ArrowRight size={12} strokeWidth={2} aria-hidden className="text-ink-400 rtl:rotate-180" />
        <StatusPill code={transition.to} />
        {transition.reason && (
          <span className="text-xs text-ink-600" dir="auto">
            · {transition.reason}
          </span>
        )}
      </div>
    );
  }

  const fields = parseFieldList(entry.details);
  if (fields && fields.length > 0) {
    return (
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {fields.map((path) => (
          <FieldChip key={path} path={path} />
        ))}
      </div>
    );
  }

  if ((entry.entity === 'users' || entry.entity === 'مستخدمو المنظومة' || entry.entityType === 'users' || entry.entityType === 'مستخدمو المنظومة') && entry.entityId) {
    const { prefix, tail } = splitUserDetails(entry.details);
    const freshName = usersById.get(entry.entityId)?.fullArabicName;
    const linkText = freshName ?? tail;
    return (
      <span className="block whitespace-normal text-sm leading-relaxed text-ink-700" dir="auto">
        {prefix && (
          <>
            <span className="text-ink-600">{prefix}</span>
            <span className="mx-1 text-ink-400">·</span>
          </>
        )}
        <Link
          to={ROUTES.admin.userDetail(entry.entityId)}
          onClick={(e) => e.stopPropagation()}
          className="font-medium text-teal-700 underline decoration-teal-200 decoration-1 underline-offset-2 transition-colors duration-fast ease-standard hover:text-teal-800 hover:decoration-teal-500 focus-visible:shadow-focus-teal focus-visible:outline-none"
        >
          {linkText}
        </Link>
      </span>
    );
  }

  return (
    <span className="block whitespace-normal text-sm leading-relaxed text-ink-700" dir="auto">
      {entry.details}
    </span>
  );
}

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
  const actionsQuery = useAuditActions();
  const { data: entityTypes } = useAuditEntityTypes();
  const { data: modules } = useAuditModules();
  const { data: roles } = useAuditRoles();
  const { data: users } = useAuditUsers();
  /* Cross-reference the full SystemUser list so audit rows that affect a
   * user can render the current `fullArabicName` (the audit `details`
   * string is a snapshot — it can go stale after a rename). */
  const { data: systemUsers } = useUsers();
  const usersById = useMemo(
    () => new Map<string, SystemUser>((systemUsers ?? []).map((u) => [u.id, u])),
    [systemUsers],
  );
  const [openEntry, setOpenEntry] = useState<AuditEntry | null>(null);
  const auditActionOptions = useMemo(
    () => (actionsQuery.data ?? []).map((a) => ({ value: a.action, label: a.label })),
    [actionsQuery.data],
  );

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
      sortable: true,
      getSortValue: (e) => e.userName,
      filter: { kind: 'text', getValue: (e) => e.userName },
      render: (e) => <span className="text-sm font-medium text-ink-900">{shortName(e.userName, 3)}</span>,
    },
    {
      key: 'action',
      label: 'الإجراء',
      sortable: true,
      getSortValue: (e) => e.actionLabel,
      filter: {
        kind: 'enum',
        getValue: (e) => e.action,
        options: auditActionOptions,
      },
      render: (e) => <Badge tone={e.actionColor}>{e.actionLabel}</Badge>,
    },
    {
      key: 'entity',
      label: 'الكيان',
      hideOn: 'sm',
      sortable: true,
      getSortValue: (e) => e.entity,
      filter: {
        kind: 'enum',
        getValue: (e) => e.entity,
        options: (entityTypes ?? []).map((t) => ({ value: auditEntityLabel(t), label: auditEntityLabel(t) })),
      },
      render: (e) => e.entity,
    },
    {
      key: 'details',
      label: 'التفاصيل',
      hideOn: 'sm',
      sortable: true,
      getSortValue: (e) => e.details,
      filter: { kind: 'text', getValue: (e) => e.details },
      render: (e) => <DetailsCell entry={e} usersById={usersById} />,
    },
    {
      key: 'ip',
      label: 'IP',
      hideOn: 'md',
      sortable: true,
      getSortValue: (e) => e.ip,
      filter: { kind: 'text', getValue: (e) => e.ip },
      render: (e) => (
        <span className="text-2xs text-ink-500 font-mono" dir="ltr">
          {e.ip}
        </span>
      ),
    },
    {
      key: 'timestamp',
      label: 'الوقت',
      sortable: true,
      getSortValue: (e) => e.timestamp,
      filter: { kind: 'date', getValue: (e) => e.timestamp },
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
            disabled={actionsQuery.isLoading}
            helper={actionsQuery.isError ? 'تعذر تحميل قائمة الإجراءات من الخادم' : undefined}
            options={[
              { value: 'all', label: 'كل الإجراءات' },
              ...auditActionOptions,
            ]}
          />
          <Select
            label="نوع الكيان"
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            options={[
              { value: 'all', label: 'الكل' },
              ...((entityTypes ?? []).map((e) => ({ value: e, label: auditEntityLabel(e) }))),
            ]}
          />
          <Select
            label="الوحدة"
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value as AuditModule | 'all')}
            options={[
              { value: 'all', label: 'كل الوحدات' },
              ...((modules ?? []).map((m) => ({ value: m, label: auditModuleLabel(m) }))),
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
