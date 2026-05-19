/**
 * Committee instances seed — cycle-bound, dated assignments that pair a
 * lookup committee definition (`CMT-NN`) with a date + capacity.
 *
 * The wizard `/admin/cycles/admission-setup/wizard/committees` creates
 * these; `/admin/committees` lists and edits them. Both surfaces operate
 * on the same records.
 *
 * Seeded across the three cycles that ship with `MOCK.admissionCycles`
 * so the management screen has data on first render even before the
 * admin walks the wizard once. Deterministic — no rng calls; the seed
 * is hand-written for stable visual ordering.
 */

import { LOOKUPS_SEED } from '@/features/lookups/mock/lookups.mock';
import type { ApplicantCategoryKey, CommitteeInstance } from '@/shared/types/domain';

interface SeedSpec {
  cycleId: string;
  /** ISO yyyy-mm-dd anchor; each definition in the category seeds one
   *  instance at this anchor, then the next 5 definitions step by one
   *  day so the same cycle/category surfaces multiple dates. */
  anchorDate: string;
  capacity: number;
  /** Subset of category keys to seed for this cycle. */
  categories: ApplicantCategoryKey[];
  /** Cap on instances per category so the seed stays small. */
  maxPerCategory: number;
}

const SEEDS: SeedSpec[] = [
  {
    cycleId: 'CYC-2026-M',
    anchorDate: '2026-07-12',
    capacity: 60,
    categories: ['officers_general', 'specialized_officers', 'law_bachelor'],
    maxPerCategory: 4,
  },
  {
    cycleId: 'CYC-2025-F',
    anchorDate: '2025-09-04',
    capacity: 40,
    categories: ['officers_general', 'physical_education_bachelor'],
    maxPerCategory: 2,
  },
  {
    cycleId: 'CYC-2025-M',
    anchorDate: '2025-08-15',
    capacity: 50,
    categories: ['officers_general'],
    maxPerCategory: 3,
  },
];

function stepDate(anchorIso: string, step: number): string {
  const [y, m, d] = anchorIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, (m ?? 1) - 1, (d ?? 1) + step));
  return dt.toISOString().slice(0, 10);
}

const seededAt = new Date('2026-05-19T08:00:00.000Z').toISOString();

let serial = 1;
function nextId(): string {
  const out = `CIN-${String(serial).padStart(4, '0')}`;
  serial += 1;
  return out;
}

const out: CommitteeInstance[] = [];
const definitions = LOOKUPS_SEED['committees'];

for (const seed of SEEDS) {
  for (const categoryKey of seed.categories) {
    const matching = definitions.filter((d) => d.applicantCategoryId === categoryKey && d.isActive);
    const slice = matching.slice(0, seed.maxPerCategory);
    slice.forEach((def, idx) => {
      out.push({
        id: nextId(),
        definitionCode: def.code,
        cycleId: seed.cycleId,
        categoryKey,
        date: stepDate(seed.anchorDate, idx),
        capacity: seed.capacity,
        createdAt: seededAt,
        updatedAt: seededAt,
      });
    });
  }
}

export const COMMITTEE_INSTANCES_SEED: readonly CommitteeInstance[] = out;
