/**
 * NotificationsPage — Gap L (admin-gaps).
 *
 * Combined list + create/edit drawer. Status filter at the top, status
 * pill on every row, publish/unpublish/soft-delete actions inline. The
 * drawer shows the typed AudienceSelector and DatePickers for publish /
 * expire windows.
 */

import { useEffect, useState } from 'react';
import { Bell, BellOff, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  DataTable,
  DatePicker,
  Drawer,
  EmptyState,
  Input,
  PageHeader,
  Select,
  SoftDeleteDialog,
  Textarea,
  toast,
} from '@/shared/components';
import type { DataTableColumn } from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { useAuthStore } from '@/features/auth';
import {
  useAdminNotifications,
  useCreateAdminNotification,
  usePublishNotification,
  useSoftDeleteNotification,
  useUnpublishNotification,
  useUpdateAdminNotification,
} from '../api/notifications.queries';
import { AudienceSelector } from '../components/notifications/AudienceSelector';
import type {
  AdminNotification,
  AdminNotificationStatus,
  AdminNotificationType,
  AudienceSelector as AudienceValue,
} from '@/shared/types/domain';
import { date as fmtDate } from '@/shared/lib/format';

const STATUS_LABEL: Record<AdminNotificationStatus, string> = {
  draft: 'مسودة',
  scheduled: 'مجدول',
  published: 'منشور',
  expired: 'منتهي',
};

const STATUS_TONE: Record<AdminNotificationStatus, 'success' | 'warning' | 'info' | 'neutral'> = {
  draft: 'neutral',
  scheduled: 'info',
  published: 'success',
  expired: 'warning',
};

const TYPE_LABEL: Record<AdminNotificationType, string> = {
  general: 'عام',
  student: 'متقدم',
  department: 'قسم',
  category: 'فئة',
  committee: 'لجنة',
};

const EMPTY_DRAFT: Omit<AdminNotification, 'id' | 'status' | 'createdAt'> = {
  type: 'general',
  titleAr: '',
  bodyAr: '',
  audience: { type: 'general' },
  publishAt: new Date().toISOString(),
  createdBy: 'U-001',
};

