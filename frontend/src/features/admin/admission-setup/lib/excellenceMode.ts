/**
 * Excellence-mode resolver.
 *
 * The applicant-categories lookup carries one or more `معيار التمييز`
 * (excellenceCriterion) FKs → `excellence-criteria` lookup. The two
 * seeded rows are `EXC-01` (تقدير) and `EXC-02` (درجة). The application-
 * settings wizard branches the «شروط اللجنة» form on this selection:
 *
 *   • `TAGDIR` (تقدير) → show only الحد الأدنى / الأقصى للتقدير
 *   • `GRADES` (درجة)  → show only الحد الأدنى / الأقصى للدرجة (٪)
 *   • multiple modes   → allow the admin to switch per condition
 *   • no modes         → no criterion picked yet; callers may fall back
 *
 * Matching priority: stable seed code → Arabic name substring → null.
 * The name fallback covers admins who reseed the lookup with custom
 * codes but keep the canonical labels.
 */

import type { ExcellenceCriterionRow } from '@/features/lookups/types';
import { normalizeExcellenceCriteria } from '@/features/lookups';

export type ExcellenceMode = 'TAGDIR' | 'GRADES';

function excellenceCriterionToMode(
  criterionCode: string,
  excellenceRows: readonly ExcellenceCriterionRow[],
): ExcellenceMode | null {
  const row = excellenceRows.find((r) => r.code === criterionCode);
  if (!row) return null;
  if (row.code === 'EXC-01') return 'TAGDIR';
  if (row.code === 'EXC-02') return 'GRADES';
  if (row.name.includes('تقدير')) return 'TAGDIR';
  if (row.name.includes('درجة')) return 'GRADES';
  return null;
}

export function deriveExcellenceModes(
  criterionValue: readonly string[] | string | null,
  excellenceRows: readonly ExcellenceCriterionRow[],
): ExcellenceMode[] {
  const modes: ExcellenceMode[] = [];
  const seen = new Set<ExcellenceMode>();

  for (const criterionCode of normalizeExcellenceCriteria(criterionValue)) {
    const mode = excellenceCriterionToMode(criterionCode, excellenceRows);
    if (mode === null || seen.has(mode)) continue;
    seen.add(mode);
    modes.push(mode);
  }

  return modes;
}

export function deriveExcellenceMode(
  criterionValue: readonly string[] | string | null,
  excellenceRows: readonly ExcellenceCriterionRow[],
): ExcellenceMode | null {
  const modes = deriveExcellenceModes(criterionValue, excellenceRows);
  return modes.length === 1 ? modes[0] : null;
}
