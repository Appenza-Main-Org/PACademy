/**
 * LookupTab — Gap I (admin-gaps).
 *
 * Parameterized table that renders any LookupKey from the platform-wide
 * lookup catalogue. Operations (per spec):
 *   - create / edit
 *   - activate / deactivate (preferred over delete)
 *   - soft delete (super admin) — blocked by dependency check
 *   - restore (super admin)
 *   - reorder via up / down arrow handles (drag would be nicer; skipped to
 *     stay product-register and to avoid pulling a dnd library)
 *
 * Hierarchical lookups (faculties under universities, specialties under
 * specialty-types) take a `parentLookup` prop so the form drawer offers a
 * parent picker.
 */

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  DataTable,
  Drawer,
  EmptyState,
  Input,
  Select,
  SoftDeleteDialog,
  toast,
} from '@/shared/components';
import type { DataTableColumn } from '@/shared/components';
import type { LookupKey, LookupRow } from '@/shared/types/domain';
import { useAuthStore } from '@/features/auth';
import {
  useLookupCreate,
  useLookupDependencies,
  useLookupList,
  useLookupReorder,
  useLookupRestore,
  useLookupSetActive,
  useLookupSoftDelete,
  useLookupUpdate,
} from '../../api/lookups.queries';
import type { ExistingRow } from '../../api/lookup-import';
import { ImportLookupButton } from './ImportLookupButton';
import { LOOKUP_IMPORT_LABELS } from './import-lookup-labels';

export interface LookupTabProps {
  lookupKey: LookupKey;
  /** Localized title for headings ("الجامعات"). */
  title: string;
  /** Hierarchical lookups pass their parent's key; the form gets a picker. */
  parentLookup?: LookupKey;
  /** Whether this lookup row carries an optional `gender`. */
  hasGender?: boolean;
}

const LOOKUP_DEP_LABELS: Record<string, string> = {
  faculties: 'كلية',
  specialties: 'تخصص',
  applicants: 'متقدم',
};

