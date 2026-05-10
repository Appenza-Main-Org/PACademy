/**
 * /admin/users — system users directory.
 *
 * NID-aware search, status + role filters, multi-role display per row.
 * Row click → user detail. "إنشاء حساب جديد" → UserCreatePage.
 */

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Copy, Plus } from 'lucide-react';
import { z } from 'zod';
import {
  Avatar,
  Badge,
  Button,
  Card,
  DataTable,
  DropdownMenu,
  DuplicateAction,
  EmptyState,
  Input,
  PageHeader,
  Select,
  StatusBadge,
} from '@/shared/components';
import type { DataTableColumn, ListActionsConfig } from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ROLE_DEFINITIONS, ROLES, type Role } from '@/features/auth';
import { ROUTES } from '@/config/routes';
import { date as fmtDate } from '@/shared/lib/format';
import { useQueryClient } from '@tanstack/react-query';
import { useUsers, usersKeys } from '../api/users.queries';
import { usersService } from '../api/users.service';
import type { AccountStatus, SystemUser, UserType } from '@/shared/types/domain';

const ROLE_OPTIONS = [
  { value: 'all', label: 'كل الأدوار' },
  ...ROLES.filter((r) => r !== 'applicant').map((r) => ({
    value: r,
    label: ROLE_DEFINITIONS[r].labelAr,
  })),
];

const STATUS_OPTIONS: ReadonlyArray<{ value: AccountStatus | 'all'; label: string }> = [
  { value: 'all', label: 'الكل' },
  { value: 'active', label: 'نشط' },
  { value: 'inactive', label: 'غير نشط' },
];

const userImportSchema = z.object({
  nationalId: z.string().regex(/^\d{14}$/, 'الرقم القومي يجب أن يكون 14 رقماً'),
  fullArabicName: z.string().min(3, 'الاسم الرباعي مطلوب'),
  officerCode: z.string().min(1, 'كود الضابط مطلوب'),
  mobileNumber: z.string().regex(/^\d{11}$/, 'رقم الموبايل يجب أن يكون 11 رقماً'),
  userType: z.enum(['officer', 'civilian', 'contractor']),
  roles: z.array(z.string().min(1)).min(1, 'يجب تحديد دور واحد على الأقل'),
  unit: z.string().optional(),
  accountStatus: z.enum(['active', 'inactive']),
});

type UserImportRow = z.infer<typeof userImportSchema>;

function mapImportRow(raw: Record<string, string>): Record<string, unknown> {
  return {
    nationalId: raw['الرقم القومي'] ?? raw['nationalId'] ?? '',
    fullArabicName: raw['الاسم الرباعي'] ?? raw['fullArabicName'] ?? '',
    officerCode: raw['كود الضابط'] ?? raw['officerCode'] ?? '',
    mobileNumber: raw['رقم الموبايل'] ?? raw['mobileNumber'] ?? '',
    userType: (raw['النوع'] ?? raw['userType'] ?? 'officer').toString().trim() as UserType,
    roles: (raw['الأدوار'] ?? raw['roles'] ?? '')
      .split(/[،,]/)
      .map((r) => r.trim())
      .filter(Boolean),
    unit: raw['الوحدة'] ?? raw['unit'] ?? '',
    accountStatus: ((raw['الحالة'] ?? raw['accountStatus'] ?? 'inactive') === 'نشط'
      ? 'active'
      : (raw['الحالة'] ?? raw['accountStatus'] ?? 'inactive')) as AccountStatus,
  };
}

