/**
 * RolesPage — Gap C (admin-gaps).
 *
 * Lists all roles (system + custom), opens an inline editor drawer for
 * permissions and scope. Super-admin only — gated by AuthGuard at the
 * route level (see routes.tsx).
 */

import { useEffect, useState } from 'react';
import { Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  DataTable,
  Drawer,
  EmptyState,
  Input,
  PageHeader,
  SoftDeleteDialog,
  toast,
} from '@/shared/components';
import type { DataTableColumn } from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { useAuthStore } from '@/features/auth';
import {
  useCreateRole,
  useRoleRestore,
  useRoleSoftDelete,
  useRolesAdmin,
  useUpdateRole,
} from '../api/roles.queries';
import { rolesService } from '../api/roles.service';
import { PermissionMatrix } from '../components/roles/PermissionMatrix';
import type { RoleDefinitionRow } from '@/shared/types/domain';

const ROLE_DEP_LABELS: Record<string, string> = {
  users: 'مستخدم',
};

const EMPTY_DRAFT: Omit<RoleDefinitionRow, 'id' | 'isSystem' | 'createdAt' | 'updatedAt'> = {
  key: '',
  labelAr: '',
  labelEn: '',
  permissions: [],
  apps: [],
};

export function RolesPage(): JSX.Element {
  const isSuperAdmin = useAuthStore((s) => s.user?.role === 'super_admin');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const listQuery = useRolesAdmin({ includeDeleted: isSuperAdmin && includeDeleted });
  const updateMut = useUpdateRole();
  const createMut = useCreateRole();
  const softDeleteMut = useRoleSoftDelete();
  const restoreMut = useRoleRestore();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<RoleDefinitionRow | null>(null);
  const [draft, setDraft] = useState<Omit<RoleDefinitionRow, 'id' | 'isSystem' | 'createdAt' | 'updatedAt'>>(EMPTY_DRAFT);
  const [pendingDelete, setPendingDelete] = useState<RoleDefinitionRow | null>(null);
  const [deleteDeps, setDeleteDeps] = useState<Awaited<ReturnType<typeof rolesService.getDependencies>> | null>(null);

  useEffect(() => {
    if (editing) setDraft({ ...editing });
    else setDraft(EMPTY_DRAFT);
  }, [editing]);

  useEffect(() => {
    if (!pendingDelete) {
      setDeleteDeps(null);
      return;
    }
    rolesService.getDependencies(pendingDelete.id).then(setDeleteDeps).catch(() => setDeleteDeps(null));
  }, [pendingDelete]);

  const rows = listQuery.data ?? [];

  const columns: DataTableColumn<RoleDefinitionRow>[] = [
    { key: 'labelAr', label: 'الاسم', render: (r) => <span className="font-medium text-ink-900">{r.labelAr}</span> },
    { key: 'isSystem', label: 'النوع', render: (r) => (r.isSystem ? <Badge tone="info">نظام</Badge> : <Badge tone="neutral">مخصص</Badge>) },
    {
      key: 'permissions',
      label: 'الصلاحيات',
      render: (r) =>
        r.permissions.includes('*') ? (
          <Badge tone="warning">جميع الصلاحيات</Badge>
        ) : (
          <span className="text-2xs text-ink-500">
            <span className="font-numeric tnum">{r.permissions.length}</span> صلاحية
          </span>
        ),
    },
    {
      key: 'deletedAt',
      label: 'الحالة',
      render: (r) => (r.deletedAt ? <Badge tone="warning">محذوف</Badge> : <Badge tone="success">نشط</Badge>),
    },
    {
      key: '_actions',
      label: <span className="sr-only">إجراءات</span>,
      align: 'end',
      render: (r) => (
        <div className="inline-flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<Pencil size={12} strokeWidth={1.75} />}
            onClick={() => {
              setEditing(r);
              setDrawerOpen(true);
            }}
          >
            تعديل
          </Button>
          {!r.isSystem && !r.deletedAt && (
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<Trash2 size={12} strokeWidth={1.75} />}
              onClick={() => setPendingDelete(r)}
            >
              حذف
            </Button>
          )}
          {r.deletedAt && (
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<RotateCcw size={12} strokeWidth={1.75} />}
              onClick={() =>
                restoreMut.mutate(r.id, {
                  onSuccess: () => toast(`تم استعادة "${r.labelAr}"`, 'success'),
                  onError: (err) => toast((err).message, 'danger'),
                })
              }
            >
              استعادة
            </Button>
          )}
        </div>
      ),
    },
  ];

  const isEditingSystem = Boolean(editing?.isSystem);

  const onSave = (): void => {
    if (editing) {
      updateMut.mutate(
        { id: editing.id, patch: draft },
        {
          onSuccess: () => {
            toast('تم حفظ الدور', 'success');
            setDrawerOpen(false);
            setEditing(null);
          },
          onError: (err) => toast((err).message, 'danger'),
        },
      );
    } else {
      /* Key is no longer admin-edited — auto-generate a stable
       * `custom_<timestamp>` so the row gets a unique identifier. */
      const payload = { ...draft, key: draft.key.trim() || `custom_${Date.now()}` };
      createMut.mutate(payload, {
        onSuccess: () => {
          toast('تم إنشاء الدور', 'success');
          setDrawerOpen(false);
        },
        onError: (err) => toast((err).message, 'danger'),
      });
    }
  };

  return (
    <CenteredShell>
      <PageHeader
        title="إدارة الأدوار والصلاحيات"
        subtitle="عدّل الأدوار النظامية وأنشئ أدواراً مخصصة بمصفوفة صلاحيات"
        actions={
          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <label className="flex items-center gap-2 text-2xs text-ink-500">
                <input
                  type="checkbox"
                  checked={includeDeleted}
                  onChange={(e) => setIncludeDeleted(e.target.checked)}
                  className="h-4 w-4 cursor-pointer accent-teal-500"
                />
                إظهار المحذوف
              </label>
            )}
            <Button
              variant="primary"
              leadingIcon={<Plus size={14} strokeWidth={1.75} />}
              onClick={() => {
                setEditing(null);
                setDrawerOpen(true);
              }}
            >
              إضافة دور
            </Button>
          </div>
        }
      />

      <Card>
        <DataTable
          data={rows}
          columns={columns}
          rowKey={(r) => r.id}
          loading={listQuery.isLoading}
          empty={<EmptyState variant="generic" title="لا توجد أدوار" />}
          zebraStripes
          stickyHeader
          density="compact"
          listActions={{
            entityKey: 'admin.roles',
            entityLabelAr: 'الأدوار',
            auditModule: 'roles',
            export: {
              enabled: true,
              formats: ['csv', 'xlsx'],
              filenamePrefix: 'أدوار-',
              columns: [
                { key: 'id', labelAr: 'المعرف' },
                { key: 'key', labelAr: 'مفتاح الدور' },
                { key: 'labelAr', labelAr: 'الاسم بالعربية' },
                { key: 'labelEn', labelAr: 'الاسم بالإنجليزية' },
                { key: 'isSystem', labelAr: 'نظامي', format: (v) => (v ? 'نعم' : 'لا') },
                {
                  key: 'permissions',
                  labelAr: 'الصلاحيات',
                  format: (v) => (Array.isArray(v) ? (v as string[]).join('، ') : ''),
                },
                {
                  key: 'apps',
                  labelAr: 'التطبيقات',
                  format: (v) => (Array.isArray(v) ? (v as string[]).join('، ') : ''),
                },
              ],
            },
          }}
        />
      </Card>

      <Drawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditing(null);
        }}
        title={editing ? `تعديل دور · ${editing.labelAr}` : 'إضافة دور'}
        subtitle={isEditingSystem ? 'دور نظام — التعديل مقصور على النطاق (scope)' : 'دور مخصص'}
        size="lg"
      >
        <Drawer.Body>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="الاسم بالعربية"
              required
              value={draft.labelAr}
              disabled={isEditingSystem}
              onChange={(e) => setDraft({ ...draft, labelAr: e.target.value })}
              containerClassName="md:col-span-2"
            />
          </div>
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-medium text-ink-900">مصفوفة الصلاحيات</h3>
            <PermissionMatrix
              permissions={draft.permissions}
              onChange={(next) => setDraft({ ...draft, permissions: next })}
              readOnly={isEditingSystem}
            />
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Button
            variant="ghost"
            onClick={() => {
              setDrawerOpen(false);
              setEditing(null);
            }}
          >
            إلغاء
          </Button>
          <Button
            variant="primary"
            isLoading={updateMut.isPending || createMut.isPending}
            onClick={onSave}
          >
            {editing ? 'حفظ' : 'إنشاء'}
          </Button>
        </Drawer.Footer>
      </Drawer>

      <SoftDeleteDialog
        open={pendingDelete !== null}
        entityNoun="هذا الدور"
        entityLabel={pendingDelete?.labelAr ?? ''}
        dependencies={deleteDeps}
        dependencyLabels={ROLE_DEP_LABELS}
        onClose={() => setPendingDelete(null)}
        onConfirm={async (reason) => {
          if (!pendingDelete) return;
          try {
            await softDeleteMut.mutateAsync({ id: pendingDelete.id, reason });
            toast(`تم حذف "${pendingDelete.labelAr}"`, 'success');
          } catch (err) {
            toast((err as Error).message, 'danger');
            throw err;
          }
        }}
      />
    </CenteredShell>
  );
}
