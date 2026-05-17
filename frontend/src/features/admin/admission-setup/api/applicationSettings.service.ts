/**
 * Application Settings — global master-data service (mock).
 *
 * Three-tier hierarchy: Category → Specialization → Year.
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/admin/app-settings/category-configs
 *   PATCH  /api/admin/app-settings/category-configs/:id        body: { isActive }
 *
 *   GET    /api/admin/app-settings/category-configs/:configId/specializations
 *   GET    /api/admin/app-settings/category-configs/:configId/eligible-specializations
 *           returns specialization lookup rows not yet attached to this config.
 *           When the backend ships the `category_specializations` lookup
 *           mapping (DB_CONSTRAINTS §10.7 / §11.5), this endpoint also
 *           filters by `(categoryId, specializationId) ∈ mapping`.
 *   POST   /api/admin/app-settings/category-configs/:configId/specializations
 *           body: { specializationId }
 *           → 409 SPECIALIZATION_NOT_MAPPED when the lookup mapping
 *           ships and the pair is missing.
 *   DELETE /api/admin/app-settings/specializations/:id
 *           cascade-deletes descendant years.
 *
 *   GET    /api/admin/app-settings/specializations/:csId/years
 *   POST   /api/admin/app-settings/specializations/:csId/years
 *   PATCH  /api/admin/app-settings/years/:id
 *   DELETE /api/admin/app-settings/years/:id
 *   POST   /api/admin/app-settings/bulk-save
 *
 * Conflicts (mirrored in `docs/DB_CONSTRAINTS.md §11`):
 *   - 409 DUPLICATE_YEAR
 *   - 409 OVERLAPPING_PERIOD
 *   - 409 AGE_NOT_POSITIVE
 *   - 409 AGE_REFERENCE_AFTER_START
 *   - 409 PERCENTAGE_OUT_OF_RANGE          (GRADES branch only)
 *   - 409 GRADE_MODE_MISMATCH              (parent submission-type drift)
 *   - 409 INVALID_DATE_RANGE
 *   - 409 SPECIALIZATION_NOT_MAPPED        (reserved — V1 does not enforce)
 *   - 409 CATEGORY_HAS_ACTIVE_YEARS
 *
 * The frontend mock service is the only place that writes to
 * `MOCK.applicantCategoryConfigs`, `MOCK.applicantCategorySpecializations`,
 * and `MOCK.applicantSpecializationYears`. It never writes to lookup MOCK.
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import { ConflictError } from '@/shared/lib/errors';
import { LOOKUPS_SEED } from '@/features/lookups/mock/lookups.mock';
import type {
  ApplicantCategoryGenderScope,
  ApplicantCategoryRow,
  ApplicantCategoryType,
  SpecializationRow,
  SubmissionTypeRow,
} from '@/features/lookups/types';
import {
  validateGradeKindMatchesCategory,
  validateYearRow,
  type YearRowDraft,
} from '../lib/appSettingsValidation';
import { resolveGradingModeForSpec } from '../lib/resolveGradingMode';
import { IMPLICIT_DEFAULT_SPEC_CODE } from '../mock/appSettings.mock';
import type {
  ApplicantCategoryConfig,
  ApplicantCategorySpecialization,
  ApplicantSpecializationYear,
} from '../types';

/* ─── In-memory mutable mirrors ──────────────────────────────────────── */

let configs: ApplicantCategoryConfig[] = [...MOCK.applicantCategoryConfigs];
let specs: ApplicantCategorySpecialization[] = [...MOCK.applicantCategorySpecializations];
let years: ApplicantSpecializationYear[] = [...MOCK.applicantSpecializationYears];

const CATEGORY_LOOKUP: readonly ApplicantCategoryRow[] = LOOKUPS_SEED['applicant-categories'];
const SPECIALIZATION_LOOKUP: readonly SpecializationRow[] = LOOKUPS_SEED['specializations'];
const SUBMISSION_TYPE_LOOKUP: readonly SubmissionTypeRow[] = LOOKUPS_SEED['submission-types'];

/**
 * Resolve the parent gradingMode for a year-row write. Service boundary
 * — re-reads the live in-memory `configs` / `specs` arrays so admin edits
 * to a category's submission-type are picked up without a process
 * restart.
 */
