import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { examPlansService } from './examPlans.service';
import type {
  ApplicantCategoryKey,
  CycleCategoryExamPlanEntry,
} from '@/shared/types/domain';

export const examPlanKeys = {
  all: ['exam-plans'] as const,
  exams: () => [...examPlanKeys.all, 'exams'] as const,
  byCycle: (cycleId: string) => [...examPlanKeys.all, 'by-cycle', cycleId] as const,
  plan: (cycleId: string, categoryId: ApplicantCategoryKey) =>
    [...examPlanKeys.all, 'plan', cycleId, categoryId] as const,
};

export function useAcademyExams() {
  return useQuery({ queryKey: examPlanKeys.exams(), queryFn: () => examPlansService.listExams() });
}

export function useCycleExamPlans(cycleId: string | null) {
  return useQuery({
    queryKey: examPlanKeys.byCycle(cycleId ?? ''),
    queryFn: () => examPlansService.listForCycle(cycleId!),
    enabled: Boolean(cycleId),
  });
}

export function useExamPlan(cycleId: string | null, categoryId: ApplicantCategoryKey | null) {
  return useQuery({
    queryKey: examPlanKeys.plan(cycleId ?? '', categoryId ?? ('' as ApplicantCategoryKey)),
    queryFn: () => examPlansService.getPlan(cycleId!, categoryId!),
    enabled: Boolean(cycleId && categoryId),
  });
}

export function useSaveExamPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      cycleId,
      categoryId,
      entries,
    }: {
      cycleId: string;
      categoryId: ApplicantCategoryKey;
      entries: CycleCategoryExamPlanEntry[];
    }) => examPlansService.savePlan(cycleId, categoryId, entries),
    onSuccess: (plan) => {
      qc.invalidateQueries({ queryKey: examPlanKeys.byCycle(plan.cycleId) });
      qc.invalidateQueries({ queryKey: examPlanKeys.plan(plan.cycleId, plan.categoryId) });
    },
  });
}

export function useCopyExamConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fromCycleId, toCycleId }: { fromCycleId: string; toCycleId: string }) =>
      examPlansService.copyConfig({ fromCycleId, toCycleId }),
    onSuccess: (plans) => {
      if (plans[0]) qc.invalidateQueries({ queryKey: examPlanKeys.byCycle(plans[0].cycleId) });
    },
  });
}
