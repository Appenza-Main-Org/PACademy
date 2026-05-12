/**
 * CategoriesListPage — list of applicant categories.
 *
 * Visible columns reflect the trimmed category schema:
 *   - اسم الفئة (labelAr)
 *   - الوصف   (description, truncated)
 *   - الإجراءات (edit / duplicate / delete or restore)
 *
 * Spec departments cannot be deleted; their delete button is hidden.
 */

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Copy, Layers, Pencil, PlusCircle, RotateCcw, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  DataTable,
  DuplicateAction,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SoftDeleteDialog,
  toast,
} from '@/shared/components';
import type { DataTableColumn, ListActionsConfig } from '@/shared/components';
import type { ApplicantCategory } from '@/shared/types/domain';
import { ROUTES } from '@/config/routes';
import {
  useCategoriesAdmin,
  useCategoryDependencies,
  useCategoryRestore,
  useCategorySoftDelete,
} from '../api/categories.queries';
import { categoriesAdminService } from '../api/categories.service';
import { useAuthStore } from '@/features/auth';

const CATEGORY_DEP_LABELS: Record<string, string> = {
  applicants: 'متقدم',
};

const DESCRIPTION_MAX_CHARS = 60;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function CategoriesListPage(): JSX.Element {
  const navigate = useNavigate();
  const userRole = useAuthStore((s) => s.user?.role);
  const isSuperAdmin = userRole === 'super_admin';
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const listQuery = useCategoriesAdmin({ includeDeleted: isSuperAdmin && includeDeleted });
  const softDeleteMut = useCategorySoftDelete();
  const restoreMut = useCategoryRestore();
  const [pendingDelete, setPendingDelete] = useState<ApplicantCategory | null>(null);
  const dependenciesQuery = useCategoryDependencies(pendingDelete?.key ?? null);
  const qc = useQueryClient();

  const listActions: ListActionsConfig<ApplicantCategory> = useMemo(
    () => ({
      entityKey: 'admin.categories',
      entityLabelAr: 'فئات التقديم',
      auditModule: 'categories',
      export: {
        enabled: true,
        formats: ['csv', 'xlsx'],
        filenamePrefix: 'فئات-التقديم-',
        columns: [
          { key: 'labelAr', labelAr: 'اسم الفئة' },
          { key: 'description', labelAr: 'الوصف' },
        ],
      },
    }),
    [],
  );

  if (listQuery.isLoading) return <LoadingState variant="page" />;
  if (listQuery.error) {
    return <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />;
  }

  const categories = listQuery.data ?? [];

  const onDeleteClick = (cat: ApplicantCategory): void => {
    if (categoriesAdminService.isSpecCategory(cat.key)) {
      toast('لا يمكن حذف الفئات المعتمدة من المواصفات', 'warning');
      return;
    }
    setPendingDelete(cat);
  };

  const onRestore = (cat: ApplicantCategory): void => {
    restoreMut.mutate(cat.key, {
      onSuccess: () => toast(`تم استعادة "${cat.labelAr}"`, 'success'),
      onError: (err) => toast((err).message, 'danger'),
    });
  };

  const columns: DataTableColumn<ApplicantCategory>[] = [
    {
      key: 'labelAr',
      label: 'اسم الفئة',
      render: (cat) => (
        <Link
          to={ROUTES.admin.categoryEdit(cat.key)}
          className="font-medium text-teal-700 hover:underline"
        >
          {cat.labelAr}
        </Link>
      ),
    },
    {
      key: 'description',
      label: 'الوصف',
      render: (cat) => {
        const text = (cat.description ?? '').trim();
        if (!text) return <span className="text-2xs text-ink-400">—</span>;
        return (
          <span title={text} className="text-2xs text-ink-700">
            {truncate(text, DESCRIPTION_MAX_CHARS)}
          </span>
        );
      },
    },
    {
      key: '_actions',
      label: <span className="sr-only">الإجراءات</span>,
      align: 'end',
      render: (cat) => {
        const isSpec = categoriesAdminService.isSpecCategory(cat.key);
        const deleted = Boolean(cat.deletedAt);
        return (
          <div className="flex items-center gap-1">
            {deleted && <Badge tone="warning">محذوف</Badge>}
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<Pencil size={12} strokeWidth={1.75} />}
              onClick={() => navigate(ROUTES.admin.categoryEdit(cat.key))}
            >
              تعديل
            </Button>
            {!deleted && (
              <DuplicateAction
                row={cat}
                entityKey="admin.categories"
                entityLabelAr="فئة التقديم"
                auditModule="categories"
                config={{
                  enabled: true,
                  transform: (row) => ({
                    labelAr: `${row.labelAr} (نسخة)`,
                  }),
                  onCommit: async (_draft, source) => categoriesAdminService.duplicate(source),
                  redirectTo: (row) => ROUTES.admin.categoryEdit(row.key),
                  guard: (row) => (row.deletedAt ? 'لا يمكن نسخ فئة محذوفة' : null),
                }}
                onSuccess={() => qc.invalidateQueries({ queryKey: ['categories'] })}
              >
                {({ onClick }) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    leadingIcon={<Copy size={12} strokeWidth={1.75} />}
                    onClick={onClick}
                  >
                    نسخ
                  </Button>
                )}
              </DuplicateAction>
            )}
            {!isSpec && !deleted && (
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<Trash2 size={12} strokeWidth={1.75} />}
                onClick={() => onDeleteClick(cat)}
              >
                حذف
              </Button>
            )}
            {isSuperAdmin && deleted && (
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<RotateCcw size={12} strokeWidth={1.75} />}
                onClick={() => onRestore(cat)}
                isLoading={restoreMut.isPending}
              >
                استعادة
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="إدارة فئات التقديم"
        subtitle="عدّل الفئات السبع المعتمدة وأضف فئات مخصصة"
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
            <Link to={ROUTES.admin.categoryNew}>
              <Button
                variant="primary"
                leadingIcon={<PlusCircle size={14} strokeWidth={1.75} />}
              >
                إضافة فئة
              </Button>
            </Link>
          </div>
        }
      />

      <DataTable
        data={categories}
        columns={columns}
        rowKey={(c) => c.key}
        loading={listQuery.isFetching}
        empty={
          <EmptyState
            variant="generic"
            title="لا توجد فئات"
            description="لم يتم إنشاء فئات تقديم بعد."
            icon={<Layers size={32} strokeWidth={1.75} />}
          />
        }
        zebraStripes
        listActions={listActions}
      />

      <SoftDeleteDialog
        open={pendingDelete !== null}
        entityNoun="هذه الفئة"
        entityLabel={pendingDelete?.labelAr ?? ''}
        dependencies={dependenciesQuery.data ?? null}
        dependencyLabels={CATEGORY_DEP_LABELS}
        onClose={() => setPendingDelete(null)}
        onConfirm={async (reason) => {
          if (!pendingDelete) return;
          try {
            await softDeleteMut.mutateAsync({ key: pendingDelete.key, reason });
            toast(`تم حذف "${pendingDelete.labelAr}"`, 'success');
          } catch (err) {
            toast((err as Error).message, 'danger');
            throw err;
          }
        }}
      />
    </div>
  );
}
