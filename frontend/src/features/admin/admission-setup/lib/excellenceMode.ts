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
 *   • `null`           → no criterion or multiple criteria → show both pairs
 *
 * Matching priority: stable seed code → Arabic name substring → null.
 * The name fallback covers admins who reseed the lookup with custom
 * codes but keep the canonical labels.
 */

import type { ExcellenceCriterionRow } from '@/features/lookups/types';
import { normalizeExcellenceCriteria } from '@/features/lookups';

export type ExcellenceMode = 'TAGDIR' | 'GRADES';

export function deriveExcellenceMode(
  criterionValue: readonly string[] | string | null,
  excellenceRows: readonly ExcellenceCriterionRow[],
): ExcellenceMode | null {
  const criteria = normalizeExcellenceCriteria(criterionValue);
  if (criteria.length !== 1) return null;
  const selectedCriterionCode = criteria[0];
  const row = excellenceRows.find((r) => r.code === selectedCriterionCode);
  if (!row) return null;
  if (row.code === 'EXC-01') return 'TAGDIR';
  if (row.code === 'EXC-02') return 'GRADES';
  if (row.name.includes('تقدير')) return 'TAGDIR';
  if (row.name.includes('درجة')) return 'GRADES';
  return null;
}