function resolveGradingModeFor(
  categorySpecializationId: string,
): ReturnType<typeof resolveGradingModeForSpec> {
  return resolveGradingModeForSpec(categorySpecializationId, {
    specs,
    configs,
    categoryLookup: CATEGORY_LOOKUP,
    submissionTypeLookup: SUBMISSION_TYPE_LOOKUP,
  });
}

function nowIso(): string {
  return new Date().toISOString();
}

function nextId(prefix: string, existing: { id: string }[]): string {
  let maxSerial = 0;
  for (const row of existing) {
    const match = row.id.match(/-(\d+)$/);
    if (match) {
      const n = Number.parseInt(match[1] ?? '0', 10);
      if (Number.isFinite(n) && n > maxSerial) maxSerial = n;
    }
  }
  return `${prefix}-${maxSerial + 1}`;
}

/* ─── Joined read shapes — service does the name-join for the mock,
 * mirroring what the real backend will return from a SQL JOIN. ───────── */

export interface CategoryConfigJoined extends ApplicantCategoryConfig {
  /** FK back to the underlying `applicant-categories` lookup row — the
   *  UI uses this to branch render logic (e.g. school-category multi-select
   *  is only shown for `officers_general`). Same value as
   *  `ApplicantCategoryConfig.categoryId`; re-exposed here so consumers
   *  can read it via a single named field at the top of the join shape. */
  categoryCode: string;
  categoryNameAr: string;
  /** Entry stage — `'university'` ("جامعي") opens the faculty +
   *  specialization picker; `'pre_university'` ("ثانوي") opens the
   *  examRound + committee + schoolCategory grid. Mirrored from the
   *  underlying `applicant-categories` lookup row. */
  categoryType: ApplicantCategoryType;
  /** Faculty FKs the category is scoped to (lookup `facultyCodes`).
   *  Empty array means "any faculty". */
  categoryFacultyCodes: readonly string[];
  /** Specialization FKs the category is scoped to (lookup
   *  `specializationCodes`). Empty array means "all specializations of
   *  the picked faculties". */
  categorySpecializationCodes: readonly string[];
  /** Gender lock derived from the lookup row's `genderScope` array.
   *  Single-entry array → that gender is locked; otherwise `null` (the
   *  category accepts both). Mirrors the rendering invariant the
   *  application-settings UI used to read off the old `'any' | 'male' |
   *  'female'` enum (per RFP §2.1). */
  lockedGender: ApplicantCategoryGenderScope | null;
  /** `true` when the category has no real specialization axis (RFP §2.1
   *  defines a per-spec axis only for `specialized_officers`). Single-axis
   *  configs render `<YearTable />` inline against the implicit-default
   *  junction; multi-axis configs render the `<SpecializationList />`. */
  singleAxis: boolean;
  /** When `singleAxis` is `true`, the id of the implicit-default
   *  `ApplicantCategorySpecialization` row that backs the year rows.
   *  `null` for multi-axis configs. */
  implicitSpecId: string | null;
  /** Total specialization rows attached to this config (regardless of active). */
  specializationCount: number;
  /** Total year rows under this config, active or otherwise. */
  yearCount: number;
}

export interface CategorySpecializationJoined extends ApplicantCategorySpecialization {
  specializationNameAr: string;
  yearCount: number;
}

export interface ParentCategorySnapshot {
  code: string;
  /** Same `lockedGender` semantics as `CategoryConfigJoined.lockedGender`:
   *  if the category's `genderScope` array contains exactly one entry,
   *  that's the locked value; otherwise `null` (no lock). */
  lockedGender: ApplicantCategoryGenderScope | null;
}

/** Derive the lock from the lookup's multi-select. Single-entry array
 *  locks to that gender; everything else (empty or both) means "no lock". */
function deriveLockedGender(
  scope: readonly ApplicantCategoryGenderScope[] | undefined,
): ApplicantCategoryGenderScope | null {
  if (!scope || scope.length !== 1) return null;
  return scope[0] ?? null;
}

