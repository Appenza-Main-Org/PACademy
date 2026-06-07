/**
 * Applicant categories — Public API Contract (Bucket B2).
 *
 * INTEGRATION CONTRACT (served by the admin API — the applicant service
 * does not expose these public reads, and the deployed applicant-*-api
 * hosts are not serving; everything resolves on the admin API):
 *   GET    /api/admin/categories                     → ApplicantCategory[] (nomination-only filtered out)
 *   GET    /api/cycles/active                         → AdmissionCycle (the single active cycle, or null)
 *   GET    /api/cycles/:id                            → AdmissionCycle (explicit applicant cycle context)
 *   GET    /api/admin/app-settings/cycle-drafts/:id   → configured application period fallback
 *   POST   /api/applicant/eligibility                → EligibilityResult (body carries cycleId)
 *
 * The list endpoint computes each category's `isOpen` from the chosen
 * cycle's openCategories map plus the [opensAt, closesAt] window. When
 * `cycleId` is omitted the first active cycle is used (legacy single-cycle
 * behaviour). Eligibility check applies the cycle's conditionOverrides on
 * top of the category's defaults (override field replaces, missing fields
 * fall through).
 */

import { MOCK } from '@/shared/mock-data';
import { adminApiClient, applicantApiClient, isBackendEnabled } from '@/shared/lib/api-client';
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
  cycleId?: string;
}

export interface ApplicantEligibleCategoriesResponse {
  nationalId: string;
  derived: {
    birthDate: string;
    age: number;
    gender: string;
    governorate: string;
  };
  grade: Record<string, unknown> | null;
  cycleId: string;
  categories: ApplicantCategoryEligibility[];
}

export interface ApplicantCategoryEligibility {
  categoryId: string;
  categoryName: string;
  eligible: boolean;
  applicationStartDate: string | null;
  applicationEndDate: string | null;
  ageReferenceDate: string | null;
  maxAge: number | null;
  checks: {
    ageCheck: { passed: boolean; applicantAge: number; maxAge: number | null; minAge?: number | null };
    genderCheck: { passed: boolean; applicantGender: string; allowedGender: string[] };
    stageCheck: { passed: boolean; requiredStage: string | null; applicantStage: string | null };
    gradesCheck: {
      passed: boolean;
      hasGrade: boolean;
      schoolCategory: string | null;
      matchedLookup: Record<string, unknown>[];
      source: string | null;
    };
  };
  committees: Array<{
    committeeId: string;
    committeeName: string;
    reason: string;
    examDates: string[];
    examSlots: Array<{
      id: string;
      date: string;
      capacity: number;
      reserved: number;
    }>;
  }>;
  academicPrograms: Array<{
    facultyCode: string;
    facultyName: string;
    specializationCode: string;
    specializationName: string;
    reason: string;
  }>;
  allowedMaritalStatusCodes?: string[];
  allowedAcademicDegreeCodes?: string[];
  allowedAcademicGradeCodes?: string[];
  /** Set of graduation years configured in the active admission cycle's
   *  rules that matched this applicant. The applicant portal uses this to
   *  constrain the graduation-year inputs on `/applicant/profile` so the
   *  applicant cannot submit a year outside the cycle's eligibility window. */
  allowedGraduationYears?: number[];
  failedReasons: string[];
}

export interface ApplicantCycleApplicationPeriod {
  startDate: string;
  endDate: string;
}

interface CycleWithDirectApplicationPeriod extends AdmissionCycle {
  applicationStart?: string | null;
  applicationEnd?: string | null;
  applicationStartDate?: string | null;
  applicationEndDate?: string | null;
}

function isCycleLive(cycle: AdmissionCycle): boolean {
  /* Applicant gate (2026-05-30): a cycle accepts applications only when it is
   * approved-and-published (اعتماد ونشر → status `'open'`/`'active'`/`'extended'`).
   * A draft cycle (إدراج ومراجعة) is closed to applicants — the portal shows
   * «التقديم غير متاح في الوقت الحالي». */
  return (
    cycle.status === 'open' ||
    cycle.status === 'active' ||
    cycle.status === 'extended'
  );
}

/** All currently-active cycles, ordered earliest-closing first. */
function getActiveCycles(): AdmissionCycle[] {
  return MOCK.cycles
    .filter(isCycleLive)
    .slice()
    .sort(
      (a, b) =>
        new Date(a.closeDate).getTime() - new Date(b.closeDate).getTime(),
    );
}

function normalizeActiveCycles(
  value: AdmissionCycle | AdmissionCycle[] | null,
): AdmissionCycle[] {
  const rows = Array.isArray(value) ? value : value ? [value] : [];
  return rows
    .filter(isCycleLive)
    .slice()
    .sort(
      (a, b) =>
        new Date(a.closeDate).getTime() - new Date(b.closeDate).getTime(),
    );
}

