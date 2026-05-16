/**
 * CommitteeApplicantsPage — full list of applicants assigned to a
 * committee. Supports specialization filter, search, and group-by-
 * specialization toggle.
 */

import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Users } from 'lucide-react';
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Select,
  StatCard,
  StatusBadge,
} from '@/shared/components';
import type { DataTableColumn } from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ROUTES } from '@/config/routes';
import { num, shortName } from '@/shared/lib/format';
import {
  useCommittee,
  useCommitteeAssignedApplicants,
  useCommitteeSpecializations,
} from '../api/committee.queries';
import type { Applicant } from '@/shared/types/domain';

export function CommitteeApplicantsPage(): JSX.Element {
  const { id = '' } = useParams<{ id: string }>();
  const { data: committee, isLoading, error, refetch } = useCommittee(id);
  const { data: applicants = [] } = useCommitteeAssignedApplicants(id);
  const { data: specializations = [] } = useCommitteeSpecializations();
  const [search, setSearch] = useState('');
  const [specFilter, setSpecFilter] = useState<string>('all');

  const committeeSpecs = useMemo(() => {
    if (!committee?.specializationIds) return [];
    return specializations.filter((s) => committee.specializationIds!.includes(s.id));
  }, [committee, specializations]);

  /* Spread the committee's specializations across applicants deterministically
   * so the page can demonstrate filtering / grouping without backend data. */
  const applicantSpecLookup = useMemo(() => {
    const map = new Map<string, string>();
    if (committeeSpecs.length === 0) return map;
    applicants.forEach((a, i) => {
      map.set(a.id, committeeSpecs[i % committeeSpecs.length].id);
    });
    return map;
  }, [applicants, committeeSpecs]);

  const filtered = useMemo(() => {
    const needle = search.trim();
    return applicants.filter((a) => {
      if (specFilter !== 'all' && applicantSpecLookup.get(a.id) !== specFilter) return false;
      if (!needle) return true;
      return a.name.includes(needle) || a.id.includes(needle) || a.nationalId.includes(needle);
    });
  }, [applicants, search, specFilter, applicantSpecLookup]);

  if (isLoading) return <CenteredShell><LoadingState variant="page" /></CenteredShell>;
  if (error) return <CenteredShell><ErrorState error={error} onRetry={() => refetch()} /></CenteredShell>;
  if (!committee) {
    return <CenteredShell><EmptyState variant="generic" title="اللجنة غير موجودة" /></CenteredShell>;
  }

  const capacity = committee.capacity ?? 0;
  const remaining = Math.max(0, capacity - committee.applicants);
  const isFull = capacity > 0 && committee.applicants >= capacity;

  const columns: DataTableColumn<Applicant>[] = [
    {
      key: 'applicant',
      label: 'المتقدم',
      render: (a) => (
        <div className="flex items-center gap-3">
          <Avatar name={a.name} size="sm" />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-ink-900">{shortName(a.name, 4)}</span>
            <span className="text-2xs text-ink-500 font-mono" dir="ltr">{a.id}</span>
          </div>
        </div>
      ),
    },
    { key: 'gov', label: 'المحافظة', render: (a) => a.governorate, hideOn: 'sm' },
    { key: 'cert', label: 'الشهادة', render: (a) => `${a.certType} · ${a.certPercent}%`, hideOn: 'sm' },
    {
      key: 'specialization',
      label: 'التخصص',
      render: (a) => {
        const specId = applicantSpecLookup.get(a.id);
        const spec = specializations.find((s) => s.id === specId);
        return spec ? <Badge tone="brand">{spec.nameAr}</Badge> : <span className="text-2xs text-ink-500">—</span>;
      },
    },
    { key: 'status', label: 'الحالة', render: (a) => <StatusBadge status={a.status} /> },
  ];

  /* Group-by-specialization summary cards */
  const grouped = committeeSpecs.map((s) => {
    const count = applicants.filter((a) => applicantSpecLookup.get(a.id) === s.id).length;
    const pct = applicants.length > 0 ? Math.round((count / applicants.length) * 100) : 0;
    return { specialization: s, count, pct };
  });

  return (
    <CenteredShell>
      <PageHeader
        title={`متقدمو لجنة ${committee.name}`}
        subtitle={`${num(committee.applicants)} متقدم مسنّد · سعة ${num(capacity)}`}
        breadcrumbs={[
          { label: 'اللجان', href: ROUTES.admin.adminLookupsType('committees') },
          { label: committee.name, href: ROUTES.committee.detail(committee.id) },
          { label: 'المتقدمون' },
        ]}
      />

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <StatCard
          label="إجمالي المسنّد"
          value={committee.applicants}
          icon={<Users size={16} strokeWidth={1.75} />}
        />
        <StatCard
          label="السعة الإجمالية"
          value={capacity}
          icon={<Users size={16} strokeWidth={1.75} />}
        />
        <StatCard
          label="المقاعد المتبقية"
          value={remaining}
          icon={<Users size={16} strokeWidth={1.75} />}
          trend={{
            label: isFull ? 'مكتمل — لا توزيع تلقائي' : `${Math.round((remaining / Math.max(1, capacity)) * 100)}% متاح`,
            tone: isFull ? 'danger' : 'success',
          }}
        />
      </div>

      {grouped.length > 0 && (
        <Card className="mt-5">
          <CardHeader title="التوزيع حسب التخصص" />
          <div className="grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-3">
            {grouped.map((g) => (
              <div
                key={g.specialization.id}
                className="rounded-md border border-border-subtle bg-surface-card p-3"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink-900">{g.specialization.nameAr}</span>
                  <Badge tone="brand">{num(g.count)}</Badge>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${g.pct}%`, background: 'var(--accent-500)' }}
                  />
                </div>
                <p className="mt-1 text-2xs text-ink-500">{g.pct}٪ من المتقدمين</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="mt-5">
        <CardHeader
          title="المتقدمون"
          subtitle={`${num(filtered.length)} من إجمالي ${num(applicants.length)}`}
        />
        <div className="grid gap-3 p-4 md:grid-cols-3">
          <Input
            label="بحث"
            placeholder="ابحث بالاسم أو الرقم القومي"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            containerClassName="md:col-span-2"
          />
          <Select
            label="التخصص"
            value={specFilter}
            onChange={(e) => setSpecFilter(e.target.value)}
            options={[
              { value: 'all', label: 'كل التخصصات' },
              ...committeeSpecs.map((s) => ({ value: s.id, label: s.nameAr })),
            ]}
          />
        </div>
        <DataTable
          data={filtered}
          columns={columns}
          rowKey={(a) => a.id}
          empty={<EmptyState variant="no-applicants-yet" />}
          zebraStripes
          density="compact"
        />
      </Card>
    </CenteredShell>
  );
}
