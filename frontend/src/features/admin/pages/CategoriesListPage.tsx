/**
 * CategoriesListPage — list of the 4 RFP applicant categories.
 *
 * Per RFP §2.1 the category set is locked. The list is read-only beyond
 * the per-row "تعديل" affordance (which targets labelAr / description /
 * expandedConditions; the storage `key` is immutable). Create / duplicate
 * / delete affordances were retired alongside the lookup lockdown.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Pencil, RotateCcw } from 'lucide-react';
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  toast,
} from '@/shared/components';
import type { DataTableColumn, ListActionsConfig } from '@/shared/components';
import type { ApplicantCategory } from '@/shared/types/domain';
import { ROUTES } from '@/config/routes';
import { useCategoriesAdmin, useCategoryRestore } from '../api/categories.queries';

const DESCRIPTION_MAX_CHARS = 60;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function CategoriesListPage(): JSX.Element {
  const navigate = useNavigate();
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const listQuery = useCategoriesAdmin({ includeDeleted });
  const restoreMut = useCategoryRestore();

  const listActions: ListActionsConfig<ApplicantCategory> = useMemo(
    () => ({
      entityKey: 'admin.categories',
      entityLabelAr: 'فئات التقديم',
      auditModule: 'categories',
      deleted: {
        enabled: true,
        isShowing: includeDeleted,
        onToggle: setIncludeDeleted,
        isDeleted: (c) => Boolean(c.deletedAt),
      },
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
    [includeDeleted],
  );

  if (listQuery.isLoading) return <LoadingState variant="page" />;
  if (listQuery.error) {
    return <ErrorState error={listQuery.error as Error} onRetry={() => listQuery.refetch()} />;
  }

  const categories = listQuery.data ?? [];

  const columns: DataTableColumn<ApplicantCategory>[] = [
    {
      key: 'labelAr',
      label: 'اسم الفئة',
      sortable: true,
      getSortValue: (c) => c.labelAr,
      filter: { kind: 'text', getValue: (c) => c.labelAr },
      render: (cat) => (
        <button
          type="button"
          onClick={() => navigate(ROUTES.admin.categoryEdit(cat.key))}
          className="font-medium text-teal-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          {cat.labelAr}
        </button>
      ),
    },
    {
      key: 'description',
      label: 'الوصف',
      sortable: true,
      getSortValue: (c) => c.description ?? '',
      filter: { kind: 'text', getValue: (c) => c.description ?? '' },
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
      key: 'deletedAt',
      label: 'الحالة',
      sortable: true,
      getSortValue: (c) => (c.deletedAt ? 1 : 0),
      filter: {
        kind: 'enum',
        getValue: (c) => (c.deletedAt ? 'deleted' : 'active'),
        options: [
          { value: 'active', label: 'نشط' },
          { value: 'deleted', label: 'محذوف' },
        ],
      },
      render: (cat) =>
        cat.deletedAt ? <Badge tone="warning">محذوف</Badge> : <Badge tone="success">نشط</Badge>,
    },
    {
      key: '_actions',
      label: <span className="sr-only">الإجراءات</span>,
      align: 'end',
      render: (cat) => (
        <div className="flex items-center gap-1">
          {cat.deletedAt ? (
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<RotateCcw size={12} strokeWidth={1.75} />}
              onClick={() =>
                restoreMut.mutate(cat.key, {
                  onSuccess: () => toast(`تم استعادة "${cat.labelAr}"`, 'success'),
                  onError: (err) => toast((err as Error).message, 'danger'),
                })
              }
            >
              استعادة
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<Pencil size={12} strokeWidth={1.75} />}
              onClick={() => navigate(ROUTES.admin.categoryEdit(cat.key))}
            >
              تعديل
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="إدارة فئات التقديم"
        subtitle="الفئات الأربع المعتمدة في كراسة الشروط — تعديل الاسم والوصف فقط"
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
    </div>
  );
}
