/**
 * MappingMatrix — generic 2-axis Checkbox matrix bound to one of the
 * four lookup-mapping tables.
 *
 * Rows = items of `rowsTypeCode` (e.g. APPLICANT_CATEGORIES).
 * Columns = items of `colsTypeCode` (e.g. COMMITTEES).
 * Each cell toggles a `LookupMappingPair { categoryId, targetId }` via
 * useAddMapping / useRemoveMapping with optimistic UI through
 * TanStack invalidation.
 *
 * The first column is sticky so wide tables stay readable. Row and
 * column searches are independent, both pass through normalizeArabic.
 */

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import {
  Checkbox,
  EmptyState,
  Input,
  LoadingState,
} from '@/shared/components';
import { normalizeArabic } from '@/shared/lib/arabic';
import { cn } from '@/shared/lib/cn';
import {
  useAddMapping,
  useLookupList,
  useLookupMappings,
  useRemoveMapping,
} from '../api/lookups.queries';
import type { LookupItem, LookupMappingKind, LookupTypeCode } from '../types';

export interface MappingMatrixProps {
  kind: LookupMappingKind;
  rowsTypeCode: LookupTypeCode;
  colsTypeCode: LookupTypeCode;
  rowsLabel: string;
  colsLabel: string;
}

export function MappingMatrix({
  kind,
  rowsTypeCode,
  colsTypeCode,
  rowsLabel,
  colsLabel,
}: MappingMatrixProps): JSX.Element {
  const [rowSearch, setRowSearch] = useState('');
  const [colSearch, setColSearch] = useState('');

  const rowsQuery = useLookupList({
    typeCode: rowsTypeCode,
    pageSize: 200,
    includeInactive: false,
  });
  const colsQuery = useLookupList({
    typeCode: colsTypeCode,
    pageSize: 200,
    includeInactive: false,
  });
  const mappingsQuery = useLookupMappings(kind);
  const addMut = useAddMapping();
  const removeMut = useRemoveMapping();

  const selected = useMemo(() => {
    const set = new Set<string>();
    for (const p of mappingsQuery.data ?? []) set.add(`${p.categoryId}::${p.targetId}`);
    return set;
  }, [mappingsQuery.data]);

  const filterFn = (term: string) => (item: LookupItem): boolean => {
    if (!term) return true;
    const q = normalizeArabic(term);
    return (
      normalizeArabic(item.nameAr).includes(q) || normalizeArabic(item.code).includes(q)
    );
  };

  const rows = (rowsQuery.data?.data ?? []).filter(filterFn(rowSearch));
  const cols = (colsQuery.data?.data ?? []).filter(filterFn(colSearch));

  const toggle = (row: LookupItem, col: LookupItem, isOn: boolean): void => {
    const pair = { categoryId: row.id, targetId: col.id };
    if (isOn) {
      removeMut.mutate({ kind, pair });
    } else {
      addMut.mutate({ kind, pair });
    }
  };

  if (rowsQuery.isLoading || colsQuery.isLoading || mappingsQuery.isLoading) {
    return <LoadingState variant="card-grid" />;
  }

  if (rows.length === 0 || cols.length === 0) {
    return (
      <EmptyState
        variant="generic"
        title="لا توجد بيانات لعرض المصفوفة"
        description={`أضف عناصر إلى ${rowsLabel} و${colsLabel} لتفعيل الربط.`}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Input
          label={`بحث في ${rowsLabel}`}
          leadingIcon={<Search size={16} />}
          value={rowSearch}
          onChange={(e) => setRowSearch(e.currentTarget.value)}
        />
        <Input
          label={`بحث في ${colsLabel}`}
          leadingIcon={<Search size={16} />}
          value={colSearch}
          onChange={(e) => setColSearch(e.currentTarget.value)}
        />
      </div>
      <div className="relative overflow-auto rounded-lg border border-border-subtle">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-ink-50">
            <tr>
              <th className="sticky start-0 z-10 border-b border-border-subtle bg-ink-50 px-3 py-2 text-start font-medium text-ink-900">
                {rowsLabel} \ {colsLabel}
              </th>
              {cols.map((col) => (
                <th
                  key={col.id}
                  className="border-b border-border-subtle px-3 py-2 text-center text-xs font-medium text-ink-700"
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span>{col.nameAr}</span>
                    <span className="font-mono text-2xs text-ink-500">{col.code}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr
                key={row.id}
                className={cn(rowIdx % 2 === 1 && 'bg-ink-50/40')}
              >
                <th
                  scope="row"
                  className="sticky start-0 z-10 border-b border-border-subtle bg-surface px-3 py-2 text-start font-medium text-ink-900"
                >
                  <div className="flex flex-col gap-0.5">
                    <span>{row.nameAr}</span>
                    <span className="font-mono text-2xs text-ink-500">{row.code}</span>
                  </div>
                </th>
                {cols.map((col) => {
                  const key = `${row.id}::${col.id}`;
                  const isOn = selected.has(key);
                  return (
                    <td
                      key={col.id}
                      className="border-b border-border-subtle px-3 py-2 text-center"
                    >
                      <Checkbox
                        checked={isOn}
                        onCheckedChange={() => toggle(row, col, isOn)}
                        aria-label={`${row.nameAr} × ${col.nameAr}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
