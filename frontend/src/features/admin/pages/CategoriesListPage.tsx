/**
 * CategoriesListPage — Bucket D2.
 *
 * Lists the 7 spec departments + any custom departments. Per row:
 *   - label, key, type pill (public / nomination-only),
 *   - active-cycle status (open in current cycle / closed / no cycle),
 *   - actions (edit, delete-only-for-non-spec).
 *
 * Spec departments cannot be deleted; their delete button is hidden.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layers, Pencil, PlusCircle, RotateCcw, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SoftDeleteDialog,
  toast,
} from '@/shared/components';
import type { DataTableColumn } from '@/shared/components';
import type { ApplicantCategory } from '@/shared/types/domain';
import { ROUTES } from '@/config/routes';
import {
  useCategoriesAdmin,
  useCategoryDependencies,
  useCategoryRestore,
  useCategorySoftDelete,
} from '../api/categories.queries';
import { useActiveCycle } from '../api/cycles.queries';
import { categoriesAdminService } from '../api/categories.service';
import { useAuthStore } from '@/features/auth';

const CATEGORY_DEP_LABELS: Record<string, string> = {
  applicants: 'متقدم',
};

export function CategoriesListPage(): JSX.Element {
  const navigate = useNavigate();
  const userRole = useAuthStore((s) => s.user?.role);
  const isSuperAdmin = userRole === 'super_admin';
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const listQuery = useCategoriesAdmin({ includeDeleted: isSuperAdmin && includeDeleted });
  const cycleQuery = useActiveCycle();
  const softDeleteMut = useCategorySoftDelete();
  const restoreMut = useCategoryRestore();
  const [pendingDelete, setPendingDelete] = useState<ApplicantCategory | null>(null);
  const dependenciesQuery = useCategoryDependencies(pendingDelete?.key ?? null);

  if (listQuery.isLoading) return <LoadingState variant="page" />;
  if (listQuery.error) {
    return <ErrorState error={listQuery.error as Error} onRetry={() => listQuery.refetch()} />;
  }

  const categories = listQuery.data ?? [];
  const activeCycle = cycleQuery.data ?? null;

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
      onError: (err) => toast((err as Error).message, 'danger'),
    });
  };

  const columns: DataTableColumn<ApplicantCategory>[] = [
    {
      key: 'labelAr',
      label: 'الفئة',
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
      key: 'type',
      label: 'النوع',
      render: (cat) =>
        cat.conditions.nominationOnly ? (
          <Badge tone="warning">بالترشيح</Badge>
        ) : (
          <Badge tone="neutral">تقديم عام</Badge>
        ),
    },
    {
      key: 'conditions',
      label: 'الشروط',
      render: (cat) => {
        const parts: string[] = [];
        if (cat.conditions.ageMax !== null) parts.push(`السن ≤ ${cat.conditions.ageMax}`);
        if (cat.conditions.minHeightCm !== null) parts.push(`طول ≥ ${cat.conditions.minHeightCm}سم`);
        if (cat.conditions.minScorePercent !== null) parts.push(`مجموع ≥ ${cat.conditions.minScorePercent}%`);
        return <span className="text-2xs text-ink-500">{parts.join(' · ') || '—'}</span>;
      },
    },
    {
      key: 'tests',
      label: 'الاختبارات',
      numeric: true,
      render: (cat) => <span className="font-numeric tnum text-2xs text-ink-500">{cat.requiredTests.length}</span>,
    },
    {
      key: 'cycleStatus',
      label: 'الدورة الحالية',
      render: (cat) => {
        if (!activeCycle) return <span className="text-2xs text-ink-500">لا توجد دورة نشطة</span>;
        const cfg = activeCycle.openCategories?.[cat.key];
        return cfg?.isOpen ? (
          <span className="inline-flex items-center gap-1 text-2xs text-teal-700">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-teal-500" />
            مفتوح في الدورة الحالية
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-2xs text-ink-500">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-ink-300" />
            مغلق في الدورة الحالية
          </span>
        );
      },
    },
    {
      key: '_actions',
      label: <span className="sr-only">إجراءات</span>,
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
