import { useMemo } from 'react';
import { useLookup } from '@/features/lookups';
import { lookupsService } from '@/features/lookups/api/lookups.service';
import type { MaritalStatusRow } from '@/features/lookups';

export interface MaritalStatusOption {
  code: string;
  name: string;
  isActive: boolean;
}

function mapMaritalStatuses(rows: readonly MaritalStatusRow[]): readonly MaritalStatusOption[] {
  return rows.map((row) => ({
    code: row.code,
    name: row.name,
    isActive: row.isActive,
  }));
}

export function useMaritalStatuses() {
  const query = useLookup('marital-statuses');
  const data = useMemo(
    () => (query.data ? mapMaritalStatuses(query.data) : undefined),
    [query.data],
  );
  return { ...query, data };
}

export async function getMaritalStatuses(): Promise<readonly MaritalStatusOption[]> {
  return mapMaritalStatuses(await lookupsService.listLookup('marital-statuses'));
}

export function maritalStatusName(
  code: string,
  options: readonly MaritalStatusOption[] = [],
): string {
  return options.find((m) => m.code === code)?.name ?? code;
}
