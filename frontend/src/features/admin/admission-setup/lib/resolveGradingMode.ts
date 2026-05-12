/**
 * Resolve the parent category's `gradingMode` for a year row.
 *
 * Walks the chain:
 *   categorySpecializationId
 *     → ApplicantCategorySpecialization.configId
 *     → ApplicantCategoryConfig.categoryId
 *     → lookup applicant-categories[code].metadata.submissionTypeCode
 *     → lookup submission-types[code].metadata.gradingMode
 *
 * Returns `null` when any step of the chain breaks (orphan ids,
 * missing lookup rows, missing FK metadata). Callers — the service
 * boundary at write time and the conflict banner at read time —
 * decide whether `null` means "skip enforcement" or "treat as
 * mismatched" based on context.
 */

import type { GradingMode } from '@/features/lookups';
import { readGradingMode } from '@/features/lookups';
import type {
  ApplicantCategoryRow,
  SubmissionTypeRow,
} from '@/features/lookups/types';
import type {
  ApplicantCategoryConfig,
  ApplicantCategorySpecialization,
} from '../types';

export interface GradingModeResolutionDeps {
  specs: readonly ApplicantCategorySpecialization[];
  configs: readonly ApplicantCategoryConfig[];
  categoryLookup: readonly ApplicantCategoryRow[];
  submissionTypeLookup: readonly SubmissionTypeRow[];
}

export function resolveGradingModeForSpec(
  categorySpecializationId: string,
  deps: GradingModeResolutionDeps,
): GradingMode | null {
  const spec = deps.specs.find((s) => s.id === categorySpecializationId);
  if (!spec) return null;
  const config = deps.configs.find((c) => c.id === spec.configId);
  if (!config) return null;
  const category = deps.categoryLookup.find((c) => c.code === config.categoryId);
  if (!category) return null;
  const md = (category.metadata ?? {}) as { submissionTypeCode?: unknown };
  if (typeof md.submissionTypeCode !== 'string') return null;
  const submissionType = deps.submissionTypeLookup.find(
    (s) => s.code === md.submissionTypeCode,
  );
  if (!submissionType) return null;
  try {
    return readGradingMode(submissionType);
  } catch {
    return null;
  }
}
