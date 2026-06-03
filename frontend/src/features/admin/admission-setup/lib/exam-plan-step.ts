import type {
  ApplicantCategoryKey,
  CycleCategoryExamPlanEntry,
} from '@/shared/types/domain';

export interface ExamPlanStepCategory {
  key: ApplicantCategoryKey;
  labelAr: string;
}

export interface ExamPlanCategoryDraft {
  entries: CycleCategoryExamPlanEntry[];
  hasOrderError: boolean;
  isLoading: boolean;
}

export type ExamPlanDraftsByCategory = Partial<
  Record<ApplicantCategoryKey, ExamPlanCategoryDraft>
>;

export interface ExamPlanStepDraftState {
  activeCategories: ExamPlanStepCategory[];
  draftsByCategory: ExamPlanDraftsByCategory;
}

export function hasExamPlanOrderErrors(entries: CycleCategoryExamPlanEntry[]): boolean {
  const counts = new Map<number, number>();
  for (const entry of entries) {
    counts.set(entry.order, (counts.get(entry.order) ?? 0) + 1);
  }

  return entries.some(
    (entry) =>
      !Number.isInteger(entry.order) ||
      entry.order < 1 ||
      (counts.get(entry.order) ?? 0) > 1,
  );
}

export function findCategoriesMissingExams(
  categories: readonly ExamPlanStepCategory[],
  draftsByCategory: ExamPlanDraftsByCategory,
): ExamPlanStepCategory[] {
  return categories.filter((category) => {
    const draft = draftsByCategory[category.key];
    return !draft || draft.entries.length === 0;
  });
}

export function findCategoriesWithInvalidExamOrders(
  categories: readonly ExamPlanStepCategory[],
  draftsByCategory: ExamPlanDraftsByCategory,
): ExamPlanStepCategory[] {
  return categories.filter((category) => draftsByCategory[category.key]?.hasOrderError);
}

export function hasPendingExamPlanDrafts(state: ExamPlanStepDraftState | null): boolean {
  if (!state) return true;
  return state.activeCategories.some((category) => {
    const draft = state.draftsByCategory[category.key];
    return !draft || draft.isLoading;
  });
}

export function formatMissingExamCategoriesMessage(
  categories: readonly ExamPlanStepCategory[],
): string {
  if (categories.length === 1) {
    return `يجب إضافة اختبار واحد على الأقل لفئة ${categories[0]!.labelAr} قبل الانتقال للخطوة التالية.`;
  }

  const labels = categories.map((category) => category.labelAr).join('، ');
  return `يجب إضافة اختبار واحد على الأقل للفئات التالية قبل الانتقال للخطوة التالية: ${labels}.`;
}

export function formatInvalidExamOrderCategoriesMessage(
  categories: readonly ExamPlanStepCategory[],
): string {
  if (categories.length === 1) {
    return `يرجى تصحيح ترتيب اختبارات فئة ${categories[0]!.labelAr} قبل الانتقال للخطوة التالية.`;
  }

  const labels = categories.map((category) => category.labelAr).join('، ');
  return `يرجى تصحيح ترتيب اختبارات الفئات التالية قبل الانتقال للخطوة التالية: ${labels}.`;
}