export function LookupTab({ lookupKey, title, parentLookup, hasGender }: LookupTabProps): JSX.Element {
  const isSuperAdmin = useAuthStore((s) => s.user?.role === 'super_admin');
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const listQuery = useLookupList(lookupKey, {
    includeDeleted: isSuperAdmin && includeDeleted,
  });
  const parentQuery = useLookupList(parentLookup ?? ('educationTypes' as LookupKey), {});
  /* parentQuery is fetched only when this lookup is hierarchical. */
  const parentRows = useMemo<LookupRow[]>(
    () => (parentLookup ? parentQuery.data ?? [] : []),
    [parentLookup, parentQuery.data],
  );

  const createMut = useLookupCreate(lookupKey);
  const updateMut = useLookupUpdate(lookupKey);
  const setActiveMut = useLookupSetActive(lookupKey);
  const reorderMut = useLookupReorder(lookupKey);
  const softDeleteMut = useLookupSoftDelete(lookupKey);
  const restoreMut = useLookupRestore(lookupKey);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<LookupRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LookupRow | null>(null);
  const dependencies = useLookupDependencies(lookupKey, pendingDelete?.id ?? null);

  const rows = useMemo<LookupRow[]>(() => listQuery.data ?? [], [listQuery.data]);

  const existingRows = useMemo<ExistingRow[]>(
    () =>
      rows.map((r) => ({
        collisionKey: r.key,
        id: r.id,
        isArchived: !!r.deletedAt,
        snapshot: r as unknown as Record<string, unknown>,
      })),
    [rows],
  );

  const parentExistingRows = useMemo<ExistingRow[]>(
    () =>
      parentRows.map((r) => ({
        collisionKey: r.key,
        id: r.id,
        isArchived: !!r.deletedAt,
        snapshot: r as unknown as Record<string, unknown>,
      })),
    [parentRows],
  );

  const existingSortMax = useMemo(
    () => (rows.length > 0 ? Math.max(...rows.map((r) => r.sortOrder)) : 0),
    [rows],
  );

  const move = (idx: number, delta: -1 | 1): void => {
    const target = rows[idx + delta];
    if (!target) return;
    const orderedIds = rows.map((r) => r.id);
    const a = orderedIds[idx];
    orderedIds[idx] = orderedIds[idx + delta]!;
    orderedIds[idx + delta] = a;
    reorderMut.mutate(orderedIds, {
      onSuccess: () => toast('تم إعادة الترتيب', 'success'),
      onError: (err) => toast((err).message, 'danger'),
    });
  };

  const columns: DataTableColumn<LookupRow>[] = [
    {
      key: 'sortOrder',
      label: 'الترتيب',
      width: 96,
      render: (r) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="نقل لأعلى"
            disabled={rows.indexOf(r) === 0}
            onClick={() => move(rows.indexOf(r), -1)}
          >
            <ArrowUp size={12} strokeWidth={1.75} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="نقل لأسفل"
            disabled={rows.indexOf(r) === rows.length - 1}
            onClick={() => move(rows.indexOf(r), 1)}
          >
            <ArrowDown size={12} strokeWidth={1.75} />
          </Button>
        </div>
      ),
    },
    { key: 'labelAr', label: 'الاسم بالعربية', render: (r) => r.labelAr },
    { key: 'labelEn', label: 'بالإنجليزية', render: (r) => <span dir="ltr">{r.labelEn ?? '—'}</span> },
    { key: 'key', label: 'المفتاح', render: (r) => <span dir="ltr" className="font-mono text-2xs">{r.key}</span> },
    ...(parentLookup
      ? [
          {
            key: 'parentId',
            label: 'الأب',
            render: (r: LookupRow) => parentRows.find((p) => p.id === r.parentId)?.labelAr ?? '—',
          } as DataTableColumn<LookupRow>,
        ]
      : []),
    ...(hasGender
      ? [
          {
            key: 'gender',
            label: 'النوع',
            render: (r: LookupRow) => (r.gender === 'male' ? 'ذكور' : r.gender === 'female' ? 'إناث' : 'الكل'),
          } as DataTableColumn<LookupRow>,
        ]
      : []),
    {
      key: 'isActive',
      label: 'الحالة',
      render: (r) =>
        r.deletedAt ? (
          <Badge tone="warning">محذوف</Badge>
        ) : r.isActive ? (
          <Badge tone="success">نشط</Badge>
        ) : (
          <Badge tone="neutral">معطل</Badge>
        ),
    },
    {
      key: 'isSystem',
      label: 'نظام',
      render: (r) => (r.isSystem ? <Badge tone="info">نظام</Badge> : null),
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
          {!r.deletedAt && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setActiveMut.mutate(
                  { id: r.id, isActive: !r.isActive },
                  {
                    onSuccess: () =>
                      toast(`تم ${r.isActive ? 'تعطيل' : 'تفعيل'} "${r.labelAr}"`, 'success'),
                    onError: (err) => toast((err).message, 'danger'),
                  },
                )
              }
              isLoading={setActiveMut.isPending}
            >
              {r.isActive ? 'تعطيل' : 'تفعيل'}
            </Button>
          )}
          {!r.deletedAt && !r.isSystem && isSuperAdmin && (
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<Trash2 size={12} strokeWidth={1.75} />}
              onClick={() => setPendingDelete(r)}
            >
              حذف
            </Button>
          )}
          {r.deletedAt && isSuperAdmin && (
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
              isLoading={restoreMut.isPending}
            >
              استعادة
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-ar-display text-md font-bold text-ink-900">{title}</h2>
          <p className="text-2xs text-ink-500">
            إجمالي السجلات:{' '}
            <span className="font-numeric tnum">{rows.length.toLocaleString('en-US')}</span>
          </p>
        </div>
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
          <ImportLookupButton
            lookupKey={lookupKey}
            lookupTitle={LOOKUP_IMPORT_LABELS[lookupKey] ?? title}
            existingRows={existingRows}
            existingSortMax={existingSortMax}
            parentRows={parentLookup ? parentExistingRows : undefined}
          />
          <Button
            variant="primary"
            leadingIcon={<Plus size={14} strokeWidth={1.75} />}
            onClick={() => {
              setEditing(null);
              setDrawerOpen(true);
            }}
          >
            إضافة جديد
          </Button>
        </div>
      </header>

      <DataTable
        data={rows}
        columns={columns}
        rowKey={(r) => r.id}
        loading={listQuery.isLoading}
        empty={<EmptyState variant="generic" title="لا توجد سجلات" description="أضِف أول سجل لبدء العمل." />}
        zebraStripes
        stickyHeader
        density="compact"
      />

      <LookupFormDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        editing={editing}
        parentRows={parentRows}
        parentLookup={parentLookup}
        hasGender={hasGender}
        onSubmit={async (payload) => {
          try {
            if (editing) {
              await updateMut.mutateAsync({ id: editing.id, patch: payload });
              toast('تم حفظ التعديلات', 'success');
            } else {
              await createMut.mutateAsync(payload as Omit<LookupRow, 'id' | 'isSystem'>);
              toast('تم إضافة السجل', 'success');
            }
            setDrawerOpen(false);
          } catch (err) {
            toast((err as Error).message, 'danger');
          }
        }}
      />

      <SoftDeleteDialog
        open={pendingDelete !== null}
        entityNoun="هذا السجل"
        entityLabel={pendingDelete?.labelAr ?? ''}
        dependencies={dependencies.data ?? null}
        dependencyLabels={LOOKUP_DEP_LABELS}
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
    </div>
  );
}

