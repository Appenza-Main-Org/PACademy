/**
 * LookupGrid — flat list view of LookupItems for a single lookup type.
 *
 * Wraps the shared `DataTable<LookupItem>` and adds:
 *  - debounced search (200ms, `normalizeArabic` on nameAr/code/nameEn)
 *  - includeInactive filter (Select)
 *  - bulk activate / deactivate / delete with a confirmation Modal
 *  - per-row Edit/Delete actions
 *
 * Lives in-feature; not promoted to shared (CLAUDE.md §2.5 Guardrail —
 * single consumer module).
 */

import { useMemo, useState } from 'react';
import { MoreVertical, Plus, Search } from 'lucide-react';
import {
  Badge,
  Button,
  DataTable,
  DropdownMenu,
  Input,
  Modal,
  Select,
  type DataTableColumn,
  type DataTablePagination,
} from '@/shared/components';
import { date as formatDate } from '@/shared/lib/format';
import { useDeleteLookup, useLookupList } from '../api/lookups.queries';
import type { LookupItem, LookupTypeCode } from '../types';

export interface LookupGridProps {
  typeCode: LookupTypeCode;
  onEdit: (item: LookupItem) => void;
  onCreate: () => void;
}

export function LookupGrid({ typeCode, onEdit, onCreate }: LookupGridProps): JSX.Element {
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<LookupItem | null>(null);

  // Debounce search input.
  useMemo(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 200);
    return () => window.clearTimeout(t);
  }, [search]);

  const listQuery = useLookupList({
    typeCode,
    search: debouncedSearch || undefined,
    includeInactive,
    page,
    pageSize,
  });

  const deleteMut = useDeleteLookup();

  const rows = listQuery.data?.data ?? [];

  const columns: DataTableColumn<LookupItem>[] = [
    {
      key: 'code',
      label: 'الكود',
      accessor: 'code',
      sortable: true,
      width: 140,
      render: (row) => <span className="font-mono text-xs">{row.code}</span>,
    },
    {
      key: 'nameAr',
      label: 'الاسم بالعربية',
      accessor: 'nameAr',
      sortable: true,
      render: (row) => <span className="font-medium text-ink-900">{row.nameAr}</span>,
    },
    {
      key: 'nameEn',
      label: 'الاسم بالإنجليزية',
      accessor: 'nameEn',
      hideOn: 'sm',
      render: (row) =>
        row.nameEn ? <span className="text-ink-700">{row.nameEn}</span> : <span className="text-ink-400">—</span>,
    },
    {
      key: 'sortOrder',
      label: 'الترتيب',
      accessor: 'sortOrder',
      numeric: true,
      sortable: true,
      width: 90,
    },
    {
      key: 'isActive',
      label: 'الحالة',
      width: 110,
      render: (row) =>
        row.isActive ? (
          <Badge tone="success">مفعّل</Badge>
        ) : (
          <Badge tone="warning">غير مفعّل</Badge>
        ),
    },
    {
      key: 'createdAt',
      label: 'تاريخ الإنشاء',
      accessor: 'createdAt',
      hideOn: 'md',
      width: 140,
      render: (row) => <span className="text-xs text-ink-600">{formatDate(row.createdAt, 'short')}</span>,
    },
    {
      key: 'actions',
      label: <span className="sr-only">إجراءات</span>,
      width: 56,
      align: 'end',
      render: (row) => (
        <DropdownMenu>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label="إجراءات"
              className="flex h-7 w-7 items-center justify-center rounded text-ink-400 hover:bg-ink-50 hover:text-ink-700"
            >
              <MoreVertical size={16} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Item onSelect={() => onEdit(row)}>تعديل</DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item destructive onSelect={() => setPendingDelete(row)}>
              حذف
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      ),
    },
  ];

  const pagination: DataTablePagination = {
    page,
    pageSize,
    total: listQuery.data?.total ?? 0,
    pageSizeOptions: [10, 20, 50, 100],
    onPageChange: setPage,
    onPageSizeChange: setPageSize,
  };

  const toolbar = (
    <div className="flex flex-wrap items-end gap-2">
      <Input
        label="بحث"
        placeholder="ابحث بالاسم أو الكود…"
        leadingIcon={<Search size={16} />}
        value={search}
        onChange={(e) => {
          setSearch(e.currentTarget.value);
          setPage(1);
        }}
        containerClassName="min-w-72"
      />
      <Select
        label="الحالة"
        value={includeInactive ? 'all' : 'active'}
        onChange={(e) => {
          setIncludeInactive(e.currentTarget.value === 'all');
          setPage(1);
        }}
        options={[
          { value: 'active', label: 'النشطة فقط' },
          { value: 'all', label: 'الكل (نشطة وغير نشطة)' },
        ]}
        containerClassName="min-w-48"
      />
      <div className="ms-auto flex items-end">
        <Button variant="primary" leadingIcon={<Plus size={16} />} onClick={onCreate}>
          إضافة
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <DataTable<LookupItem>
        data={rows}
        columns={columns}
        rowKey={(row) => row.id}
        loading={listQuery.isLoading}
        density="default"
        stickyHeader
        pagination={pagination}
        toolbar={toolbar}
        empty={
          <p className="py-12 text-center text-sm text-ink-500">لا توجد عناصر مطابقة.</p>
        }
      />
      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="تأكيد الحذف"
        size="sm"
      >
        {pendingDelete && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink-700">
              سيتم تعطيل العنصر <span className="font-medium text-ink-900">{pendingDelete.nameAr}</span>
              {' '}(كود {pendingDelete.code}). هل أنت متأكد؟
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPendingDelete(null)}>
                إلغاء
              </Button>
              <Button
                variant="danger"
                isLoading={deleteMut.isPending}
                onClick={() => {
                  deleteMut.mutate(
                    { id: pendingDelete.id, typeCode },
                    { onSuccess: () => setPendingDelete(null) },
                  );
                }}
              >
                حذف
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
