import { useQuery } from '@tanstack/react-query';
import { applicantService, type ApplicantFilters } from './applicant.service';

export const applicantKeys = {
  all: ['applicants'] as const,
  lists: () => [...applicantKeys.all, 'list'] as const,
  list: (filters: ApplicantFilters) => [...applicantKeys.lists(), filters] as const,
  details: () => [...applicantKeys.all, 'detail'] as const,
  detail: (id: string) => [...applicantKeys.details(), id] as const,
  stats: () => [...applicantKeys.all, 'stats'] as const,
  timeline: (id: string) => [...applicantKeys.all, 'timeline', id] as const,
  distribution: (field: 'governorate' | 'certType' | 'status') => [...applicantKeys.all, 'distribution', field] as const,
};

export function useApplicants(filters: ApplicantFilters = {}) {
  return useQuery({
    queryKey: applicantKeys.list(filters),
    queryFn: () => applicantService.list(filters),
  });
}

export function useApplicant(id: string) {
  return useQuery({
    queryKey: applicantKeys.detail(id),
    queryFn: () => applicantService.getById(id),
    enabled: Boolean(id),
  });
}

export function useApplicantStats() {
  return useQuery({
    queryKey: applicantKeys.stats(),
    queryFn: () => applicantService.getStats(),
  });
}

export function useApplicantTimeline(id: string) {
  return useQuery({
    queryKey: applicantKeys.timeline(id),
    queryFn: () => applicantService.getTimeline(id),
    enabled: Boolean(id),
  });
}

export function useApplicantDistribution(field: 'governorate' | 'certType' | 'status') {
  return useQuery({
    queryKey: applicantKeys.distribution(field),
    queryFn: () => applicantService.getDistribution(field),
  });
}
