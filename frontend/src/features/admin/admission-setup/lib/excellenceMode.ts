/**
 * Excellence-mode resolver.
 *
 * The applicant-categories lookup carries a `معيار التمييز`
 * (excellenceCriterion) FK → `excellence-criteria` lookup. The two
 * seeded rows are `EXC-01` (تقدير) and `EXC-02` (درجة). The application-
 * settings wizard branches the «شروط اللجنة» form on this value:
 *
 *   • `TAGDIR` (تقدير) → show only الحد الأدنى / الأقصى للتقدير
 *   • `GRADES` (درجة)  → show only الحد الأدنى / الأقصى للدرجة (٪)
 *   • `null`           → criterion not picked yet → show both pairs
 *
 * Matching priority: stable seed code → Arabic name substring → null.
 * The name fallback covers admins who reseed the lookup with custom
 * codes but keep the canonical labels.
 */

import type { ExcellenceCriterionRow } from '@/features/lookups/types';

export type ExcellenceMode = 'TAGDIR' | 'GRADES';

export function deriveExcellenceMode(
  criterionCode: string | null,
  excellenceRows: readonly ExcellenceCriterionRow[],
): ExcellenceMode | null {
  if (!criterionCode) return null;
  const row = excellenceRows.find((r) => r.code === criterionCode);
  if (!row) return null;
  if (row.code === 'EXC-01') return 'TAGDIR';
  if (row.code === 'EXC-02') return 'GRADES';
  if (row.name.includes('تقدير')) return 'TAGDIR';
  if (row.name.includes('درجة')) return 'GRADES';
  return null;
}
