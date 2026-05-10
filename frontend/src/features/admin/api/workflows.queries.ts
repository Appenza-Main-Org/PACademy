import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DepartmentKey, DepartmentWorkflow } from '@/shared/types/domain';
import { workflowsService } from './workflows.service';

export const workflowKeys = {
  all: ['workflows'] as const,
  lists: () => [...workflowKeys.all, 'list'] as const,
  detail: (id: string) => [...workflowKeys.all, 'detail', id] as const,
  byDepartment: (dept: DepartmentKey) => [...workflowKeys.all, 'department', dept] as const,
};

export function useWorkflows() {
  return useQuery({
    queryKey: workflowKeys.lists(),
    queryFn: () => workflowsService.list(),
  });
}

export function useWorkflow(id: string | null) {
  return useQuery({
    queryKey: workflowKeys.detail(id ?? ''),
    queryFn: () => workflowsService.getById(id!),
    enabled: Boolean(id) && id !== 'new',
  });
}

export function useWorkflowByDepartment(dept: DepartmentKey | null) {
  return useQuery({
    queryKey: workflowKeys.byDepartment(dept ?? ('general_first' as DepartmentKey)),
    queryFn: () => workflowsService.getByDepartment(dept!),
    enabled: Boolean(dept),
  });
}

export function useSaveWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string | null; payload: Partial<DepartmentWorkflow> }) => {
      if (!id || id === 'new') {
        const required = payload as Omit<
          DepartmentWorkflow,
          'id' | 'version' | 'createdAt' | 'updatedAt' | 'updatedBy'
        >;
        return workflowsService.create(required);
      }
      return workflowsService.save(id, payload);
    },
    onSuccess: (wf) => {
      void qc.invalidateQueries({ queryKey: workflowKeys.all });
      void qc.invalidateQueries({ queryKey: workflowKeys.detail(wf.id) });
    },
  });
}

export function useReorderStages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stageIds }: { id: string; stageIds: string[] }) =>
      workflowsService.reorderStages(id, stageIds),
    onSuccess: (wf) => {
      void qc.invalidateQueries({ queryKey: workflowKeys.all });
      void qc.invalidateQueries({ queryKey: workflowKeys.detail(wf.id) });
    },
  });
}

export function useApplyToScope() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, scope }: { id: string; scope: 'new' | 'all' }) =>
      workflowsService.apply(id, scope),
    onSuccess: (_res, vars) => {
      void qc.invalidateQueries({ queryKey: workflowKeys.all });
      void qc.invalidateQueries({ queryKey: workflowKeys.detail(vars.id) });
    },
  });
}

export function useDeleteWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => workflowsService.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: workflowKeys.all }),
  });
}
