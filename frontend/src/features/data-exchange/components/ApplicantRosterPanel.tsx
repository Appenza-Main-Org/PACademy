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
import { ListChecks, Search, UsersRound } from 'lucide-react';
import { Badge, Button, DataTable, Input } from '@/shared/components';
import type { DataTableColumn } from '@/shared/components/DataTable';
import type { ApplicantRosterRow } from '../types';

interface ApplicantRosterPanelProps {
  roster: readonly ApplicantRosterRow[];
  loading: boolean;
  selectedNationalIds: readonly string[];
  onSelectionChange: (nationalIds: string[]) => void;
}

function committeeDisplay(row: ApplicantRosterRow): string | null {
  return row.committeeName ?? row.committeeLabelAr ?? null;
}

export function ApplicantRosterPanel({
  roster,
  loading,
  selectedNationalIds,
  onSelectionChange,
}: ApplicantRosterPanelProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

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
        (committeeDisplay(r)?.includes(needle) ?? false),
    );
  }, [roster, query]);

  const totalPages = Math.max(1, Math.ceil(filteredRoster.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredRoster.slice(start, start + pageSize);
  }, [filteredRoster, pageSize, safePage]);

  const filteredNationalIds = useMemo(() => filteredRoster.map((row) => row.nationalId), [filteredRoster]);

  function handleQueryChange(next: string): void {
    setQuery(next);
    setPage(1);
  }

  function selectFiltered(): void {
    onSelectionChange(Array.from(new Set([...selectedNationalIds, ...filteredNationalIds])));
  }

  function clearFiltered(): void {
    const filtered = new Set(filteredNationalIds);
    onSelectionChange(selectedNationalIds.filter((nationalId) => !filtered.has(nationalId)));
  }

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
      key: 'committeeName',
      label: 'اللجنة',
      render: (r) => committeeDisplay(r) ?? '—',
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
    <section className="space-y-3 rounded-lg border border-border-subtle bg-ink-50 p-4" aria-label="اختيار المتقدمين للتصدير">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <UsersRound size={18} /> اختيار المتقدمين للتصدير
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={selectedNationalIds.length === roster.length ? 'success' : 'accent'}>
            {selectedNationalIds.length.toLocaleString('en-US')} من {roster.length.toLocaleString('en-US')} محدّد
          </Badge>
          {filteredRoster.length !== roster.length && (
            <Badge tone="neutral">
              {filteredRoster.length.toLocaleString('en-US')} نتيجة بحث
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-md border border-border-subtle bg-surface-card p-3">
        <Input
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          placeholder="بحث بالاسم أو الرقم القومي أو اللجنة…"
          aria-label="بحث في قائمة المتقدمين"
          trailingIcon={<Search size={14} />}
          containerClassName="w-full sm:max-w-sm"
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={selectFiltered} disabled={filteredRoster.length === 0}>
            <ListChecks size={14} className="me-1" />
            تحديد نتائج البحث
          </Button>
          <Button variant="ghost" size="sm" onClick={clearFiltered} disabled={filteredRoster.length === 0}>
            إلغاء نتائج البحث
          </Button>
        </div>
      </div>

      <DataTable<ApplicantRosterRow>
        data={pageRows}
        columns={columns}
        rowKey={(r) => r.nationalId}
        loading={loading}
        density="compact"
        stickyHeader
        selectionMode="multi"
        selectedRowKeys={selectedNationalIds}
        onSelectionChange={(keys) => onSelectionChange(keys.map((k) => String(k)))}
        sequenceStart={(safePage - 1) * pageSize + 1}
        pagination={{
          page: safePage,
          pageSize,
          total: filteredRoster.length,
          pageSizeOptions: [10, 25, 50, 100],
          onPageChange: setPage,
          onPageSizeChange: (nextSize) => {
            setPageSize(nextSize);
            setPage(1);
          },
        }}
      />
    </section>
  );
}
