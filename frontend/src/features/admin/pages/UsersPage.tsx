/**
 * /admin/users — system users directory.
 *
 * NID-aware search, status + role filters, multi-role display per row.
 * Row click → user detail. "إنشاء حساب جديد" → UserCreatePage.
 */

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  Select,
  StatusBadge,
} from '@/shared/components';
import type { DataTableColumn } from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ROLE_DEFINITIONS, ROLES, type Role } from '@/features/auth';
import { ROUTES } from '@/config/routes';
import { date as fmtDate } from '@/shared/lib/format';
import { useUsers } from '../api/users.queries';
import type { AccountStatus, SystemUser } from '@/shared/types/domain';

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

export function UsersPage(): JSX.Element {
  const { data, isLoading } = useUsers();
  const navigate = useNavigate();

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
    ],
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
