/**
 * CommitteeListPage — table of all committees with link to detail.
 *
 * Per row: link to overview, head, members/applicants/completed counts,
 * progress badge, and a delete action backed by SoftDeleteDialog
 * (matches the admin/categories list pattern). Creation is no longer
 * inline — committees are added through the admission-setup wizard
 * step at /admin/admission-setup/committees so the visual chrome on
 * this page stays focused on browse + manage.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RotateCcw, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  PageHeader,
  SoftDeleteDialog,
  toast,
} from '@/shared/components';
import type { DataTableColumn } from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ROUTES } from '@/config/routes';
import { num } from '@/shared/lib/format';
import { useAuthStore } from '@/features/auth';
import {
  useCommittees,
  useCommitteeDependencies,
  useCommitteeRestore,
  useCommitteeSoftDelete,
} from '../api/committee.queries';
import type { Committee } from '@/shared/types/domain';

const DEP_LABELS: Record<string, string> = {
  applicants: 'متقدم',
  results: 'نتيجة لجنة',
};

export function CommitteeListPage(): JSX.Element {
  const userRole = useAuthStore((s) => s.user?.role);
  const isSuperAdmin = userRole === 'super_admin';
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const { data, isLoading } = useCommittees({
    includeDeleted: isSuperAdmin && includeDeleted,
  });
  const softDeleteMut = useCommitteeSoftDelete();
  const restoreMut = useCommitteeRestore();
  const [pendingDelete, setPendingDelete] = useState<Committee | null>(null);
  const dependenciesQuery = useCommitteeDependencies(pendingDelete?.id ?? null);

  const onRestore = (c: Committee): void => {
    restoreMut.mutate(c.id, {
      onSuccess: () => toast(`تم استعادة "${c.name}"`, 'success'),
      onError: (err) => toast((err as Error).message, 'danger'),
    });
  };

  const columns: DataTableColumn<Committee>[] = [
    {
      key: 'name',
      label: 'اللجنة',
      render: (c) => (
        <Link to={`${ROUTES.committee.overview}/${c.id}`} className="font-medium text-gold-700 hover:underline">
          {c.name}
        </Link>
      ),
    },
    { key: 'head', label: 'رئيس اللجنة', render: (c) => c.head },
    { key: 'members', label: 'الأعضاء', numeric: true, render: (c) => num(c.members) },
    { key: 'applicants', label: 'المتقدمون', numeric: true, render: (c) => num(c.applicants) },
    { key: 'completed', label: 'مُنجَز', numeric: true, render: (c) => num(c.completed) },
    {
      key: 'progress',
      label: 'الإنجاز',
      render: (c) => {
        const pct = Math.round((c.completed / Math.max(1, c.applicants)) * 100);
        const tone = pct >= 70 ? 'success' : pct >= 40 ? 'warning' : 'danger';
        return <Badge tone={tone}>{pct}%</Badge>;
      },
    },
    {
      key: '_actions',
      label: <span className="sr-only">إجراءات</span>,
      align: 'end',
      render: (c) => {
        const deleted = Boolean(c.deletedAt);
        return (
          <div className="flex items-center justify-end gap-1">
            {deleted && <Badge tone="warning">محذوف</Badge>}
            {!deleted && (
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<Trash2 size={12} strokeWidth={1.75} />}
                onClick={() => setPendingDelete(c)}
              >
                حذف
              </Button>
            )}
            {isSuperAdmin && deleted && (
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<RotateCcw size={12} strokeWidth={1.75} />}
                onClick={() => onRestore(c)}
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
    <CenteredShell>
      <PageHeader
        title="قائمة اللجان"
        subtitle="عرض تفصيلي لكل لجنة وأعضائها"
        actions={
          isSuperAdmin ? (
            <label className="flex items-center gap-2 text-2xs text-ink-500">
              <input
                type="checkbox"
                checked={includeDeleted}
                onChange={(e) => setIncludeDeleted(e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-teal-500"
              />
              إظهار المحذوف
            </label>
          ) : undefined
        }
      />

      <Card>
        <DataTable
          data={data ?? []}
          columns={columns}
          rowKey={(c) => c.id}
          loading={isLoading}
          empty={<EmptyState variant="generic" title="لا توجد لجان" />}
          zebraStripes
        />
      </Card>

      <SoftDeleteDialog
        open={pendingDelete !== null}
        entityNoun="هذه اللجنة"
        entityLabel={pendingDelete?.name ?? ''}
        dependencies={dependenciesQuery.data ?? null}
        dependencyLabels={DEP_LABELS}
        onClose={() => setPendingDelete(null)}
        onConfirm={async (reason) => {
          if (!pendingDelete) return;
          try {
            await softDeleteMut.mutateAsync({ id: pendingDelete.id, reason });
            toast(`تم حذف "${pendingDelete.name}"`, 'success');
          } catch (err) {
            toast((err as Error).message, 'danger');
            throw err;
          }
        }}
      />
    </CenteredShell>
  );
}
