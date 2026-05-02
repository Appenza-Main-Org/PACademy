/**
 * CommitteeListPage — table of all committees with link to detail.
 */

import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  PageHeader,
} from '@/shared/components';
import type { DataTableColumn } from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ROUTES } from '@/config/routes';
import { num } from '@/shared/lib/format';
import { useCommittees } from '../api/committee.queries';
import type { Committee } from '@/shared/types/domain';

export function CommitteeListPage(): JSX.Element {
  const { data, isLoading } = useCommittees();

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
  ];

  return (
    <CenteredShell>
      <PageHeader
        title="قائمة اللجان"
        subtitle="عرض تفصيلي لكل لجنة وأعضائها"
        actions={
          <Link to={`${ROUTES.committee.overview}/create`}>
            <Button variant="primary" leadingIcon={<Plus size={14} strokeWidth={1.75} />}>
              لجنة جديدة
            </Button>
          </Link>
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
    </CenteredShell>
  );
}
