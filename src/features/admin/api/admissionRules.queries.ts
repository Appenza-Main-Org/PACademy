import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { admissionRulesService } from './admissionRules.service';
import type { AdmissionRule } from '@/shared/types/domain';

export const admissionRulesKeys = {
  all: ['admission-rules'] as const,
  list: (cycleId: string) => [...admissionRulesKeys.all, 'list', cycleId] as const,
  current: (cycleId: string) => [...admissionRulesKeys.all, 'current', cycleId] as const,
};

export function useRulesForCycle(cycleId: string | null) {
  return useQuery({
    queryKey: admissionRulesKeys.list(cycleId ?? ''),
    queryFn: () => admissionRulesService.listForCycle(cycleId!),
    enabled: Boolean(cycleId),
  });
}

export function useCurrentRule(cycleId: string | null) {
  return useQuery({
    queryKey: admissionRulesKeys.current(cycleId ?? ''),
    queryFn: () => admissionRulesService.getCurrent(cycleId!),
    enabled: Boolean(cycleId),
  });
}

export function useSaveRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<AdmissionRule, 'id' | 'version' | 'effectiveAt'> & { effectiveAt?: string }) =>
      admissionRulesService.save(payload),
    onSuccess: (rule: AdmissionRule) => {
      qc.invalidateQueries({ queryKey: admissionRulesKeys.list(rule.cycleId) });
      qc.invalidateQueries({ queryKey: admissionRulesKeys.current(rule.cycleId) });
    },
  });
}
