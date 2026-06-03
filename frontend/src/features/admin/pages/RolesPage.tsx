/**
 * RolesPage — Gap C (admin-gaps).
 *
 * Lists all roles (system + custom), opens an inline editor drawer for
 * permissions and scope. Super-admin only — gated by AuthGuard at the
 * route level (see routes.tsx).
 */

import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  DataTable,
  Drawer,
  EmptyState,
  Input,
  PageHeader,
  Select,
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
import {
  explicitCloudPermissionIds,
} from '@/features/admin/users/lib/cloudPermissions';
import type { RoleDefinitionRow } from '@/shared/types/domain';

/** Role-template keys offered on the create-flow drawer. The picker is
 *  hidden on the edit flow; the system super_admin row is already
 *  wildcard-locked and isn't re-templated. */
type RoleTemplateKey = 'custom' | 'super_admin';

/** Materialises every interactive `<module>:<action>` cell exactly once.
 *  Memoised at module level — the matrix taxonomy is a build-time
 *  constant, so we recompute zero times per drawer open. */
const ALL_INTERACTIVE_PERMISSIONS: readonly string[] = (() => {
  return explicitCloudPermissionIds();
})();

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
  /* Drives the create-flow "نوع الدور" picker. When the template is
   * `'super_admin'`, the permission matrix opens with every interactive
   * cell pre-checked. The admin can uncheck any cell — the template only
   * seeds the initial state, never locks it. */
  const [roleTemplate, setRoleTemplate] = useState<RoleTemplateKey>('custom');
  const [labelArError, setLabelArError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RoleDefinitionRow | null>(null);
  const [deleteDeps, setDeleteDeps] = useState<Awaited<ReturnType<typeof rolesService.getDependencies>> | null>(null);

  /** Per-template initial permissions list. Computed off `roleTemplate`
   *  rather than wired through setDraft directly so the source-of-truth
   *  taxonomy (`CLOUD_MODULES` × `CLOUD_ACTIONS`) is never mutated. */
  const templatePermissions = useMemo<readonly string[]>(() => {
    if (roleTemplate === 'super_admin') return ALL_INTERACTIVE_PERMISSIONS;
    return [];
  }, [roleTemplate]);

  useEffect(() => {
    if (editing) {
      setDraft({ ...editing });
      setRoleTemplate('custom');
    } else {
      setDraft({ ...EMPTY_DRAFT, permissions: [...templatePermissions] });
    }
    /* `templatePermissions` re-seeds on drawer reopen via the create
     * branch above; intentionally excluded so editing a row doesn't
     * silently rewrite its permissions when the picker is hidden. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  /* Re-seed the create-flow draft whenever the admin toggles the
   * template picker. Edit-mode is read-only on the picker so this
   * branch never fires while editing. */
  useEffect(() => {
    if (editing) return;
    setDraft((prev) => ({ ...prev, permissions: [...templatePermissions] }));
  }, [editing, templatePermissions]);

  useEffect(() => {
    if (!pendingDelete) {
      setDeleteDeps(null);
      return;
    }
    rolesService.getDependencies(pendingDelete.id).then(setDeleteDeps).catch(() => setDeleteDeps(null));
  }, [pendingDelete]);

  /* The applicant role is auto-assigned at portal sign-up and isn't
   * admin-editable from the cloud roles screen. It stays in the seed so
   * auth can resolve it; it just doesn't surface here. */
  const rows = (listQuery.data ?? []).filter((r) => r.key !== 'applicant');

  const columns: DataTableColumn<RoleDefinitionRow>[] = [
    {
      key: 'labelAr',
      label: 'الاسم',
      sortable: true,
      getSortValue: (r) => r.labelAr,
      filter: { kind: 'text', getValue: (r) => r.labelAr },
      render: (r) => <span className="font-medium text-ink-900">{r.labelAr}</span>,
    },
    {
      key: 'isSystem',
      label: 'النوع',
      sortable: true,
      getSortValue: (r) => (r.isSystem ? 1 : 0),
      filter: {
        kind: 'enum',
        getValue: (r) => (r.isSystem ? 'system' : 'custom'),
        options: [
          { value: 'system', label: 'نظام' },
          { value: 'custom', label: 'مخصص' },
        ],
      },
      render: (r) => (r.isSystem ? <Badge tone="info">نظام</Badge> : <Badge tone="neutral">مخصص</Badge>),
    },
    {
      key: 'permissions',
      label: 'الصلاحيات',
      sortable: true,
      getSortValue: (r) => (r.permissions.includes('*') ? Number.MAX_SAFE_INTEGER : r.permissions.length),
      filter: { kind: 'number', getValue: (r) => r.permissions.length },
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
      sortable: true,
      getSortValue: (r) => (r.deletedAt ? 1 : 0),
      filter: {
        kind: 'enum',
        getValue: (r) => (r.deletedAt ? 'deleted' : 'active'),
        options: [
          { value: 'active', label: 'نشط' },
          { value: 'deleted', label: 'محذوف' },
        ],
      },
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
              setLabelArError(null);
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
                  onError: (err) => toast((err as Error).message, 'danger'),
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
    const labelAr = draft.labelAr.trim();
    if (labelAr.length === 0) {
      setLabelArError('اسم الدور مطلوب');
      return;
    }

    const nextDraft = { ...draft, labelAr };
    if (editing) {
      updateMut.mutate(
        { id: editing.id, patch: nextDraft },
        {
          onSuccess: () => {
            toast('تم حفظ الدور', 'success');
            setDrawerOpen(false);
            setEditing(null);
            setRoleTemplate('custom');
          },
          onError: (err) => toast((err as Error).message, 'danger'),
        },
      );
    } else {
      /* Key is no longer admin-edited — auto-generate a stable
       * `custom_<timestamp>` so the row gets a unique identifier. */
      const payload = { ...nextDraft, key: nextDraft.key.trim() || `custom_${Date.now()}` };
      createMut.mutate(payload, {
        onSuccess: () => {
          toast('تم إنشاء الدور', 'success');
          setDrawerOpen(false);
          setRoleTemplate('custom');
        },
        onError: (err) => toast((err as Error).message, 'danger'),
      });
    }
  };

  return (
    <CenteredShell>
      <PageHeader
        title="إدارة الأدوار والصلاحيات"
        subtitle="عدّل الأدوار النظامية وأنشئ أدواراً مخصصة بمصفوفة صلاحيات"
        actions={
          <Button
            variant="primary"
            leadingIcon={<Plus size={14} strokeWidth={1.75} />}
            onClick={() => {
              setEditing(null);
              setLabelArError(null);
              setDrawerOpen(true);
            }}
          >
            إضافة دور
          </Button>
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
            deleted: {
              enabled: isSuperAdmin,
              isShowing: includeDeleted,
              onToggle: setIncludeDeleted,
              isDeleted: (r) => Boolean(r.deletedAt),
            },
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
          setLabelArError(null);
          setRoleTemplate('custom');
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
              onChange={(e) => {
                setDraft({ ...draft, labelAr: e.target.value });
                setLabelArError(null);
              }}
              error={labelArError ?? undefined}
              containerClassName="md:col-span-2"
            />
            {!editing && (
              <Select
                label="نوع الدور"
                value={roleTemplate}
                onChange={(e) => setRoleTemplate(e.target.value as RoleTemplateKey)}
                options={[
                  { value: 'custom', label: 'دور مخصص' },
                  { value: 'super_admin', label: 'مدير النظام — جميع الصلاحيات' },
                ]}
                containerClassName="md:col-span-2"
              />
            )}
          </div>
          {(roleTemplate === 'super_admin' && !editing) || editing?.key === 'super_admin' ? (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-2xs text-teal-700">
              <ShieldCheck size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
              <span>مدير النظام يملك جميع الصلاحيات افتراضيًا</span>
            </div>
          ) : null}
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-medium text-ink-900">مصفوفة الصلاحيات</h3>
            <PermissionMatrix
              permissions={draft.permissions}
              onChange={(next) => setDraft({ ...draft, permissions: next })}
            />
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Button
            variant="ghost"
            onClick={() => {
              setDrawerOpen(false);
              setEditing(null);
              setRoleTemplate('custom');
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