export function UsersPage(): JSX.Element {
  const { data, isLoading } = useUsers();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AccountStatus | 'all'>('all');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');

  const filtered = useMemo(() => {
    const q = search.trim();
    const rows = data ?? [];
    return rows.filter((u) => {
      if (statusFilter !== 'all' && u.accountStatus !== statusFilter) return false;
      if (roleFilter !== 'all' && !u.roles.includes(roleFilter) && u.role !== roleFilter) {
        return false;
      }
      if (!q) return true;
      const haystack = [u.fullArabicName, u.name, u.nationalId, u.officerCode, u.id]
        .filter(Boolean)
        .join(' ');
      return haystack.includes(q);
    });
  }, [data, search, statusFilter, roleFilter]);

  const columns: DataTableColumn<SystemUser>[] = useMemo(
    () => [
      {
        key: 'user',
        label: 'المستخدم',
        render: (u) => (
          <div className="flex items-center gap-3">
            <Avatar name={u.fullArabicName} size="sm" />
            <div className="flex flex-col">
              <span className="font-medium text-ink-900">{u.fullArabicName}</span>
              <span className="text-2xs text-ink-500 font-mono" dir="ltr">
                {u.id}
              </span>
            </div>
          </div>
        ),
      },
      {
        key: 'nationalId',
        label: 'الرقم القومى',
        hideOn: 'sm',
        render: (u) => (
          <span className="text-2xs text-ink-700 font-mono tnum" dir="ltr">
            {u.nationalId || '—'}
          </span>
        ),
      },
      {
        key: 'officerCode',
        label: 'الكود',
        hideOn: 'md',
        render: (u) => (
          <span className="text-2xs text-ink-700 font-mono" dir="ltr">
            {u.officerCode || '—'}
          </span>
        ),
      },
      {
        key: 'roles',
        label: 'الأدوار',
        render: (u) => {
          const roles = u.roles.length > 0 ? u.roles : [u.role];
          const visible = roles.slice(0, 2);
          const extra = roles.length - visible.length;
          return (
            <div className="flex flex-wrap items-center gap-1">
              {visible.map((r) => (
                <Badge key={r} tone="brand">
                  {ROLE_DEFINITIONS[r as Role]?.labelAr ?? r}
                </Badge>
              ))}
              {extra > 0 && (
                <Badge tone="neutral">
                  <span className="font-numeric tnum">+{extra}</span>
                </Badge>
              )}
            </div>
          );
        },
      },
      { key: 'unit', label: 'الوحدة', hideOn: 'md', render: (u) => u.unit || '—' },
      {
        key: 'accountStatus',
        label: 'الحالة',
        render: (u) =>
          u.accountStatus === 'active' ? (
            <StatusBadge status="approved" />
          ) : (
            <Badge tone="neutral">غير نشط</Badge>
          ),
      },
      {
        key: 'lastLogin',
        label: 'آخر دخول',
        hideOn: 'md',
        render: (u) => (
          <span className="text-2xs text-ink-500">
            {u.lastLogin ? fmtDate(u.lastLogin, 'rel') : '—'}
          </span>
        ),
      },
      {
        key: '_actions',
        label: <span className="sr-only">إجراءات</span>,
        align: 'end',
        width: 96,
        render: (u) => (
          <DuplicateAction
            row={u}
            entityKey="admin.users"
            entityLabelAr="مستخدم"
            auditModule="users"
            config={{
              enabled: true,
              transform: (row) => ({
                fullArabicName: `${row.fullArabicName} (نسخة)`,
                roles: [...row.roles],
                unit: row.unit,
                userType: row.userType,
                accountStatus: 'inactive' as AccountStatus,
                /* NID + mobile must be re-entered before save (uniqueness). */
                nationalId: '',
                mobileNumber: '',
                officerCode: '',
              }),
              onCommit: async (_draft, source) => {
                /* The duplicate lands inactive with placeholder NID; the
                 * admin completes the fields on the edit page. */
                return usersService.createFromTemplate(source.id, {
                  nationalId: `00000000000000-${source.id}`,
                  fullArabicName: `${source.fullArabicName} (نسخة)`,
                  officerCode: '',
                  mobileNumber: '',
                });
              },
              redirectTo: (row) => ROUTES.admin.userEdit(row.id),
            }}
            onSuccess={() => qc.invalidateQueries({ queryKey: usersKeys.all })}
          >
            {({ onClick }) => (
              <DropdownMenu>
                <DropdownMenu.Trigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => e.stopPropagation()}
                    leadingIcon={<Copy size={12} strokeWidth={1.75} />}
                  >
                    نسخ
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content>
                  <DropdownMenu.Item
                    onSelect={(e) => {
                      e.preventDefault();
                      onClick();
                    }}
                  >
                    إنشاء نسخة كمسودة
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu>
            )}
          </DuplicateAction>
        ),
      },
    ],
    [qc],
  );

  const listActions: ListActionsConfig<SystemUser> = useMemo(
    () => ({
      entityKey: 'admin.users',
      entityLabelAr: 'مستخدمي المنظومة',
      auditModule: 'users',
      export: {
        enabled: true,
        formats: ['csv', 'xlsx'],
        filenamePrefix: 'مستخدمين-',
        columns: [
          { key: 'fullArabicName', labelAr: 'الاسم الرباعي' },
          { key: 'nationalId', labelAr: 'الرقم القومي' },
          { key: 'officerCode', labelAr: 'كود الضابط' },
          { key: 'mobileNumber', labelAr: 'رقم الموبايل' },
          { key: 'userType', labelAr: 'النوع' },
          { key: 'roles', labelAr: 'الأدوار', format: (v) => (Array.isArray(v) ? v.join('، ') : String(v ?? '')) },
          { key: 'unit', labelAr: 'الوحدة' },
          {
            key: 'accountStatus',
            labelAr: 'الحالة',
            format: (v) => (v === 'active' ? 'نشط' : 'غير نشط'),
          },
        ],
      },
      import: {
        enabled: true,
        formats: ['csv', 'xlsx'],
        schema: userImportSchema,
        mapRow: mapImportRow,
        onCommit: async (rows) => {
          const typed = rows as UserImportRow[];
          return usersService.bulkImport(typed);
        },
        onConflict: 'restore-or-create',
        templateColumns: [
          { key: 'nationalId', labelAr: 'الرقم القومي', sample: '12345678901234' },
          { key: 'fullArabicName', labelAr: 'الاسم الرباعي', sample: 'أحمد محمد علي الفقي' },
          { key: 'officerCode', labelAr: 'كود الضابط', sample: 'OFF-1001' },
          { key: 'mobileNumber', labelAr: 'رقم الموبايل', sample: '01000000000' },
          { key: 'userType', labelAr: 'النوع', sample: 'officer' },
          { key: 'roles', labelAr: 'الأدوار', sample: 'committee_admin، investigator' },
          { key: 'unit', labelAr: 'الوحدة', sample: 'إدارة الشؤون الإدارية' },
          { key: 'accountStatus', labelAr: 'الحالة', sample: 'نشط' },
        ],
      },
    }),
    [],
  );

  return (
    <CenteredShell>
      <PageHeader
        title="مستخدمو المنظومة"
        subtitle={`${data?.length ?? 0} حساب نشط عبر ${ROLES.length} أدوار`}
        actions={
          <Link to={ROUTES.admin.userNew} className="btn btn-primary">
            <Plus size={14} strokeWidth={1.75} /> إنشاء حساب جديد
          </Link>
        }
      />

      <Card className="mb-3">
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
          <Input
            label="بحث"
            placeholder="بحث بالاسم، الرقم القومى، الكود…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            label="الحالة"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AccountStatus | 'all')}
            options={[...STATUS_OPTIONS]}
          />
          <Select
            label="الدور"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as Role | 'all')}
            options={ROLE_OPTIONS}
          />
        </div>
      </Card>

      <Card>
        <DataTable
          data={filtered}
          columns={columns}
          rowKey={(u) => u.id}
          loading={isLoading}
          empty={
            <EmptyState
              variant="generic"
              title="لا يوجد مستخدمون يطابقون التصفية"
              description="جرّب تغيير معايير البحث أو إنشاء حساب جديد"
            />
          }
          onRowClick={(u) => navigate(ROUTES.admin.userDetail(u.id))}
          zebraStripes
          stickyHeader
          listActions={listActions}
          onImported={() => qc.invalidateQueries({ queryKey: usersKeys.all })}
        />
      </Card>

      {data && filtered.length === 0 && data.length > 0 && (
        <Button
          variant="ghost"
          className="mt-3"
          onClick={() => {
            setSearch('');
            setStatusFilter('all');
            setRoleFilter('all');
          }}
        >
          مسح التصفية
        </Button>
      )}
    </CenteredShell>
  );
}
