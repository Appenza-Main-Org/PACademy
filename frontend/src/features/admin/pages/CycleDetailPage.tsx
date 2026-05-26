/**
 * CycleDetailPage — read-only summary of one admission cycle.
 *
 * Mirrors the visible field set of `/admin/cycles/new` (CycleNewPage):
 * اسم الدورة، حالة الدورة، والتفعيل. Status sits alongside as a Badge in the header.
 * Editing happens from the cycles list (CyclesPage) which routes to
 * the dedicated edit page.
 */

import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  IconStamp,
  LoadingState,
  PageHeader,
} from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ROUTES } from '@/config/routes';
import { useCycle } from '../api/cycles.queries';
import {
  LIST_STATUS_LABEL,
  LIST_STATUS_TONE,
  toListStatus,
} from '../components/cycles/cycleListStatus';

const ACTIVE_LABEL = 'نشطة';
const INACTIVE_LABEL = 'غير نشطة';

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

  const listStatus = toListStatus(cycle.status);
  const isActive = Boolean(cycle.isActive);

  return (
    <CenteredShell>
      <PageHeader
        title={
          <span className="inline-flex items-center gap-3">
            {cycle.nameAr}
            <Badge tone={LIST_STATUS_TONE[listStatus]}>{LIST_STATUS_LABEL[listStatus]}</Badge>
            {isActive ? (
              <Badge tone="success">
                <IconStamp width={12} height={12} className="me-1 inline-block" />
                {ACTIVE_LABEL}
              </Badge>
            ) : (
              <Badge tone="neutral">{INACTIVE_LABEL}</Badge>
            )}
          </span>
        }
        breadcrumbs={[
          { label: 'إدارة المنظومة', href: ROUTES.admin.dashboard },
          { label: 'الدورات', href: ROUTES.admin.cycles },
          { label: cycle.nameAr },
        ]}
      />

      <Card>
        <div className="grid gap-4 md:grid-cols-3">
          <DetailField label="اسم الدورة" value={cycle.nameAr} />
          <DetailField
            label="حالة الدورة"
            value={
              <Badge tone={LIST_STATUS_TONE[listStatus]}>
                {LIST_STATUS_LABEL[listStatus]}
              </Badge>
            }
          />
          <DetailField
            label="التفعيل"
            value={
              isActive ? (
                <Badge tone="success">
                  <IconStamp width={12} height={12} className="me-1 inline-block" />
                  {ACTIVE_LABEL}
                </Badge>
              ) : (
                <Badge tone="neutral">{INACTIVE_LABEL}</Badge>
              )
            }
          />
        </div>
      </Card>
    </CenteredShell>
  );
}

function DetailField({ label, value }: { label: string; value: ReactNode }): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-2xs uppercase tracking-wide text-ink-500">
        {label}
      </span>
      <span className="text-sm text-ink-900">{value}</span>
    </div>
  );
}
