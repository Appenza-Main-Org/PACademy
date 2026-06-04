/**
 * ApplicantRosterPanel — selectable list of booked applicants driving the
 * Data Exchange applicants export. Built on the shared `DataTable` with
 * `selectionMode="multi"`. Defaults to all rows selected; admin trims via
 * row checkboxes or the global select-all header.
 *
 * The selection is hoisted to the parent (DataExchangePage) which forwards
 * it as `nationalIds` to the export mutation. National ID is both the
 * identity column and the re-import match key, so it doubles as `rowKey`.
 */

import { useEffect, useMemo, useState } from 'react';
import { Search, UsersRound } from 'lucide-react';
import { Badge, Card, CardBody, CardHeader, DataTable, Input } from '@/shared/components';
import type { DataTableColumn } from '@/shared/components/DataTable';
import type { ApplicantRosterRow } from '../types';

interface ApplicantRosterPanelProps {
  roster: readonly ApplicantRosterRow[];
  loading: boolean;
  selectedNationalIds: readonly string[];
  onSelectionChange: (nationalIds: string[]) => void;
}

export function ApplicantRosterPanel({
  roster,
  loading,
  selectedNationalIds,
  onSelectionChange,
}: ApplicantRosterPanelProps): JSX.Element {
  const [query, setQuery] = useState('');

  /* First-load default: select every row in the gated roster. Subsequent
   * roster reloads (e.g. background refetch) honor the admin's narrowed
   * selection — we only auto-fill the empty selection state. */
  useEffect(() => {
    if (selectedNationalIds.length === 0 && roster.length > 0) {
      onSelectionChange(roster.map((r) => r.nationalId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster.length]);

  const filteredRoster = useMemo(() => {
    const needle = query.trim();
    if (!needle) return roster;
    return roster.filter(
      (r) =>
        r.nationalId.includes(needle) ||
        (r.fullName?.includes(needle) ?? false) ||
        (r.examSlotLocation?.includes(needle) ?? false),
    );
  }, [roster, query]);

  const columns: DataTableColumn<ApplicantRosterRow>[] = [
    {
      key: 'nationalId',
      label: 'الرقم القومي',
      width: 160,
      render: (r) => (
        <span dir="ltr" className="font-mono text-2xs text-ink-700">
          {r.nationalId}
        </span>
      ),
    },
    { key: 'fullName', label: 'الاسم', render: (r) => r.fullName ?? '—' },
    {
      key: 'examSlotDate',
      label: 'موعد الاختبار',
      width: 140,
      render: (r) =>
        r.examSlotDate ? (
          <span dir="ltr" className="font-mono text-2xs text-ink-700">
            {r.examSlotDate}
            {r.examSlotTime ? ` · ${r.examSlotTime}` : ''}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'examSlotLocation',
      label: 'اللجنة',
      render: (r) => r.examSlotLocation ?? '—',
      hideOn: 'md',
    },
    {
      key: 'status',
      label: 'الحالة',
      width: 140,
      render: (r) => (r.status ? <Badge tone="info">{r.status}</Badge> : '—'),
      hideOn: 'sm',
    },
  ];

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <UsersRound size={18} /> اختيار المتقدمين للتصدير
          </span>
        }
        subtitle="حدّد المتقدمين الذين سيُدرَجون في ملف Excel. الافتراضي هو تصدير كل المحجوزين."
        actions={
          <Badge tone={selectedNationalIds.length === roster.length ? 'success' : 'accent'}>
            {selectedNationalIds.length} من {roster.length} محدّد
          </Badge>
        }
      />
      <CardBody className="space-y-3">
        <div className="relative max-w-xs">
          <Search
            size={14}
            className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink-400 end-3"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="بحث بالاسم أو الرقم القومي أو اللجنة…"
            className="pe-9"
            aria-label="بحث في قائمة المتقدمين"
          />
        </div>

        <DataTable<ApplicantRosterRow>
          data={filteredRoster}
          columns={columns}
          rowKey={(r) => r.nationalId}
          loading={loading}
          density="compact"
          stickyHeader
          selectionMode="multi"
          selectedRowKeys={selectedNationalIds}
          onSelectionChange={(keys) => onSelectionChange(keys.map((k) => String(k)))}
        />
      </CardBody>
    </Card>
  );
}
