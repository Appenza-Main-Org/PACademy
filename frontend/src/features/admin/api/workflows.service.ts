/**
 * INTEGRATION CONTRACT
 * GET    /api/v1/admin/workflows
 * GET    /api/v1/admin/workflows/{id}
 * GET    /api/v1/admin/workflows/by-department?department=
 * POST   /api/v1/admin/workflows
 * PUT    /api/v1/admin/workflows/{id}
 * DELETE /api/v1/admin/workflows/{id}
 * POST   /api/v1/admin/workflows/{id}/reorder
 * POST   /api/v1/admin/workflows/{id}/apply
 */

import { apiClient } from '@/shared/lib/api-client';
import type {
  ApplicantWorkflowProgress,
  DepartmentKey,
  DepartmentWorkflow,
  WorkflowStage,
  WorkflowTransitionEvent,
} from '@/shared/types/domain';

export function rekeyStages(stages: WorkflowStage[]): WorkflowStage[] {
  return stages.map((s, i) => ({ ...s, order: i + 1 }));
}

export const workflowsService = {
  async list(): Promise<DepartmentWorkflow[]> {
    return apiClient.get('/api/v1/admin/workflows');
  },

  async getById(id: string): Promise<DepartmentWorkflow | null> {
    return apiClient.get(`/api/v1/admin/workflows/${encodeURIComponent(id)}`);
  },

  async getByDepartment(department: DepartmentKey): Promise<DepartmentWorkflow | null> {
    return apiClient.get('/api/v1/admin/workflows/by-department', { query: { department } });
  },

  async create(
    payload: Omit<DepartmentWorkflow, 'id' | 'version' | 'createdAt' | 'updatedAt' | 'updatedBy'>,
  ): Promise<DepartmentWorkflow> {
    return apiClient.post('/api/v1/admin/workflows', payload);
  },

  async save(id: string, payload: Partial<DepartmentWorkflow>): Promise<DepartmentWorkflow> {
    return apiClient.put(`/api/v1/admin/workflows/${encodeURIComponent(id)}`, payload);
  },

  async reorderStages(id: string, stageIds: string[]): Promise<DepartmentWorkflow> {
    return apiClient.post(`/api/v1/admin/workflows/${encodeURIComponent(id)}/reorder`, { stageIds });
  },

  async apply(
    id: string,
    scope: 'new' | 'all',
  ): Promise<{ id: string; scope: 'new' | 'all'; affected: number }> {
    return apiClient.post(`/api/v1/admin/workflows/${encodeURIComponent(id)}/apply`, { scope });
  },

  async remove(id: string): Promise<{ ok: true }> {
    await apiClient.delete(`/api/v1/admin/workflows/${encodeURIComponent(id)}`);
    return { ok: true };
  },

  getProgressState(): ApplicantWorkflowProgress[] {
    return [];
  },

  setProgressState(_applicantId: string, _next: ApplicantWorkflowProgress): void {
    throw new Error('Workflow progress state is backend-owned.');
  },

  getTransitionState(): WorkflowTransitionEvent[] {
    return [];
  },

  appendTransition(_event: WorkflowTransitionEvent): void {
    throw new Error('Workflow transition state is backend-owned.');
  },
};
