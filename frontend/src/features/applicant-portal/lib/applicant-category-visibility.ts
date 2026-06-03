type ApplicantCategoryTypeValue = 'pre_university' | 'university' | string;

interface ApplicantCategoryMetadata {
  code?: string;
  key?: string;
  categoryId?: string;
  type?: ApplicantCategoryTypeValue;
  categoryType?: ApplicantCategoryTypeValue;
  conditions?: {
    requiredQualification?: string | null;
  };
}

interface EligibilityCategoryMetadata {
  categoryId: string;
  eligible: boolean;
  checks?: {
    stageCheck?: {
      requiredStage?: string | null;
    };
  };
}

export interface VisibleEligibleCategoryInput {
  eligibility: readonly EligibilityCategoryMetadata[] | null | undefined;
  applicantCategories: readonly ApplicantCategoryMetadata[] | null | undefined;
  hasImportedSecondaryGrade: boolean;
  selectedCategoryKey: string | null | undefined;
}

function categoryIdOf(category: ApplicantCategoryMetadata): string | null {
  return category.code ?? category.key ?? category.categoryId ?? null;
}

function isPreUniversityValue(value: string | null | undefined): boolean {
  if (!value) return false;
  return value === 'pre_university' || value === 'ثانوي';
}

function isThanaweyaQualification(value: string | null | undefined): boolean {
  return value === 'thanaweya_amma' || value === 'azhar';
}

function isPreUniversityCategory(
  categoryId: string,
  category: ApplicantCategoryMetadata | undefined,
  verdict: EligibilityCategoryMetadata | undefined,
): boolean {
  return (
    isPreUniversityValue(category?.type) ||
    isPreUniversityValue(category?.categoryType) ||
    isPreUniversityValue(verdict?.checks?.stageCheck?.requiredStage) ||
    isThanaweyaQualification(category?.conditions?.requiredQualification) ||
    categoryId === 'officers_general'
  );
}

/**
 * Returns the applicant-start category keys that may be rendered.
 *
 * When the eligibility endpoint confirms an imported secondary-grade row and
 * at least one eligible pre-university category exists, university-stage
 * categories are hidden to prevent secondary applicants from selecting the
 * wrong application track.
 */
export function deriveVisibleEligibleCategoryKeys({
  eligibility,
  applicantCategories,
  hasImportedSecondaryGrade,
  selectedCategoryKey,
}: VisibleEligibleCategoryInput): readonly string[] | null {
  if (!eligibility) {
    return selectedCategoryKey ? [selectedCategoryKey] : null;
  }

  const eligibleKeys = eligibility
    .filter((category) => category.eligible)
    .map((category) => category.categoryId);

  if (!hasImportedSecondaryGrade) {
    return eligibleKeys;
  }

  const metadataByKey = new Map<string, ApplicantCategoryMetadata>();
  for (const category of applicantCategories ?? []) {
    const key = categoryIdOf(category);
    if (key) metadataByKey.set(key, category);
  }
  const verdictByKey = new Map(eligibility.map((category) => [category.categoryId, category]));
  const secondaryKeys = eligibleKeys.filter((key) =>
    isPreUniversityCategory(key, metadataByKey.get(key), verdictByKey.get(key)),
  );

  return secondaryKeys.length > 0 ? secondaryKeys : eligibleKeys;
}

export function filterApplicantCategoriesByVisibleKeys<T extends ApplicantCategoryMetadata>(
  categories: readonly T[],
  visibleKeys: readonly string[] | null,
): T[] {
  if (visibleKeys === null) return [...categories];
  const allowed = new Set(visibleKeys);
  return categories.filter((category) => {
    const key = categoryIdOf(category);
    return key ? allowed.has(key) : false;
  });
}
