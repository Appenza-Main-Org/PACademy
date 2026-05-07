/**
 * UsersPage — system users CRUD with role badges, activity log, and bulk actions.
 * Source: Tasks/KARASA_GAPS.md §1.2.E.
 */

import { useMemo, useState } from 'react';
import { KeyRound, Pencil, Plus, ShieldOff, Users as UsersIcon } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  DataTable,
  Drawer,
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
import { date as fmtDate, shortName } from '@/shared/lib/format';
import {
  useUserActivity,
  useUserBulkAssign,
  useUserCreate,
  useUserDeactivate,
  useUserReset2fa,
  useUserUpdate,
  useUsers,
} from '../api/users.queries';
import type { SystemUser } from '@/shared/types/domain';

const ROLE_OPTIONS = ROLES.map((r) => ({ value: r, label: ROLE_DEFINITIONS[r].labelAr }));

export function UsersPage(): JSX.Element {
  const { data, isLoading } = useUsers();
  const createMut = useUserCreate();
  const updateMut = useUserUpdate();
  const deactivateMut = useUserDeactivate();
  const reset2faMut = useUserReset2fa();
  const bulkAssignMut = useUserBulkAssign();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<SystemUser | null>(null);
  const [activityFor, setActivityFor] = useState<SystemUser | null>(null);
  const [selected, setSelected] = useState<(string | number)[]>([]);
  const [bulkRole, setBulkRole] = useState<Role>('committee_user');

  const columns: DataTableColumn<SystemUser>[] = useMemo(
    () => [
      {
        key: 'user',
        label: 'المستخدم',
        render: (u) => (
          <div className="flex items-center gap-3">
            <Avatar name={u.name} size="sm" />
            <div className="flex flex-col">
              <span className="font-medium text-ink-900">{shortName(u.name, 4)}</span>
              <span className="text-2xs text-ink-500 font-mono" dir="ltr">{u.id}</span>
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
      { key: 'unit', label: 'الوحدة', render: (u) => u.unit, hideOn: 'sm' },
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
        render: (u) => (u.active ? <Badge tone="success">نشط</Badge> : <Badge tone="neutral">معطّل</Badge>),
      },
      {
        key: 'lastLogin',
        label: 'آخر دخول',
        render: (u) => <span className="text-2xs text-ink-500">{fmtDate(u.lastLogin, 'rel')}</span>,
      },
      {
        key: '_actions',
        label: <span className="sr-only">إجراءات</span>,
        align: 'end',
        render: (u) => (
          <div className="inline-flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="عرض النشاط"
              onClick={(e) => {
                e.stopPropagation();
                setActivityFor(u);
              }}
            >
              <UsersIcon size={14} strokeWidth={1.75} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="تعديل"
              onClick={(e) => {
                e.stopPropagation();
                setEditing(u);
                setDrawerOpen(true);
              }}
            >
              <Pencil size={14} strokeWidth={1.75} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="إعادة ضبط المصادقة الثنائية"
              onClick={(e) => {
                e.stopPropagation();
                reset2faMut.mutate(u.id, {
                  onSuccess: () => toast('تم إعادة ضبط المصادقة الثنائية', 'success'),
                });
              }}
            >
              <KeyRound size={14} strokeWidth={1.75} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="تعطيل"
              onClick={(e) => {
                e.stopPropagation();
                deactivateMut.mutate(u.id, {
                  onSuccess: () => toast('تم تعطيل الحساب', 'warning'),
                });
              }}
            >
              <ShieldOff size={14} strokeWidth={1.75} />
            </Button>
          </div>
        ),
      },
    ],
    [deactivateMut, reset2faMut],
  );

  return (
    <CenteredShell>
      <PageHeader
        title="مستخدمو المنظومة"
        subtitle={`${data?.length ?? 0} مستخدماً عبر ${ROLES.length} أدوار`}
        actions={
          <Button
            variant="primary"
            leadingIcon={<Plus size={14} strokeWidth={1.75} />}
            onClick={() => {
              setEditing(null);
              setDrawerOpen(true);
            }}
          >
            مستخدم جديد
          </Button>
        }
      />

      {selected.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-teal-300 bg-teal-50 px-4 py-2 text-sm text-teal-800">
          <span>تم تحديد <span className="font-bold font-numeric tnum">{selected.length}</span> مستخدمين</span>
          <Select
            aria-label="الدور المستهدف"
            value={bulkRole}
            onChange={(e) => setBulkRole(e.target.value as Role)}
            options={ROLE_OPTIONS}
          />
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              bulkAssignMut.mutate(
                { ids: selected.map(String), role: bulkRole },
                {
                  onSuccess: ({ updated }) => {
                    toast(`تم تعيين الدور لـ ${updated} مستخدم`, 'success');
                    setSelected([]);
                  },
                },
              );
            }}
          >
            تعيين دور للمحدّدين
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected([])}>إلغاء التحديد</Button>
        </div>
      )}

      <Card>
        <DataTable
          data={data ?? []}
          columns={columns}
          rowKey={(u) => u.id}
          loading={isLoading}
          empty={<EmptyState variant="generic" title="لا يوجد مستخدمون" />}
          selectionMode="multi"
          selectedRowKeys={selected}
          onSelectionChange={setSelected}
          zebraStripes
          stickyHeader
        />
      </Card>

      <UserDrawer
        open={drawerOpen}
        editing={editing}
        onClose={() => setDrawerOpen(false)}
        onCreate={(payload) =>
          createMut.mutate(payload, {
            onSuccess: () => {
              toast('تم إنشاء المستخدم', 'success');
              setDrawerOpen(false);
            },
          })
        }
        onUpdate={(id, patch) =>
          updateMut.mutate(
            { id, patch },
            {
              onSuccess: () => {
                toast('تم حفظ التعديلات', 'success');
                setDrawerOpen(false);
              },
            },
          )
        }
        isSaving={createMut.isPending || updateMut.isPending}
      />

      <UserActivityDrawer user={activityFor} onClose={() => setActivityFor(null)} />
    </CenteredShell>
  );
}