export function NotificationsPage(): JSX.Element {
  const userId = useAuthStore((s) => s.user?.id ?? 'U-001');
  const [statusFilter, setStatusFilter] = useState<AdminNotificationStatus | 'all'>('all');
  const listQuery = useAdminNotifications({ status: statusFilter });
  const createMut = useCreateAdminNotification();
  const updateMut = useUpdateAdminNotification();
  const publishMut = usePublishNotification();
  const unpublishMut = useUnpublishNotification();
  const deleteMut = useSoftDeleteNotification();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<AdminNotification | null>(null);
  const [draft, setDraft] = useState<Omit<AdminNotification, 'id' | 'status' | 'createdAt'>>({
    ...EMPTY_DRAFT,
    createdBy: userId,
  });
  const [pendingDelete, setPendingDelete] = useState<AdminNotification | null>(null);

  useEffect(() => {
    if (editing) {
      setDraft({
        type: editing.type,
        titleAr: editing.titleAr,
        bodyAr: editing.bodyAr,
        audience: editing.audience,
        publishAt: editing.publishAt,
        expireAt: editing.expireAt,
        createdBy: editing.createdBy,
      });
    } else {
      setDraft({ ...EMPTY_DRAFT, createdBy: userId });
    }
  }, [editing, userId]);

  const rows = listQuery.data ?? [];

  const columns: DataTableColumn<AdminNotification>[] = [
    {
      key: 'titleAr',
      label: 'العنوان',
      render: (n) => <span className="font-medium text-ink-900">{n.titleAr}</span>,
    },
    {
      key: 'type',
      label: 'النوع',
      render: (n) => <Badge tone="neutral">{TYPE_LABEL[n.type]}</Badge>,
    },
    {
      key: 'status',
      label: 'الحالة',
      render: (n) => <Badge tone={STATUS_TONE[n.status]}>{STATUS_LABEL[n.status]}</Badge>,
    },
    {
      key: 'publishAt',
      label: 'النشر',
      render: (n) => <span className="text-2xs text-ink-500">{fmtDate(n.publishAt, 'short')}</span>,
    },
    {
      key: 'expireAt',
      label: 'الانتهاء',
      render: (n) => (
        <span className="text-2xs text-ink-500">{n.expireAt ? fmtDate(n.expireAt, 'short') : '—'}</span>
      ),
    },
    {
      key: '_actions',
      label: <span className="sr-only">إجراءات</span>,
      align: 'end',
      render: (n) => (
        <div className="inline-flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<Pencil size={12} strokeWidth={1.75} />}
            onClick={() => {
              setEditing(n);
              setDrawerOpen(true);
            }}
          >
            تعديل
          </Button>
          {(n.status === 'draft' || n.status === 'scheduled') && (
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<Bell size={12} strokeWidth={1.75} />}
              onClick={() =>
                publishMut.mutate(n.id, {
                  onSuccess: () => toast('تم النشر', 'success'),
                  onError: (err) => toast((err as Error).message, 'danger'),
                })
              }
            >
              نشر
            </Button>
          )}
          {n.status === 'published' && (
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<BellOff size={12} strokeWidth={1.75} />}
              onClick={() =>
                unpublishMut.mutate(n.id, {
                  onSuccess: () => toast('تم سحب الإشعار', 'success'),
                  onError: (err) => toast((err as Error).message, 'danger'),
                })
              }
            >
              سحب
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<Trash2 size={12} strokeWidth={1.75} />}
            onClick={() => setPendingDelete(n)}
          >
            حذف
          </Button>
        </div>
      ),
    },
  ];

  const onSave = (): void => {
    /* Type is derived from the audience selector, kept in lockstep. */
    const payload = { ...draft, type: draft.audience.type };
    if (editing) {
      updateMut.mutate(
        { id: editing.id, patch: payload },
        {
          onSuccess: () => {
            toast('تم حفظ الإشعار', 'success');
            setDrawerOpen(false);
            setEditing(null);
          },
          onError: (err) => toast((err as Error).message, 'danger'),
        },
      );
    } else {
      createMut.mutate(payload, {
        onSuccess: () => {
          toast('تم إنشاء الإشعار', 'success');
          setDrawerOpen(false);
        },
        onError: (err) => toast((err as Error).message, 'danger'),
      });
    }
  };

  return (
    <CenteredShell>
      <PageHeader
        title="إدارة الإشعارات"
        subtitle="إنشاء ونشر إشعارات للمتقدمين — عام أو موجه لفئة / لجنة / قسم / متقدم محدد"
        actions={
          <Button
            variant="primary"
            leadingIcon={<Plus size={14} strokeWidth={1.75} />}
            onClick={() => {
              setEditing(null);
              setDrawerOpen(true);
            }}
          >
            إشعار جديد
          </Button>
        }
      />

      <Card>
        <div className="mb-4 flex items-center gap-3">
          <Select
            label="الحالة"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AdminNotificationStatus | 'all')}
            options={[
              { value: 'all', label: 'الكل' },
              ...(Object.entries(STATUS_LABEL) as [AdminNotificationStatus, string][]).map(([v, l]) => ({
                value: v,
                label: l,
              })),
            ]}
          />
        </div>
        <DataTable
          data={rows}
          columns={columns}
          rowKey={(n) => n.id}
          loading={listQuery.isLoading}
          empty={<EmptyState variant="generic" title="لا توجد إشعارات" icon={<Eye size={32} />} />}
          zebraStripes
          stickyHeader
        />
      </Card>

      <Drawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditing(null);
        }}
        title={editing ? `تعديل إشعار · ${editing.titleAr}` : 'إشعار جديد'}
        size="lg"
      >
        <Drawer.Body>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="العنوان"
              required
              value={draft.titleAr}
              onChange={(e) => setDraft({ ...draft, titleAr: e.target.value })}
            />
            <DatePicker
              label="تاريخ النشر"
              value={new Date(draft.publishAt)}
              onChange={(d) => setDraft({ ...draft, publishAt: d?.toISOString() ?? draft.publishAt })}
            />
            <DatePicker
              label="تاريخ الانتهاء (اختياري)"
              value={draft.expireAt ? new Date(draft.expireAt) : null}
              onChange={(d) => setDraft({ ...draft, expireAt: d?.toISOString() ?? undefined })}
            />
            <div />
            <Textarea
              label="نص الإشعار"
              required
              value={draft.bodyAr}
              onChange={(e) => setDraft({ ...draft, bodyAr: e.target.value })}
              rows={4}
              containerClassName="md:col-span-2"
            />
            <div className="md:col-span-2">
              <AudienceSelector
                value={draft.audience as AudienceValue}
                onChange={(audience) => setDraft({ ...draft, audience, type: audience.type })}
              />
            </div>
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
            onClick={onSave}
            isLoading={createMut.isPending || updateMut.isPending}
          >
            {editing ? 'حفظ' : 'إنشاء كمسودة'}
          </Button>
        </Drawer.Footer>
      </Drawer>

      <SoftDeleteDialog
        open={pendingDelete !== null}
        entityNoun="هذا الإشعار"
        entityLabel={pendingDelete?.titleAr ?? ''}
        onClose={() => setPendingDelete(null)}
        onConfirm={async (reason) => {
          if (!pendingDelete) return;
          await deleteMut.mutateAsync({ id: pendingDelete.id, reason });
          toast('تم الحذف', 'success');
        }}
      />
    </CenteredShell>
  );
}