interface FormDrawerProps {
  open: boolean;
  onClose: () => void;
  editing: LookupRow | null;
  parentRows: LookupRow[];
  parentLookup?: LookupKey;
  hasGender?: boolean;
  onSubmit: (payload: Partial<LookupRow>) => void;
}

function LookupFormDrawer({
  open,
  onClose,
  editing,
  parentRows,
  parentLookup,
  hasGender,
  onSubmit,
}: FormDrawerProps): JSX.Element {
  const initial: Partial<LookupRow> = editing ?? {
    key: '',
    labelAr: '',
    labelEn: '',
    sortOrder: 999,
    isActive: true,
    parentId: parentLookup ? parentRows[0]?.id : undefined,
  };
  const [draft, setDraft] = useState<Partial<LookupRow>>(initial);

  if (open && editing && draft.id !== editing.id) setDraft(editing);
  if (open && !editing && draft.id) setDraft(initial);

  const set = <K extends keyof LookupRow>(k: K, v: LookupRow[K]): void =>
    setDraft((prev) => ({ ...prev, [k]: v }));

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={editing ? 'تعديل سجل' : 'إضافة سجل'}
      size="sm"
    >
      <Drawer.Body>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(draft);
          }}
        >
          <Input
            label="الاسم بالعربية"
            required
            value={draft.labelAr ?? ''}
            onChange={(e) => set('labelAr', e.target.value)}
          />
          <Input
            label="بالإنجليزية"
            dir="ltr"
            value={draft.labelEn ?? ''}
            onChange={(e) => set('labelEn', e.target.value)}
          />
          <Input
            label="المفتاح"
            dir="ltr"
            required
            value={draft.key ?? ''}
            onChange={(e) => set('key', e.target.value)}
            disabled={Boolean(editing?.isSystem)}
            helper={editing?.isSystem ? 'لا يمكن تعديل مفتاح سجلات النظام' : 'معرّف لاتيني فريد'}
          />
          <Input
            label="ترتيب الفرز"
            type="number"
            value={draft.sortOrder ?? 999}
            onChange={(e) => set('sortOrder', Number(e.target.value))}
          />
          {parentLookup && (
            <Select
              label="السجل الأب"
              value={draft.parentId ?? ''}
              onChange={(e) => set('parentId', e.target.value)}
              options={parentRows.map((r) => ({ value: r.id, label: r.labelAr }))}
            />
          )}
          {hasGender && (
            <Select
              label="النوع"
              value={(draft.gender as string) ?? ''}
              onChange={(e) => set('gender', (e.target.value || undefined) as LookupRow['gender'])}
              options={[
                { value: '', label: 'الكل' },
                { value: 'male', label: 'ذكور' },
                { value: 'female', label: 'إناث' },
              ]}
            />
          )}
          <label className="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-surface-card px-3 py-2 text-sm">
            <span className="text-ink-700">نشط</span>
            <input
              type="checkbox"
              checked={draft.isActive ?? true}
              onChange={(e) => set('isActive', e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-teal-500"
            />
          </label>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary">
              {editing ? 'حفظ' : 'إضافة'}
            </Button>
          </div>
        </form>
      </Drawer.Body>
    </Drawer>
  );
}