function joinConfig(c: ApplicantCategoryConfig): CategoryConfigJoined {
  const cat = CATEGORY_LOOKUP.find((r) => r.code === c.categoryId);
  const childSpecs = specs.filter((s) => s.configId === c.id);
  const childSpecIds = new Set(childSpecs.map((s) => s.id));
  const yearsForConfig = years.filter((y) =>
    childSpecIds.has(y.categorySpecializationId),
  );
  const implicitSpec = childSpecs.find(
    (s) => s.specializationId === IMPLICIT_DEFAULT_SPEC_CODE,
  );
  const realSpecs = childSpecs.filter(
    (s) => s.specializationId !== IMPLICIT_DEFAULT_SPEC_CODE,
  );
  const singleAxis = Boolean(implicitSpec) && realSpecs.length === 0;
  return {
    ...c,
    categoryCode: c.categoryId,
    categoryNameAr: cat?.name ?? c.categoryId,
    categoryType: cat?.type ?? 'university',
    categoryFacultyCodes: cat?.facultyCodes ?? [],
    categorySpecializationCodes: cat?.specializationCodes ?? [],
    lockedGender: deriveLockedGender(cat?.genderScope),
    singleAxis,
    implicitSpecId: singleAxis ? (implicitSpec?.id ?? null) : null,
    /* Hide the implicit-default junction from the counter. */
    specializationCount: realSpecs.length,
    yearCount: yearsForConfig.length,
  };
}

function joinSpec(s: ApplicantCategorySpecialization): CategorySpecializationJoined {
  const spec = SPECIALIZATION_LOOKUP.find((r) => r.code === s.specializationId);
  return {
    ...s,
    specializationNameAr: spec?.name ?? s.specializationId,
    yearCount: years.filter((y) => y.categorySpecializationId === s.id).length,
  };
}

/* ─── Bulk save input shape ──────────────────────────────────────────── */

export interface BulkYearChange {
  /** `null` for newly-created rows, otherwise the existing year id. */
  id: string | null;
  /** Discriminator — describes what the change is. */
  kind: 'create' | 'update' | 'delete';
  categorySpecializationId: string;
  row?: YearRowDraft;
}

export interface BulkSaveResult {
  created: number;
  updated: number;
  deleted: number;
}

/* ─── Application-settings summary (review surfaces) ──────────────────
 *
 * The review surfaces (the pre-review step and the final review step) need
 * the whole tree at once — every active category, every attached
 * specialization, every year row. Rules-of-hooks rules out a per-spec
 * `useYears` fan-out, and we don't want the consumer juggling N parallel
 * queries. The service therefore exposes a single joined snapshot keyed
 * off the live in-memory mirrors. The shape mirrors what the UI renders:
 * a list of category cards, each carrying its specialization buckets, each
 * carrying its year rows. The resolved `gradingMode` is included so the
 * consumer can label the grade column without re-walking the chain.
 *
 * Implicit-junction (`singleAxis`) categories surface a single bucket with
 * `nameAr: null` — the consumer renders the year table directly under the
 * category header instead of a redundant specialization sub-header. */
export interface YearGroupForReview {
  /** `ApplicantCategorySpecialization.id` — useful for keying / debugging
   *  even though the review UI doesn't drill in. */
  csId: string;
  /** Specialization name for multi-axis configs; `null` for the implicit
   *  junction of a singleAxis category. */
  nameAr: string | null;
  years: ApplicantSpecializationYear[];
}

export interface CategorySettingsSummary {
  config: CategoryConfigJoined;
  /** Pre-bucketed year rows, one bucket per attached specialization
   *  junction (including the implicit one for singleAxis categories).
   *  Empty when the category has no attached specializations yet. */
  groups: YearGroupForReview[];
  /** Resolved at the service boundary so the consumer doesn't re-walk
   *  the chain. `null` when the parent metadata is missing. */
  gradingMode: ReturnType<typeof resolveGradingModeForSpec>;
}

