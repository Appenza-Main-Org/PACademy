/**
 * Applicant categories — Public API Contract (Bucket B2).
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/applicant/categories                 → ApplicantCategory[] (public, nomination-only filtered out)
 *   GET    /api/applicant/cycles/active              → AdmissionCycle | null
 *   POST   /api/applicant/eligibility                → EligibilityResult
 *
 * The list endpoint computes each category's `isOpen` from the active
 * cycle's openCategories map plus the [opensAt, closesAt] window.
 * Eligibility check applies the active cycle's conditionOverrides on
 * top of the category's defaults (override field replaces, missing
 * fields fall through).
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import { parseNationalId } from '@/shared/lib/national-id';
import type {
  AdmissionCycle,
  ApplicantCategory,
  ApplicantCategoryKey,
  CategoryCondition,
  EligibilityRejectionReason,
  EligibilityResult,
} from '@/shared/types/domain';

interface EligibilityInput {
  categoryKey: ApplicantCategoryKey;
  nid: string;
}

function getActiveCycle(): AdmissionCycle | null {
  const id = MOCK.activeCycleId;
  if (!id) return null;
  const cycle = MOCK.cycles.find((c) => c.id === id);
  if (!cycle) return null;
  /* Treat `'open'` (legacy) and `'active'` as live; require status to be one
   * of those AND the time window to bracket now. */
  if (cycle.status !== 'open' && cycle.status !== 'active') return null;
  const now = Date.now();
  const open = new Date(cycle.openDate).getTime();
  const close = new Date(cycle.closeDate).getTime();
  if (now < open || now > close) return null;
  return cycle;
}

function isCategoryOpenInCycle(cycle: AdmissionCycle, key: ApplicantCategoryKey): boolean {
  const config = cycle.openCategories?.[key];
  return Boolean(config?.isOpen);
}

function applyOverrides(
  base: CategoryCondition,
  overrides: Partial<CategoryCondition> | undefined,
): CategoryCondition {
  if (!overrides) return base;
  return { ...base, ...overrides } as CategoryCondition;
}

/**
 * Deterministic synthesis of a candidate's external-system data from
 * their NID. Same NID → same synthesised score/qualification/height/marital
 * state, so the demo eligibility check is reproducible. We do not perturb
 * the global LCG seed here — we use a small NID-hash routine instead.
 */
function synthesiseFromNid(nid: string): {
  score: number;
  qualification: CategoryCondition['requiredQualification'];
  heightCm: number;
  maritalSingle: boolean;
} {
  let h = 2166136261;
  for (let i = 0; i < nid.length; i++) {
    h ^= nid.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const r1 = ((h >>> 0) % 1000) / 1000;
  const r2 = ((h * 2654435761) >>> 0) % 1000 / 1000;
  const r3 = ((h * 374761393) >>> 0) % 1000 / 1000;
  const r4 = ((h * 2246822519) >>> 0) % 1000 / 1000;
  const score = Math.round(60 + r1 * 40);
  const qualifications: CategoryCondition['requiredQualification'][] = [
    'thanaweya_amma',
    'azhar',
    'bachelor',
    'bachelor_law',
    'bachelor_engineering',
  ];
  const qualification = qualifications[Math.floor(r2 * qualifications.length)] ?? 'thanaweya_amma';
  const heightCm = Math.round(160 + r3 * 25);
  const maritalSingle = r4 < 0.85;
  return { score, qualification, heightCm, maritalSingle };
}

function qualificationMatches(
  required: CategoryCondition['requiredQualification'],
  candidate: CategoryCondition['requiredQualification'],
): boolean {
  if (required === 'any') return true;
  if (required === candidate) return true;
  /* `bachelor` is satisfied by any specialised bachelor variant. */
  if (required === 'bachelor' && candidate.startsWith('bachelor_')) return true;
  return false;
}

export const categoriesPublicService = {
  /** Public list — filters out nomination-only, computes isOpen from active cycle. */
  async list(): Promise<ApplicantCategory[]> {
    await simulateLatency();
    const activeCycle = getActiveCycle();
    return MOCK.categories
      .filter((c) => !c.conditions.nominationOnly)
      .map((c) => ({
        ...c,
        isOpen: activeCycle ? isCategoryOpenInCycle(activeCycle, c.key) : false,
      }));
  },

  /** Active cycle (or null if none, or current time is outside the window). */
  async getActiveCycle(): Promise<AdmissionCycle | null> {
    await simulateLatency(80, 200);
    return getActiveCycle();
  },

  async checkEligibility(input: EligibilityInput): Promise<EligibilityResult> {
    await simulateLatency(400, 800);
    const reasons: EligibilityRejectionReason[] = [];
    const category = MOCK.categories.find((c) => c.key === input.categoryKey);

    if (!category) {
      return {
        categoryKey: input.categoryKey,
        cycleId: null,
        eligible: false,
        reasons: ['data_not_found'],
      };
    }

    const activeCycle = getActiveCycle();
    if (!activeCycle) {
      return {
        categoryKey: input.categoryKey,
        cycleId: null,
        eligible: false,
        reasons: ['cycle_not_active'],
      };
    }

    /* Nomination-only departments don't accept public applications. */
    if (category.conditions.nominationOnly) {
      return {
        categoryKey: input.categoryKey,
        cycleId: activeCycle.id,
        eligible: false,
        reasons: ['nomination_required'],
      };
    }

    /* Application closed in the active cycle for this category. */
    if (!isCategoryOpenInCycle(activeCycle, input.categoryKey)) {
      reasons.push('application_closed');
    }

    /* Apply cycle-level overrides on top of category defaults. */
    const conditions = applyOverrides(
      category.conditions,
      activeCycle.conditionOverrides?.[input.categoryKey],
    );

    /* NID validation. */
    const parsed = parseNationalId(input.nid);
    if (!parsed.valid || !parsed.birthDate || !parsed.gender) {
      reasons.push('data_not_found');
      return {
        categoryKey: input.categoryKey,
        cycleId: activeCycle.id,
        eligible: false,
        reasons,
      };
    }

    /* Age. */
    const ageMs = Date.now() - parsed.birthDate.getTime();
    const ageYears = ageMs / (365.25 * 24 * 3600 * 1000);
    if (
      (conditions.ageMin !== null && ageYears < conditions.ageMin) ||
      (conditions.ageMax !== null && ageYears > conditions.ageMax)
    ) {
      reasons.push('age_out_of_range');
    }

    /* Gender. */
    if (conditions.gender !== 'any' && parsed.gender !== conditions.gender) {
      reasons.push('gender_mismatch');
    }

    const synth = synthesiseFromNid(input.nid);

    /* Score. */
    if (conditions.minScorePercent !== null && synth.score < conditions.minScorePercent) {
      reasons.push('score_below_min');
    }

    /* Height. */
    if (conditions.minHeightCm !== null && synth.heightCm < conditions.minHeightCm) {
      reasons.push('height_below_min');
    }

    /* Qualification. */
    if (!qualificationMatches(conditions.requiredQualification, synth.qualification)) {
      reasons.push('qualification_mismatch');
    }

    /* Marital. */
    if (conditions.maritalStatus === 'single' && !synth.maritalSingle) {
      reasons.push('marital_status_mismatch');
    }

    /* NID already used (check for an existing applicant). */
    const existing = MOCK.applicants.find((a) => a.nationalId === input.nid);
    if (existing) {
      reasons.push('nid_already_used');
    }

    return {
      categoryKey: input.categoryKey,
      cycleId: activeCycle.id,
      eligible: reasons.length === 0,
      reasons,
    };
  },
};