function dateOnly(value: string | null | undefined): string | null {
  const candidate = value?.slice(0, 10);
  if (!candidate || !/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return null;
  const parsed = new Date(`${candidate}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : candidate;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeApplicationPeriods(
  periods: readonly ApplicantCycleApplicationPeriod[],
): ApplicantCycleApplicationPeriod | null {
  if (periods.length === 0) return null;
  return {
    startDate: periods.reduce(
      (min, period) => (period.startDate < min ? period.startDate : min),
      periods[0]!.startDate,
    ),
    endDate: periods.reduce(
      (max, period) => (period.endDate > max ? period.endDate : max),
      periods[0]!.endDate,
    ),
  };
}

function periodFromUnknownHeader(value: unknown): ApplicantCycleApplicationPeriod | null {
  if (!isRecord(value)) return null;
  const startDate = typeof value.applicationStart === 'string'
    ? dateOnly(value.applicationStart)
    : typeof value.applicationStartDate === 'string'
      ? dateOnly(value.applicationStartDate)
      : null;
  const endDate = typeof value.applicationEnd === 'string'
    ? dateOnly(value.applicationEnd)
    : typeof value.applicationEndDate === 'string'
      ? dateOnly(value.applicationEndDate)
      : null;
  return startDate && endDate ? { startDate, endDate } : null;
}

function resolveCycleApplicationPeriodFromDraft(
  draft: unknown,
): ApplicantCycleApplicationPeriod | null {
  if (!isRecord(draft)) return null;

  const periods: ApplicantCycleApplicationPeriod[] = [];
  if (isRecord(draft.headers)) {
    for (const header of Object.values(draft.headers)) {
      const period = periodFromUnknownHeader(header);
      if (period) periods.push(period);
    }
  }

  for (const key of ['approved', 'local'] as const) {
    const rows = draft[key];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!isRecord(row)) continue;
      const period = periodFromUnknownHeader(row.header) ?? periodFromUnknownHeader(row);
      if (period) periods.push(period);
    }
  }

  return mergeApplicationPeriods(periods);
}

export function resolveCycleApplicationPeriod(
  cycle: AdmissionCycle | null | undefined,
): ApplicantCycleApplicationPeriod | null {
  if (!cycle) return null;

  const direct = cycle as CycleWithDirectApplicationPeriod;
  const directStart = dateOnly(direct.applicationStartDate ?? direct.applicationStart);
  const directEnd = dateOnly(direct.applicationEndDate ?? direct.applicationEnd);
  if (directStart && directEnd) return { startDate: directStart, endDate: directEnd };

  const categoryPeriods = Object.values(cycle.openCategories ?? {})
    .filter((config) => Boolean(config?.isOpen))
    .map((config) => ({
      startDate: dateOnly(config?.startDate),
      endDate: dateOnly(config?.endDate),
    }))
    .filter((period): period is ApplicantCycleApplicationPeriod =>
      Boolean(period.startDate && period.endDate),
    );
  const categoryPeriod = mergeApplicationPeriods(categoryPeriods);
  if (categoryPeriod) return categoryPeriod;

  const cycleStart = dateOnly(cycle.openDate);
  const cycleEnd = dateOnly(cycle.closeDate);
  return cycleStart && cycleEnd ? { startDate: cycleStart, endDate: cycleEnd } : null;
}

/** Resolve a single cycle: explicit id (if live) → MOCK.activeCycleId →
 *  first live cycle. Returns null when nothing matches. */
function resolveCycle(cycleId?: string): AdmissionCycle | null {
  if (cycleId) {
    const explicit = MOCK.cycles.find((c) => c.id === cycleId);
    if (explicit && isCycleLive(explicit)) return explicit;
    return null;
  }
  const pinned = MOCK.activeCycleId
    ? MOCK.cycles.find((c) => c.id === MOCK.activeCycleId)
    : undefined;
  if (pinned && isCycleLive(pinned)) return pinned;
  return getActiveCycles()[0] ?? null;
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
  /** Public list — filters out nomination-only, computes isOpen from the
   *  chosen cycle (defaults to the first active cycle when omitted). */
  async list(cycleId?: string): Promise<ApplicantCategory[]> {
    if (isBackendEnabled()) {
      /* The admin API is the source of truth; it returns the
       * ApplicantCategory shape directly. Filter nomination-only rows to
       * preserve the public-list contract. */
      const categories = await adminApiClient.get<ApplicantCategory[]>('/api/admin/categories');
      return categories.filter((c) => !c.conditions.nominationOnly);
    }
    await simulateLatency();
    const cycle = resolveCycle(cycleId);
    return MOCK.categories
      .filter((c) => !c.conditions.nominationOnly)
      .map((c) => ({
        ...c,
        isOpen: cycle ? isCategoryOpenInCycle(cycle, c.key) : false,
      }));
  },

  /** All cycles currently open to applicants (active + approved & published).
   *  May be empty — drives the «التقديم غير متاح» gate. On the backend the
   *  single active cycle is exposed publicly at GET /api/cycles/active; we
   *  still re-check the gate predicate client-side so a draft/unpublished
   *  active cycle never opens the portal. */
  async getActiveCycles(): Promise<AdmissionCycle[]> {
    if (isBackendEnabled()) {
      const active = await adminApiClient
        .get<AdmissionCycle | AdmissionCycle[] | null>('/api/cycles/active')
        .catch(() => null);
      return normalizeActiveCycles(active);
    }
    await simulateLatency(80, 200);
    return getActiveCycles();
  },

  /** Explicit cycle context used by /applicant/start?cycle=... so applicant
   *  copy (including fees) reflects the configured cycle rather than a
   *  hardcoded/default active-cycle value. */
  async getCycleById(cycleId: string): Promise<AdmissionCycle | null> {
    if (!cycleId) return null;
    if (isBackendEnabled()) {
      const cycle = await adminApiClient
        .get<AdmissionCycle | null>(`/api/cycles/${encodeURIComponent(cycleId)}`)
        .catch(() => null);
      return cycle && isCycleLive(cycle) ? cycle : null;
    }
    await simulateLatency(80, 200);
    return resolveCycle(cycleId);
  },

  async getCycleApplicationPeriod(
    cycleId: string,
  ): Promise<ApplicantCycleApplicationPeriod | null> {
    if (!cycleId) return null;
    const cycle = await this.getCycleById(cycleId);

    if (isBackendEnabled()) {
      const draft = await adminApiClient
        .get<unknown>(`/api/admin/app-settings/cycle-drafts/${encodeURIComponent(cycleId)}`, {
          headers: { 'X-Cycle-Id': cycleId },
          query: { cycleId },
        })
        .catch(() => null);
      const draftPeriod = resolveCycleApplicationPeriodFromDraft(draft);
      if (draftPeriod) return draftPeriod;
    }

    return resolveCycleApplicationPeriod(cycle);
  },

  /** First cycle open to applicants (kept for legacy single-cycle consumers). */
  async getActiveCycle(): Promise<AdmissionCycle | null> {
    if (isBackendEnabled()) {
      const active = await adminApiClient
        .get<AdmissionCycle | AdmissionCycle[] | null>('/api/cycles/active')
        .catch(() => null);
      return normalizeActiveCycles(active)[0] ?? null;
    }
    await simulateLatency(80, 200);
    return resolveCycle();
  },

  async checkEligibility(input: EligibilityInput): Promise<EligibilityResult> {
    if (isBackendEnabled()) {
      return applicantApiClient.post<EligibilityResult>('/api/applicant/eligibility', input);
    }

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

    const activeCycle = resolveCycle(input.cycleId);
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

  async eligibleCategories(
    nationalId: string,
    cycleId?: string,
  ): Promise<ApplicantEligibleCategoriesResponse> {
    if (isBackendEnabled()) {
      return adminApiClient.get<ApplicantEligibleCategoriesResponse>(
        `/api/applicants/${encodeURIComponent(nationalId)}/eligible-categories`,
        { query: { cycleId, includeIneligible: true } },
      );
    }

    await simulateLatency(160, 320);
    const cycle = resolveCycle(cycleId);
    const parsed = parseNationalId(nationalId);
    const derived = {
      birthDate: parsed.birthDate?.toISOString().slice(0, 10) ?? '',
      age: parsed.birthDate
        ? Math.floor((Date.now() - parsed.birthDate.getTime()) / (365.25 * 24 * 3600 * 1000))
        : 0,
      gender: parsed.gender === 'male' ? 'ذكر' : parsed.gender === 'female' ? 'أنثى' : '',
      governorate: parsed.governorateCode ?? '',
    };
    const categories = await Promise.all(
      MOCK.categories.map(async (category) => {
        const result = await categoriesPublicService.checkEligibility({
          categoryKey: category.key,
          nid: nationalId,
          cycleId: cycle?.id,
        });
        return {
          categoryId: category.key,
          categoryName: category.labelAr,
          eligible: result.eligible,
          applicationStartDate: cycle?.openDate ?? null,
          applicationEndDate: cycle?.closeDate ?? null,
          ageReferenceDate: cycle?.openDate ?? null,
          maxAge: category.conditions.ageMax,
          checks: {
            ageCheck: {
              passed: !result.reasons.includes('age_out_of_range'),
              applicantAge: derived.age,
              maxAge: category.conditions.ageMax,
            },
            genderCheck: {
              passed: !result.reasons.includes('gender_mismatch'),
              applicantGender: derived.gender,
              allowedGender: category.conditions.gender === 'any' ? [] : [category.conditions.gender],
            },
            stageCheck: {
              passed: !result.reasons.includes('qualification_mismatch'),
              requiredStage: category.conditions.requiredQualification,
              applicantStage: null,
            },
            gradesCheck: {
              passed: !result.reasons.includes('data_not_found') && !result.reasons.includes('score_below_min'),
              hasGrade: !result.reasons.includes('data_not_found'),
              schoolCategory: null,
              matchedLookup: [],
              source: null,
            },
          },
          committees: [],
          academicPrograms: [],
          allowedMaritalStatusCodes: [],
          allowedAcademicDegreeCodes: [],
          allowedAcademicGradeCodes: [],
          allowedGraduationYears: [],
          failedReasons: result.reasons,
        };
      }),
    );

    return {
      nationalId,
      derived,
      grade: null,
      cycleId: cycle?.id ?? '',
      categories,
    };
  },
};
