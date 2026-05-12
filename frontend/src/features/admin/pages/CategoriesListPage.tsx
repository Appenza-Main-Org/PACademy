/**
 * CategoriesListPage — list of the 4 RFP applicant categories.
 *
 * Per RFP §2.1 the category set is locked. The list is read-only beyond
 * the per-row "تعديل" affordance (which targets labelAr / description /
 * expandedConditions; the storage `key` is immutable). Create / duplicate
 * / delete affordances were retired alongside the lookup lockdown.
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Pencil } from 'lucide-react';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from '@/shared/components';
import type { DataTableColumn, ListActionsConfig } from '@/shared/components';
import type { ApplicantCategory } from '@/shared/types/domain';
import { ROUTES } from '@/config/routes';
import { useCategoriesAdmin } from '../api/categories.queries';

const DESCRIPTION_MAX_CHARS = 60;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function CategoriesListPage(): JSX.Element {
  const navigate = useNavigate();
  const listQuery = useCategoriesAdmin({ includeDeleted: false });

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
    return <ErrorState error={listQuery.error as Error} onRetry={() => listQuery.refetch()} />;
  }

  const categories = listQuery.data ?? [];

  const columns: DataTableColumn<ApplicantCategory>[] = [
    {
      key: 'labelAr',
      label: 'اسم الفئة',
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
      render: (cat) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<Pencil size={12} strokeWidth={1.75} />}
            onClick={() => navigate(ROUTES.admin.categoryEdit(cat.key))}
          >
            تعديل
          </Button>
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
