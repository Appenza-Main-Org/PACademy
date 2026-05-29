import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApplicantStatus } from '@/shared/types/domain';
import { applicantService, type ApplicantFilters } from './applicant.service';
import { auditService } from '@/features/audit/api/audit.service';
import { noServerStateCacheOptions } from '@/shared/lib/query-options';
import type { ApplicantInput } from '../schemas';

export const applicantKeys = {
  all: ['applicants'] as const,
  lists: () => [...applicantKeys.all, 'list'] as const,
  list: (filters: ApplicantFilters) => [...applicantKeys.lists(), filters] as const,
  details: () => [...applicantKeys.all, 'detail'] as const,
  detail: (id: string) => [...applicantKeys.details(), id] as const,
  stats: () => [...applicantKeys.all, 'stats'] as const,
  statusOptions: () => [...applicantKeys.all, 'status-options'] as const,
  timeline: (id: string) => [...applicantKeys.all, 'timeline', id] as const,
  distribution: (field: 'governorate' | 'certType' | 'status') =>
    [...applicantKeys.all, 'distribution', field] as const,
  progress: (id: string) => [...applicantKeys.all, 'progress', id] as const,
  workflow: (id: string) => [...applicantKeys.all, 'workflow', id] as const,
  audit: (id: string) => [...applicantKeys.all, 'audit', id] as const,
};

export function useApplicants(filters: ApplicantFilters = {}) {
  return useQuery({
    queryKey: applicantKeys.list(filters),
    queryFn: () => applicantService.list(filters),
    ...noServerStateCacheOptions,
  });
}

export function useApplicant(id: string) {
  return useQuery({
    queryKey: applicantKeys.detail(id),
    queryFn: () => applicantService.getById(id),
    enabled: Boolean(id),
    ...noServerStateCacheOptions,
  });
}

export function useApplicantStats() {
  return useQuery({
    queryKey: applicantKeys.stats(),
    queryFn: () => applicantService.getStats(),
    ...noServerStateCacheOptions,
  });
}

export function useApplicantStatusOptions() {
  return useQuery({
    queryKey: applicantKeys.statusOptions(),
    queryFn: () => applicantService.getStatusOptions(),
    ...noServerStateCacheOptions,
  });
}

export function useApplicantTimeline(id: string) {
  return useQuery({
    queryKey: applicantKeys.timeline(id),
    queryFn: () => applicantService.getTimeline(id),
    enabled: Boolean(id),
    ...noServerStateCacheOptions,
  });
}

export function useApplicantDistribution(field: 'governorate' | 'certType' | 'status') {
  return useQuery({
    queryKey: applicantKeys.distribution(field),
    queryFn: () => applicantService.getDistribution(field),
    ...noServerStateCacheOptions,
  });
}

export function useApplicantProgress(id: string) {
  return useQuery({
    queryKey: applicantKeys.progress(id),
    queryFn: () => applicantService.getProgress(id),
    enabled: Boolean(id),
    ...noServerStateCacheOptions,
  });
}

/** Alias kept for the existing ApplicantWorkflowPanel component. */
export const useApplicantWorkflowProgress = useApplicantProgress;

export function useApplicantWorkflowTransitions(id: string) {
  return useQuery({
    queryKey: [...applicantKeys.all, 'transitions', id] as const,
    queryFn: () => applicantService.getWorkflowTransitions(id),
    enabled: Boolean(id),
    ...noServerStateCacheOptions,
  });
}

export function useApplicantWorkflow(id: string) {
  return useQuery({
    queryKey: applicantKeys.workflow(id),
    queryFn: () => applicantService.getActiveWorkflowFor(id),
    enabled: Boolean(id),
    ...noServerStateCacheOptions,
  });
}

export function useApplicantAudit(id: string) {
  return useQuery({
    queryKey: applicantKeys.audit(id),
    queryFn: () => applicantService.getAuditTrail(id),
    enabled: Boolean(id),
    ...noServerStateCacheOptions,
  });
}

/** Diff payload for a single audit entry — disclosed in the timeline. */
export function useAuditDiff(auditId: string | null) {
  return useQuery({
    queryKey: ['audit', 'diff', auditId ?? ''],
    queryFn: () => auditService.getDiff(auditId!),
    enabled: Boolean(auditId),
  });
}

export function useCreateApplicant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ApplicantInput) => applicantService.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: applicantKeys.lists() });
      qc.invalidateQueries({ queryKey: applicantKeys.stats() });
    },
  });
}

export function useUpdateApplicant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ApplicantInput> }) =>
      applicantService.update(id, patch),
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: applicantKeys.detail(a.id) });
      qc.invalidateQueries({ queryKey: applicantKeys.audit(a.id) });
      qc.invalidateQueries({ queryKey: applicantKeys.lists() });
    },
  });
}

export function useTransitionApplicant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      toStatus,
      reason,
    }: {
      id: string;
      toStatus: ApplicantStatus;
      reason?: string;
    }) => applicantService.transition(id, { toStatus, reason: reason ?? '' }),
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: applicantKeys.detail(a.id) });
      qc.invalidateQueries({ queryKey: applicantKeys.audit(a.id) });
      qc.invalidateQueries({ queryKey: applicantKeys.progress(a.id) });
      qc.invalidateQueries({ queryKey: applicantKeys.lists() });
    },
  });
}
