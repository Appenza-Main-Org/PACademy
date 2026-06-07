type ApplicantCategoryTypeValue = 'pre_university' | 'university' | string;
type ApplicantGender = 'male' | 'female';

interface ApplicantCategoryMetadata {
  code?: string;
  key?: string;
  categoryId?: string;
  genderScope?: readonly ApplicantGender[];
  lockedGender?: ApplicantGender | null;
  type?: ApplicantCategoryTypeValue;
  categoryType?: ApplicantCategoryTypeValue;
  conditions?: {
    requiredQualification?: string | null;
    gender?: ApplicantGender | 'any' | null;
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
  applicantGender: ApplicantGender | null | undefined;
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

function allowsApplicantGender(
  category: ApplicantCategoryMetadata | undefined,
  applicantGender: ApplicantGender | null | undefined,
): boolean {
  if (!applicantGender || !category) return true;

  const conditionGender = category.conditions?.gender;
  if (conditionGender === 'male' || conditionGender === 'female') {
    return conditionGender === applicantGender;
  }

  if (category.lockedGender === 'male' || category.lockedGender === 'female') {
    return category.lockedGender === applicantGender;
  }

  if (Array.isArray(category.genderScope) && category.genderScope.length > 0) {
    return category.genderScope.includes(applicantGender);
  }

  return true;
}

/**
 * Returns the applicant-start category keys that may be rendered.
 *
 * When the eligibility endpoint confirms an imported secondary-grade row,
 * the rendered list is locked to pre-university categories. Failed
 * pre-university verdicts are deliberately kept in the list so the applicant
 * sees an explicit "غير مؤهل" status for that category instead of being
 * silently routed to an unrelated application track.
 */
export function deriveVisibleEligibleCategoryKeys({
  eligibility,
  applicantCategories,
  applicantGender,
  hasImportedSecondaryGrade,
  selectedCategoryKey,
}: VisibleEligibleCategoryInput): readonly string[] | null {
  const metadataByKey = new Map<string, ApplicantCategoryMetadata>();
  for (const category of applicantCategories ?? []) {
    const key = categoryIdOf(category);
    if (key) metadataByKey.set(key, category);
  }

  if (!eligibility) {
    if (!selectedCategoryKey) return null;
    return allowsApplicantGender(metadataByKey.get(selectedCategoryKey), applicantGender)
      ? [selectedCategoryKey]
      : [];
  }

  const genderAllowedVerdicts = eligibility.filter((category) =>
    allowsApplicantGender(metadataByKey.get(category.categoryId), applicantGender),
  );

  if (!hasImportedSecondaryGrade) {
    return genderAllowedVerdicts
      .filter((category) => category.eligible)
      .map((category) => category.categoryId);
  }

  const verdictByKey = new Map(eligibility.map((category) => [category.categoryId, category]));
  return genderAllowedVerdicts
    .filter((category) =>
      isPreUniversityCategory(
        category.categoryId,
        metadataByKey.get(category.categoryId),
        verdictByKey.get(category.categoryId),
      ),
    )
    .map((category) => category.categoryId);
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