export const applicationSettingsService = {
  /* ── Reads ───────────────────────────────────────────────────────── */

  async listCategoryConfigs(): Promise<CategoryConfigJoined[]> {
    await simulateLatency(80, 160);
    return [...configs]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(joinConfig);
  },

  async listSpecializationsForConfig(
    configId: string,
  ): Promise<CategorySpecializationJoined[]> {
    await simulateLatency(60, 120);
    /* Hide the implicit-default junction — it has no user-facing
     * specialization to render in the SpecializationList. The
     * CategoryAccordion already branches on `config.singleAxis` and
     * renders YearTable inline for these categories. */
    return specs
      .filter(
        (s) =>
          s.configId === configId &&
          s.specializationId !== IMPLICIT_DEFAULT_SPEC_CODE,
      )
      .map(joinSpec);
  },

  /**
   * Returns the specialization lookup rows that are eligible to attach
   * to this config. V1: returns every lookup row not already attached
   * (no category-specialization mapping exists yet — see
   * DB_CONSTRAINTS §10.7 / §11.5). Forward-compatible: the day the
   * lookup mapping ships, this method filters by
   * `(categoryId, specializationCode) ∈ mapping`.
   */
  async getEligibleSpecializations(
    configId: string,
  ): Promise<SpecializationRow[]> {
    await simulateLatency(60, 120);
    const config = configs.find((c) => c.id === configId);
    if (!config) return [];
    const attached = new Set(
      specs.filter((s) => s.configId === configId).map((s) => s.specializationId),
    );
    return SPECIALIZATION_LOOKUP
      .filter((s) => s.isActive && !attached.has(s.code));
  },

  async listYears(
    categorySpecializationId: string,
  ): Promise<ApplicantSpecializationYear[]> {
    await simulateLatency(60, 120);
    function maxYear(y: ApplicantSpecializationYear): number {
      return y.graduationYears.length > 0 ? Math.max(...y.graduationYears) : 0;
    }
    return years
      .filter((y) => y.categorySpecializationId === categorySpecializationId)
      .sort((a, b) => maxYear(b) - maxYear(a));
  },

  /**
   * Joined snapshot of the entire application-settings tree — one shot
   * across configs → specializations → year rows, with the resolved
   * parent gradingMode stamped on each category. Drives the read-only
   * review surfaces; not used by editing flows (those continue to fetch
   * per-spec for cache-key granularity).
   */
  async getApplicationSettingsSummary(): Promise<CategorySettingsSummary[]> {
    await simulateLatency(80, 160);
    function maxYear(y: ApplicantSpecializationYear): number {
      return y.graduationYears.length > 0 ? Math.max(...y.graduationYears) : 0;
    }
    return [...configs]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(joinConfig)
      .map((cfg): CategorySettingsSummary => {
        const childSpecs = specs.filter((s) => s.configId === cfg.id);
        /* gradingMode is constant across a category's specializations
         * (resolved off the parent category lookup row), so the first
         * attached junction is enough to read it. Falls back to null
         * when the category has no attachments yet. */
        const gradingMode = childSpecs[0]
          ? resolveGradingModeFor(childSpecs[0].id)
          : null;
        const groups: YearGroupForReview[] = childSpecs.map((s) => {
          const isImplicit = s.specializationId === IMPLICIT_DEFAULT_SPEC_CODE;
          const specRow = isImplicit
            ? null
            : SPECIALIZATION_LOOKUP.find((r) => r.code === s.specializationId);
          return {
            csId: s.id,
            nameAr: isImplicit ? null : (specRow?.name ?? s.specializationId),
            years: years
              .filter((y) => y.categorySpecializationId === s.id)
              .sort((a, b) => maxYear(b) - maxYear(a)),
          };
        });
        return { config: cfg, groups, gradingMode };
      });
  },

  /**
   * Resolve the parent category's gradingMode for one specialization
   * junction. Returns `null` when any step of the chain breaks (orphan
   * ids, missing FK metadata). The YearTable consumes this through
   * `useResolvedGradingModeForSpec` to steer column 5 between the
   * GRADES (`minPercentage`) and TAGDIR (`academicGradeId`) branches.
   */
  async getGradingModeForSpec(
    categorySpecializationId: string,
  ): Promise<ReturnType<typeof resolveGradingModeForSpec>> {
    await simulateLatency(40, 80);
    return resolveGradingModeFor(categorySpecializationId);
  },

  /**
   * Resolve the parent category metadata for one specialization junction.
   * Returns `null` when the chain breaks. The YearTable consumes this
   * to honor the `genderScope` lock (per RFP §2.1, `officers_general`
   * is male-only and `physical_education_bachelor` is female-only) and
   * to decide whether to render the `schoolCategoryCodes` multi-select
   * (only for `officers_general`).
   */
  async getParentCategoryForSpec(
    categorySpecializationId: string,
  ): Promise<ParentCategorySnapshot | null> {
    await simulateLatency(40, 80);
    const spec = specs.find((s) => s.id === categorySpecializationId);
    if (!spec) return null;
    const config = configs.find((c) => c.id === spec.configId);
    if (!config) return null;
    const cat = CATEGORY_LOOKUP.find((r) => r.code === config.categoryId);
    if (!cat) return null;
    return {
      code: cat.code,
      lockedGender: deriveLockedGender(cat.genderScope),
    };
  },

  /* ── Mutations ───────────────────────────────────────────────────── */

  async attachSpecialization(
    configId: string,
    specializationId: string,
  ): Promise<ApplicantCategorySpecialization> {
    await simulateLatency();
    const config = configs.find((c) => c.id === configId);
    if (!config) throw new Error(`Config ${configId} not found`);
    if (!SPECIALIZATION_LOOKUP.some((s) => s.code === specializationId)) {
      throw new ConflictError('SPECIALIZATION_NOT_MAPPED', {
        categoryId: config.categoryId,
        specializationId,
      });
    }
    // V1: no category-specialization mapping enforcement (see file
    // header). When the backend ships it, re-introduce a check here.
    const existing = specs.find(
      (s) => s.configId === configId && s.specializationId === specializationId,
    );
    if (existing) return existing;
    const row: ApplicantCategorySpecialization = {
      id: nextId('acs', specs),
      configId,
      specializationId,
      isActive: true,
    };
    specs = [...specs, row];
    return row;
  },

  async detachSpecialization(
    categorySpecializationId: string,
  ): Promise<void> {
    await simulateLatency();
    years = years.filter(
      (y) => y.categorySpecializationId !== categorySpecializationId,
    );
    specs = specs.filter((s) => s.id !== categorySpecializationId);
  },

  async createYear(
    input: YearRowDraft,
  ): Promise<ApplicantSpecializationYear> {
    await simulateLatency();
    const parentMode = resolveGradingModeFor(input.categorySpecializationId);
    if (parentMode) {
      const mismatch = validateGradeKindMatchesCategory(input, parentMode);
      if (mismatch) throw new ConflictError(mismatch, input);
    }
    const siblings = years.filter(
      (y) => y.categorySpecializationId === input.categorySpecializationId,
    );
    const conflict = validateYearRow(input, siblings);
    if (conflict) throw new ConflictError(conflict, input);
    const row = {
      ...input,
      id: nextId('asy', years),
    } as ApplicantSpecializationYear;
    years = [...years, row];
    return row;
  },

  async updateYear(
    id: string,
    patch: Partial<ApplicantSpecializationYear>,
  ): Promise<ApplicantSpecializationYear> {
    await simulateLatency();
    const current = years.find((y) => y.id === id);
    if (!current) throw new Error(`Year ${id} not found`);
    const next = { ...current, ...patch } as ApplicantSpecializationYear;
    const parentMode = resolveGradingModeFor(next.categorySpecializationId);
    if (parentMode) {
      const mismatch = validateGradeKindMatchesCategory(next, parentMode);
      if (mismatch) throw new ConflictError(mismatch, next);
    }
    const siblings = years.filter(
      (y) => y.categorySpecializationId === next.categorySpecializationId,
    );
    const conflict = validateYearRow(next, siblings, id);
    if (conflict) throw new ConflictError(conflict, next);
    years = years.map((y) => (y.id === id ? next : y));
    return next;
  },

  async deleteYear(id: string): Promise<void> {
    await simulateLatency();
    years = years.filter((y) => y.id !== id);
  },

  async toggleYearActive(id: string): Promise<ApplicantSpecializationYear> {
    await simulateLatency();
    const current = years.find((y) => y.id === id);
    if (!current) throw new Error(`Year ${id} not found`);
    const next = {
      ...current,
      isActive: !current.isActive,
    } as ApplicantSpecializationYear;
    years = years.map((y) => (y.id === id ? next : y));
    return next;
  },

  async toggleCategoryActive(
    configId: string,
  ): Promise<ApplicantCategoryConfig> {
    await simulateLatency();
    const current = configs.find((c) => c.id === configId);
    if (!current) throw new Error(`Config ${configId} not found`);
    const nextActive = !current.isActive;
    if (!nextActive) {
      const childSpecIds = new Set(
        specs.filter((s) => s.configId === configId).map((s) => s.id),
      );
      const hasActiveYears = years.some(
        (y) => childSpecIds.has(y.categorySpecializationId) && y.isActive,
      );
      if (hasActiveYears) {
        throw new ConflictError('CATEGORY_HAS_ACTIVE_YEARS', { configId });
      }
    }
    const next: ApplicantCategoryConfig = {
      ...current,
      isActive: nextActive,
      updatedAt: nowIso(),
    };
    configs = configs.map((c) => (c.id === configId ? next : c));
    return next;
  },

  /**
   * Atomic bulk save: validates every change against a hypothetical
   * post-state, then persists only if all validations pass. Mirrors the
   * eventual `POST /bulk-save` semantics.
   */
  async bulkSave(payload: BulkYearChange[]): Promise<BulkSaveResult> {
    await simulateLatency();
    // Group changes per categorySpecializationId so we validate each
    // sibling-set as a single hypothetical post-state.
    const byCs = new Map<string, BulkYearChange[]>();
    for (const change of payload) {
      const arr = byCs.get(change.categorySpecializationId) ?? [];
      arr.push(change);
      byCs.set(change.categorySpecializationId, arr);
    }

    for (const [csId, changes] of byCs) {
      let hypothetical = years.filter((y) => y.categorySpecializationId === csId);
      const tempIdSeed = Date.now();
      let tempCounter = 0;
      const applied: Array<{ change: BulkYearChange; hypotheticalId: string }> = [];
      for (const change of changes) {
        if (change.kind === 'delete') {
          if (!change.id) throw new Error('delete change missing id');
          hypothetical = hypothetical.filter((y) => y.id !== change.id);
          applied.push({ change, hypotheticalId: change.id });
        } else if (change.kind === 'update') {
          if (!change.id) throw new Error('update change missing id');
          if (!change.row) throw new Error('update change missing row');
          hypothetical = hypothetical.map((y) =>
            y.id === change.id ? ({ ...y, ...change.row } as ApplicantSpecializationYear) : y,
          );
          applied.push({ change, hypotheticalId: change.id });
        } else {
          if (!change.row) throw new Error('create change missing row');
          const tempId = `__pending-${tempIdSeed}-${tempCounter++}`;
          hypothetical = [
            ...hypothetical,
            { ...change.row, id: tempId } as ApplicantSpecializationYear,
          ];
          applied.push({ change, hypotheticalId: tempId });
        }
      }
      /* Validate every non-delete row against its post-state siblings,
       * including the GRADE_MODE_MISMATCH check against the resolved
       * parent gradingMode. Atomicity guarantee: if any row fails, no
       * row in the payload gets persisted. */
      const parentMode = resolveGradingModeFor(csId);
      for (const { change, hypotheticalId } of applied) {
        if (change.kind === 'delete') continue;
        const row = hypothetical.find((y) => y.id === hypotheticalId);
        if (!row) continue;
        if (parentMode) {
          const mismatch = validateGradeKindMatchesCategory(row, parentMode);
          if (mismatch) throw new ConflictError(mismatch, row);
        }
        const siblings = hypothetical.filter((y) => y.id !== hypotheticalId);
        const conflict = validateYearRow(row, siblings, undefined);
        if (conflict) throw new ConflictError(conflict, row);
      }
    }

    // All validations passed — persist.
    let created = 0;
    let updated = 0;
    let deleted = 0;
    let working = [...years];
    for (const change of payload) {
      if (change.kind === 'delete') {
        if (!change.id) continue;
        const before = working.length;
        working = working.filter((y) => y.id !== change.id);
        if (working.length !== before) deleted += 1;
      } else if (change.kind === 'update') {
        if (!change.id || !change.row) continue;
        working = working.map((y) =>
          y.id === change.id ? ({ ...y, ...change.row } as ApplicantSpecializationYear) : y,
        );
        updated += 1;
      } else {
        if (!change.row) continue;
        const row = {
          ...change.row,
          id: nextId('asy', working),
        } as ApplicantSpecializationYear;
        working = [...working, row];
        created += 1;
      }
    }
    years = working;
    return { created, updated, deleted };
  },
};

export type ApplicationSettingsService = typeof applicationSettingsService;
