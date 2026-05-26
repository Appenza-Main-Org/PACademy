/**
 * CycleDetailPage — read-only summary of one admission cycle.
 *
 * Mirrors the visible field set of `/admin/cycles/new` (CycleNewPage):
 * اسم الدورة. Status sits alongside as a Badge in the header.
 * Editing happens from the cycles list (CyclesPage) which routes to
 * the dedicated edit page.
 */

import { useParams } from 'react-router-dom';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ROUTES } from '@/config/routes';
import { useCycle } from '../api/cycles.queries';
import type { CycleStatus } from '@/shared/types/domain';

const STATUS_LABEL: Record<CycleStatus, string> = {
  draft: 'مسودة',
  open: 'مفتوحة',
  active: 'نشطة',
  extended: 'ممدّدة',
  closed: 'مغلقة',
  processing: 'تحت المعالجة',
  finalized: 'مختومة',
  archived: 'مؤرشفة',
};

const STATUS_TONE: Record<CycleStatus, 'success' | 'danger' | 'neutral' | 'info'> = {
  draft: 'neutral',
  open: 'success',
  active: 'success',
  extended: 'info',
  closed: 'danger',
  processing: 'info',
  finalized: 'neutral',
  archived: 'neutral',
};

export function CycleDetailPage(): JSX.Element {
  const { id = '' } = useParams<{ id: string }>();
  const { data: cycle, isLoading, error, refetch } = useCycle(id);

  if (isLoading) {
    return (
      <CenteredShell>
        <LoadingState variant="page" />
      </CenteredShell>
    );
  }
  if (error) {
    return (
      <CenteredShell>
        <ErrorState error={error} onRetry={() => refetch()} />
      </CenteredShell>
    );
  }
  if (!cycle) {
    return (
      <CenteredShell>
        <EmptyState variant="generic" title="الدورة غير موجودة" />
      </CenteredShell>
    );
  }

  return (
    <CenteredShell>
      <PageHeader
        title={
          <span className="inline-flex items-center gap-3">
            {cycle.nameAr}
            <Badge tone={STATUS_TONE[cycle.status]}>{STATUS_LABEL[cycle.status]}</Badge>
          </span>
        }
        breadcrumbs={[
          { label: 'إدارة المنظومة', href: ROUTES.admin.dashboard },
          { label: 'الدورات', href: ROUTES.admin.cycles },
          { label: cycle.nameAr },
        ]}
      />

      <Card>
        <div className="flex flex-col gap-1">
          <span className="text-2xs uppercase tracking-wide text-ink-500">
            اسم الدورة
          </span>
          <span className="text-sm text-ink-900">{cycle.nameAr}</span>
        </div>
      </Card>
    </CenteredShell>
  );
}
