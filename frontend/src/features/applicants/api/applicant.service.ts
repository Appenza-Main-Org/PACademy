/**
 * Applicants API Contract.
 *
 * READ ENDPOINTS:
 *   GET /api/applicants
 *   GET /api/applicants/:id
 *   GET /api/applicants/:id/timeline
 *   GET /api/applicants/stats
 *   GET /api/applicants/status-options
 *   GET /api/applicants/distribution?field=
 *
 * WRITE / WORKFLOW ENDPOINTS:
 *   GET  /api/v1/applicants/check-nid
 *   POST /api/v1/applicants
 *   PUT  /api/v1/applicants/:id
 *   POST /api/v1/applicants/:id/transition
 *   GET  /api/v1/applicants/:id/workflow-progress
 *   GET  /api/v1/applicants/:id/workflow-transitions
 *   GET  /api/v1/applicants/:id/active-workflow
 *   GET  /api/v1/audit?entity=applicant&entityId=:id
 */

import { apiClient } from '@/shared/lib/api-client';
import type {
  Applicant,
  ApplicantStatus,
  ApplicantWorkflowProgress,
  AuditColor,
  AuditEntry,
  DepartmentWorkflow,
  Kpis,
  TimelineEvent,
  WorkflowTransitionEvent,
} from '@/shared/types/domain';
import type { Pagination } from '@/shared/types/api';
import type { ApplicantInput } from '../schemas';

export interface ApplicantFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: ApplicantStatus | 'all';
  governorate?: string | 'all';
  certType?: string | 'all';
}

export interface ApplicantStatusOption {
  value: ApplicantStatus;
  label: string;
  color: AuditColor;
}

export class ApplicantTransitionError extends Error {
  public readonly code: 422 | 409;
  constructor(message: string, code: 422 | 409 = 422) {
    super(message);
    this.name = 'ApplicantTransitionError';
    this.code = code;
  }
}

export function diffApplicants(
  prev: Applicant,
  next: Applicant,
): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  const compareKeys: Array<keyof Applicant> = [
    'name',
    'governorate',
    'city',
    'certType',
    'certSection',
    'certScore',
    'religion',
    'maritalStatus',
    'department',
    'status',
    'stage',
  ];
  for (const k of compareKeys) {
    const a = prev[k];
    const b = next[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      out[String(k)] = { from: a, to: b };
    }
  }
  if (prev.contact || next.contact) {
    const subkeys = [
      'mobilePhone',
      'homePhone',
      'email',
      'socialFacebook',
      'socialInstagram',
      'socialX',
      'socialOther',
    ] as const;
    for (const sk of subkeys) {
      const a = prev.contact?.[sk];
      const b = next.contact?.[sk];
      if ((a ?? '') !== (b ?? '')) {
        out[`contact.${sk}`] = { from: a ?? null, to: b ?? null };
      }
    }
  }
  return out;
}

export const applicantService = {
  async list(filters: ApplicantFilters = {}): Promise<Pagination<Applicant>> {
    return apiClient.get('/api/applicants', { query: filters });
  },

  async getById(id: string): Promise<Applicant | null> {
    return apiClient.get(`/api/applicants/${encodeURIComponent(id)}`);
  },

  async getStats(): Promise<Kpis> {
    return apiClient.get('/api/applicants/stats');
  },

  async getStatusOptions(): Promise<ApplicantStatusOption[]> {
    return apiClient.get('/api/applicants/status-options');
  },

  async getTimeline(id: string): Promise<TimelineEvent[]> {
    return apiClient.get(`/api/applicants/${encodeURIComponent(id)}/timeline`);
  },

  async getDistribution(field: 'governorate' | 'certType' | 'status'): Promise<Array<{ label: string; value: number }>> {
    return apiClient.get('/api/applicants/distribution', { query: { field } });
  },

  async checkNidCollision(nationalId: string, excludeId?: string): Promise<boolean> {
    const result = await apiClient.get<{ exists: boolean }>('/api/v1/applicants/check-nid', {
      query: { nationalId, excludeId },
    });
    return result.exists;
  },

  async create(input: ApplicantInput): Promise<Applicant> {
    return apiClient.post('/api/v1/applicants', input);
  },

  async update(id: string, patch: Partial<ApplicantInput>): Promise<Applicant> {
    return apiClient.put(`/api/v1/applicants/${encodeURIComponent(id)}`, patch);
  },

  async transition(
    id: string,
    payload: { toStatus: ApplicantStatus; reason: string },
  ): Promise<Applicant> {
    return apiClient.post(`/api/v1/applicants/${encodeURIComponent(id)}/transition`, payload);
  },

  async getProgress(id: string): Promise<ApplicantWorkflowProgress | null> {
    return apiClient.get(`/api/v1/applicants/${encodeURIComponent(id)}/workflow-progress`);
  },

  async getWorkflowTransitions(id: string): Promise<WorkflowTransitionEvent[]> {
    return apiClient.get(`/api/v1/applicants/${encodeURIComponent(id)}/workflow-transitions`);
  },

  async getActiveWorkflowFor(id: string): Promise<DepartmentWorkflow | null> {
    return apiClient.get(`/api/v1/applicants/${encodeURIComponent(id)}/active-workflow`);
  },

  async getAuditTrail(id: string): Promise<AuditEntry[]> {
    return apiClient.get('/api/v1/audit', { query: { entity: 'applicant', entityId: id } });
  },
};