interface DrawerProps {
  open: boolean;
  editing: SystemUser | null;
  onClose: () => void;
  onCreate: (payload: { name: string; role: string; unit: string; active: boolean }) => void;
  onUpdate: (id: string, patch: Partial<SystemUser>) => void;
  isSaving: boolean;
}

function UserDrawer({ open, editing, onClose, onCreate, onUpdate, isSaving }: DrawerProps): JSX.Element {
  const [name, setName] = useState(editing?.name ?? '');
  const [role, setRole] = useState<string>(editing?.role ?? 'committee_user');
  const [unit, setUnit] = useState(editing?.unit ?? '');
  const [active, setActive] = useState<boolean>(editing?.active ?? true);

  /* Reset when drawer reopens with a different target. */
  if (open && editing && editing.id !== undefined && name !== editing.name && role !== editing.role) {
    setName(editing.name);
    setRole(editing.role);
    setUnit(editing.unit);
    setActive(editing.active);
  }
  if (open && !editing && name && !role) {
    setName('');
    setRole('committee_user');
    setUnit('');
    setActive(true);
  }

  return (
    <Drawer open={open} onClose={onClose} title={editing ? 'تعديل مستخدم' : 'مستخدم جديد'} size="sm">
      <Drawer.Body>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (editing) onUpdate(editing.id, { name, role, unit, active });
            else onCreate({ name, role, unit, active });
          }}
        >
          <Input label="الاسم بالكامل" required value={name} onChange={(e) => setName(e.target.value)} />
          <Select
            label="الدور الوظيفي"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            options={ROLE_OPTIONS}
            required
          />
          <Input label="الوحدة / الإدارة" value={unit} onChange={(e) => setUnit(e.target.value)} />
          <label className="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-surface-card px-3 py-2 text-sm">
            <span className="text-ink-700">حساب نشط</span>
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-teal-500"
            />
          </label>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>
              {editing ? 'حفظ' : 'إضافة'}
            </Button>
          </div>
        </form>
      </Drawer.Body>
    </Drawer>
  );
}

function UserActivityDrawer({
  user,
  onClose,
}: {
  user: SystemUser | null;
  onClose: () => void;
}): JSX.Element {
  const { data, isLoading } = useUserActivity(user?.id ?? null);
  return (
    <Drawer
      open={Boolean(user)}
      onClose={onClose}
      title={user ? `سجل نشاط · ${shortName(user.name, 4)}` : 'سجل النشاط'}
      size="md"
    >
      <Drawer.Body>
        {isLoading ? (
          <LoadingState variant="list" rows={6} />
        ) : (data ?? []).length === 0 ? (
          <EmptyState variant="generic" title="لا توجد عمليات مسجلة" />
        ) : (
          <ol className="flex flex-col gap-3">
            {(data ?? []).slice(0, 30).map((entry) => (
              <li
                key={`${entry.ts}-${entry.action}-${entry.detail}`}
                className="flex flex-col rounded-md border border-border-subtle bg-surface-card px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink-900">{entry.action}</span>
                  <span className="text-2xs text-ink-500">{fmtDate(entry.ts, 'rel')}</span>
                </div>
                <p className="mt-1 text-sm text-ink-700">{entry.detail}</p>
                {entry.ip && (
                  <p className="mt-0.5 text-2xs text-ink-500 font-mono" dir="ltr">
                    IP {entry.ip}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </Drawer.Body>
    </Drawer>
  );
}
