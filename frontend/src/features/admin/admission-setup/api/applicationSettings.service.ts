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
  ApplicantCategoryRow,
  SpecializationRow,
  SubmissionTypeRow,
} from '@/features/lookups/types';
import {
  validateGradeKindMatchesCategory,
  validateYearRow,
  type YearRowDraft,
} from '../lib/appSettingsValidation';
import { resolveGradingModeForSpec } from '../lib/resolveGradingMode';
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
  categoryNameAr: string;
  /** Total specialization rows attached to this config (regardless of active). */
  specializationCount: number;
  /** Total year rows under this config, active or otherwise. */
  yearCount: number;
}

export interface CategorySpecializationJoined extends ApplicantCategorySpecialization {
  specializationNameAr: string;
  yearCount: number;
}

function joinConfig(c: ApplicantCategoryConfig): CategoryConfigJoined {
  const cat = CATEGORY_LOOKUP.find((r) => r.code === c.categoryId);
  const childSpecs = specs.filter((s) => s.configId === c.id);
  const childSpecIds = new Set(childSpecs.map((s) => s.id));
  const yearsForConfig = years.filter((y) =>
    childSpecIds.has(y.categorySpecializationId),
  );
  return {
    ...c,
    categoryNameAr: cat?.name ?? c.categoryId,
    specializationCount: childSpecs.length,
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
    return specs.filter((s) => s.configId === configId).map(joinSpec);
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
