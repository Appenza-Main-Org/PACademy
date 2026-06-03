import type { ExcellenceCriterionRow } from '../types';

export function normalizeExcellenceCriteria(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  const seen = new Set<string>();
  const criteria: string[] = [];

  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const code = item.trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    criteria.push(code);
  }

  return criteria;
}

export function resolveExcellenceCriteriaLabels(
  criteria: unknown,
  excellenceRows: readonly ExcellenceCriterionRow[],
): string[] {
  const labelByCode = new Map(excellenceRows.map((row) => [row.code, row.name] as const));
  return normalizeExcellenceCriteria(criteria).map((code) => labelByCode.get(code) ?? code);
}
