/**
 * UsersPage — system operators list with filters and actions.
 * Backed by real API (spec 003, T175). Super-admin only (Role:super_admin).
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Shield } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Input,
  LoadingState,
  PageHeader,
  Select,
  toast,
} from '@/shared/components';
import type { DataTableColumn } from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ROLE_DEFINITIONS, ROLES, type Role } from '@/features/auth';
import { date as fmtDate } from '@/shared/lib/format';
import { ROUTES } from '@/config/routes';
import { useUsers, useUserDeactivate } from '../api/users.queries';
import type { SystemUserListItemDto } from '@/shared/types/domain';

const ROLE_OPTIONS = [
  { value: '', label: 'جميع الأدوار' },
  ...ROLES.map((r) => ({ value: r, label: ROLE_DEFINITIONS[r].labelAr })),
];

export function UsersPage(): JSX.Element {
  const navigate = useNavigate();

  const [roleFilter, setRoleFilter] = useState('');
  const [qFilter, setQFilter] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState<string>('');

  const filters = useMemo(() => ({
    role: roleFilter || undefined,
    q: qFilter || undefined,
    isActive: isActiveFilter === '' ? undefined : isActiveFilter === 'true',
    page: 1,
    pageSize: 25,
  }), [roleFilter, qFilter, isActiveFilter]);

  const { data, isLoading } = useUsers(filters);
  const deactivateMut = useUserDeactivate();

  const columns: DataTableColumn<SystemUserListItemDto>[] = useMemo(
    () => [
      {
        key: 'user',
        label: 'المستخدم',
        render: (u) => (
          <div className="flex items-center gap-3">
            <Avatar name={u.fullName} size="sm" />
            <div className="flex flex-col">
              <span className="font-medium text-ink-900">{u.fullName}</span>
              <span className="text-2xs text-ink-500 font-mono" dir="ltr">{u.nationalId}</span>
            </div>
          </div>
        ),
      },
      {
        key: 'role',
        label: 'الدور',
        render: (u) => {
          const def = ROLE_DEFINITIONS[u.role as Role];
          return <Badge tone="brand">{def?.labelAr ?? u.role}</Badge>;
        },
      },
      { key: 'unit', label: 'الوحدة', render: (u) => u.unit ?? '—', hideOn: 'sm' },
      {
        key: 'apps',
        label: 'التطبيقات',
        hideOn: 'md',
        render: (u) => {
          const def = ROLE_DEFINITIONS[u.role as Role];
          return (
            <span className="text-2xs text-ink-500 font-mono" dir="ltr">
              {def?.apps.slice(0, 4).join(' · ') ?? '—'}
              {(def?.apps.length ?? 0) > 4 && '…'}
            </span>
          );
        },
      },
      {
        key: 'active',
        label: 'الحالة',
        render: (u) =>
          u.isActive ? <Badge tone="success">نشط</Badge> : <Badge tone="neutral">معطّل</Badge>,
      },
      {
        key: 'createdAt',
        label: 'تاريخ الإنشاء',
        render: (u) => (
          <span className="text-2xs text-ink-500">{fmtDate(new Date(u.createdAt).getTime(), 'short')}</span>
        ),
        hideOn: 'sm',
      },
      {
        key: '_actions',
        label: <span className="sr-only">إجراءات</span>,
        align: 'end',
        render: (u) => (
          <div className="inline-flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              aria-label="تعطيل الحساب"
              onClick={(e) => {
                e.stopPropagation();
                if (!u.isActive) return;
                deactivateMut.mutate(u.id, {
                  onSuccess: () => toast('تم تعطيل الحساب', 'warning'),
                  onError: () => toast('فشل تعطيل الحساب', 'danger'),
                });
              }}
              disabled={!u.isActive}
            >
              <Shield size={14} strokeWidth={1.75} />
            </Button>
          </div>
        ),
      },
    ],
    [deactivateMut],
  );

  const items = data?.items ?? [];

  return (
    <CenteredShell>
      <PageHeader
        title="مستخدمو المنظومة"
        subtitle={`${data?.totalCount ?? 0} مستخدماً`}
        actions={
          <Button
            variant="primary"
            leadingIcon={<Plus size={14} strokeWidth={1.75} />}
            onClick={() => navigate(ROUTES.admin.userNew)}
          >
            مستخدم جديد
          </Button>
        }
      />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          aria-label="بحث"
          placeholder="بحث باسم أو رقم قومي…"
          value={qFilter}
          onChange={(e) => setQFilter(e.target.value)}
          className="w-56"
        />
        <Select
          aria-label="الدور"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          options={ROLE_OPTIONS}
        />
        <Select
          aria-label="الحالة"
          value={isActiveFilter}
          onChange={(e) => setIsActiveFilter(e.target.value)}
          options={[
            { value: '', label: 'جميع الحالات' },
            { value: 'true', label: 'نشط' },
            { value: 'false', label: 'معطّل' },
          ]}
        />
      </div>

      <Card>
        {isLoading ? (
          <LoadingState variant="list" rows={8} />
        ) : (
          <DataTable
            data={items}
            columns={columns}
            rowKey={(u) => u.id}
            empty={<EmptyState variant="generic" title="لا يوجد مستخدمون" />}
            onRowClick={(u) => navigate(ROUTES.admin.userDetail(u.id))}
            zebraStripes
            stickyHeader
          />
        )}
      </Card>
    </CenteredShell>
  );
}
