/**
 * Application-settings completion for the admission-setup wizard.
 *
 * The step is complete only when every active applicant category has
 * authored rows that satisfy the existing per-category required-field
 * checks from the application-settings workspace.
 */

import type { ApplicantCategoryRow, ApplicantCategoryType } from '@/features/lookups';
import type { CategoryConfigJoined } from '../api/applicationSettings.service';
import {
  selectCategoryCompletion,
  type CategoryCompletionState,
  type LocalGeneralRuleRow,
} from '../store/wizardSharedState';
import type { AdmissionSetupStepStatus } from '../types';

interface CompletionConfig {
  categoryCode: string;
  categoryType: ApplicantCategoryType;
  categorySpecializationCodes: readonly string[];
}

function normalizeType(
  value: unknown,
  category?: Pick<ApplicantCategoryRow, 'type'>,
): ApplicantCategoryType {
  if (value === 'pre_university' || value === 'ثانوي') return 'pre_university';
  if (value === 'university' || value === 'جامعي') return 'university';
  return category?.type ?? 'university';
}

function visibleCompletionConfigs(
  configs: readonly Pick<
    CategoryConfigJoined,
    'categoryCode' | 'categoryType' | 'categorySpecializationCodes'
  >[],
  categories: readonly ApplicantCategoryRow[],
): CompletionConfig[] {
  const activeCategories = categories.filter((category) => category.isActive);
  const configByCode = new Map(configs.map((config) => [config.categoryCode, config] as const));

  return activeCategories.map((category) => {
    const config = configByCode.get(category.code);
    return {
      categoryCode: category.code,
      categoryType: normalizeType(config?.categoryType, category),
      categorySpecializationCodes:
        config?.categorySpecializationCodes ?? category.specializationCodes,
    };
  });
}

function toStepStatus(states: readonly CategoryCompletionState[]): AdmissionSetupStepStatus {
  if (states.length === 0) return 'not_started';
  if (states.every((state) => state === 'complete')) return 'complete';
  if (states.some((state) => state === 'complete' || state === 'partial')) {
    return 'in_progress';
  }
  return 'not_started';
}

export function computeApplicationSettingsStatus(
  configs: readonly Pick<
    CategoryConfigJoined,
    'categoryCode' | 'categoryType' | 'categorySpecializationCodes'
  >[],
  categories: readonly ApplicantCategoryRow[],
  authoredRows: readonly LocalGeneralRuleRow[],
): AdmissionSetupStepStatus {
  const states = visibleCompletionConfigs(configs, categories).map((config) =>
    selectCategoryCompletion(
      config.categoryCode,
      config.categoryType,
      authoredRows,
      config.categorySpecializationCodes,
    ),
  );
  return toStepStatus(states);
}
